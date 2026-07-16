/**
 * 微信智能体渠道服务
 *
 * 微信只负责收发消息，模型、Skill、MCP、工具与记忆统一复用现有智能体编排器。
 *
 * @author xiangwei
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'
import { WeixinBot } from '@pinixai/weixin-bot'
import type { IncomingMessage } from '@pinixai/weixin-bot'
import QRCode from 'qrcode'
import { AGENT_CHAT_CANCELLED_MESSAGE } from '@shared/types'
import type { StreamEvent, WechatConnectionStatus } from '@shared/types'
import { getAppDataPath } from '../utils/app-data-path'
import { createHttpClient } from '../utils/http-client'
import { logger } from '../utils/logger'
import { loadAgentConfig } from './agent-config'
import * as conversationStore from './memory/conversation-store'
import { processMessage } from './orchestrator'
import { shouldRefreshWechatQrCode } from './wechat-channel.policy'
import type { WechatQrStatus } from './wechat-channel.policy'

const WECHAT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const QR_POLL_INTERVAL_MS = 2_000
const QR_IMAGE_WIDTH = 224
const WECHAT_CONVERSATION_TITLE = '微信会话'
const UNSUPPORTED_MESSAGE_REPLY = '当前仅支持文字消息，请发送文字内容。'
const EMPTY_MESSAGE_REPLY = '没有识别到文字内容，请重新发送。'
const AGENT_ERROR_REPLY = '小笔暂时无法处理这条消息，请稍后再试。'

interface QrCodeResponse {
    qrcode: string
    qrcode_img_content: string
}

interface QrStatusResponse {
    status: WechatQrStatus
    bot_token?: string
    ilink_bot_id?: string
    ilink_user_id?: string
    baseurl?: string
}

interface StoredWechatCredentials {
    token: string
    baseUrl: string
    accountId: string
    userId: string
    conversationId: string
}

interface WechatRuntime {
    ownerUserId: string
    generation: number
    status: WechatConnectionStatus
    loginController: AbortController | null
    messageController: AbortController | null
    bot: WeixinBot | null
    messageQueue: Promise<void>
}

type StatusListener = (status: WechatConnectionStatus) => void
type AgentEventListener = (userId: string, event: StreamEvent) => void

const httpClient = createHttpClient({
    baseUrl: WECHAT_BASE_URL,
    timeoutMs: 15_000
})

/**
 * 微信渠道服务
 *
 * @author xiangwei
 */
class WechatChannelService {
    private readonly runtimes = new Map<string, WechatRuntime>()
    private readonly statusListeners = new Set<StatusListener>()
    private readonly agentEventListeners = new Set<AgentEventListener>()

    /**
     * 订阅微信连接状态
     *
     * @param listener 状态监听器
     * @returns 取消订阅函数
     * @author xiangwei
     */
    onStatus(listener: StatusListener): () => void {
        this.statusListeners.add(listener)
        return () => this.statusListeners.delete(listener)
    }

    /**
     * 订阅微信产生的智能体事件
     *
     * @param listener 智能体事件监听器
     * @returns 取消订阅函数
     * @author xiangwei
     */
    onAgentEvent(listener: AgentEventListener): () => void {
        this.agentEventListeners.add(listener)
        return () => this.agentEventListeners.delete(listener)
    }

    /**
     * 发起微信扫码连接
     *
     * @param userId 笔笔用户 ID
     * @returns 当前连接状态
     * @author xiangwei
     */
    async connect(userId: string): Promise<WechatConnectionStatus> {
        const runtime = this.getRuntime(userId)
        const generation = ++runtime.generation
        await this.stopRuntime(runtime)
        await this.removeCredentials(userId)

        runtime.loginController = new AbortController()
        this.updateStatus(runtime, { userId, phase: 'connecting' })

        void this.runQrLogin(runtime, generation, runtime.loginController.signal).catch(
            (error: unknown) => {
                if (generation !== runtime.generation || runtime.loginController?.signal.aborted) {
                    return
                }
                const message = this.getErrorMessage(error)
                logger.error('WechatChannel', '微信扫码连接失败', { userId, error: message })
                this.updateStatus(runtime, { userId, phase: 'error', error: message })
            }
        )
        return { ...runtime.status }
    }

    /**
     * 获取状态并按已保存凭证恢复微信消息监听
     *
     * @param userId 笔笔用户 ID
     * @returns 当前连接状态
     * @author xiangwei
     */
    async getStatus(userId: string): Promise<WechatConnectionStatus> {
        const runtime = this.getRuntime(userId)
        if (runtime.status.phase !== 'disconnected' || runtime.bot || runtime.loginController) {
            return { ...runtime.status }
        }

        const credentials = await this.readCredentials(userId)
        if (!credentials) return { ...runtime.status }

        try {
            credentials.conversationId = await this.ensureConversation(userId, credentials)
            await this.writeCredentials(userId, credentials)
            this.startBot(runtime, credentials)
        } catch (error: unknown) {
            const message = this.getErrorMessage(error)
            logger.error('WechatChannel', '恢复微信渠道失败', { userId, error: message })
            this.updateStatus(runtime, { userId, phase: 'error', error: message })
        }
        return { ...runtime.status }
    }

    /**
     * 断开微信并删除当前用户凭证
     *
     * @param userId 笔笔用户 ID
     * @returns 断开后的状态
     * @author xiangwei
     */
    async disconnect(userId: string): Promise<WechatConnectionStatus> {
        const runtime = this.getRuntime(userId)
        runtime.generation++
        await this.stopRuntime(runtime)
        await this.removeCredentials(userId)
        this.updateStatus(runtime, { userId, phase: 'disconnected' })
        logger.info('WechatChannel', '微信渠道已断开', { userId })
        return { ...runtime.status }
    }

    /**
     * 暂停指定用户的微信监听但保留凭证
     *
     * @param userId 笔笔用户 ID
     * @author xiangwei
     */
    async suspend(userId: string): Promise<void> {
        const runtime = this.runtimes.get(userId)
        if (!runtime) return
        runtime.generation++
        await this.stopRuntime(runtime)
        this.updateStatus(runtime, { userId, phase: 'disconnected' })
    }

    /**
     * 取消指定用户当前正在生成的微信回答
     *
     * @param userId 笔笔用户 ID
     * @returns 是否存在可取消的回答
     * @author xiangwei
     */
    cancelActiveResponse(userId: string): boolean {
        const controller = this.runtimes.get(userId)?.messageController
        if (!controller || controller.signal.aborted) return false
        controller.abort(AGENT_CHAT_CANCELLED_MESSAGE)
        return true
    }

    /**
     * 清理被删除用户的微信连接和凭证
     *
     * @param userId 笔笔用户 ID
     * @author xiangwei
     */
    async removeUser(userId: string): Promise<void> {
        await this.disconnect(userId)
        this.runtimes.delete(userId)
    }

    /**
     * 停止全部微信监听，应用退出时保留凭证供下次恢复
     *
     * @author xiangwei
     */
    stopAll(): void {
        for (const runtime of this.runtimes.values()) {
            runtime.generation++
            runtime.loginController?.abort()
            runtime.loginController = null
            runtime.bot?.stop()
            runtime.bot = null
        }
    }

    /**
     * 执行二维码获取、轮询和凭证落盘
     *
     * @param runtime 用户运行时
     * @param generation 本次连接代次
     * @param signal 取消信号
     * @author xiangwei
     */
    private async runQrLogin(
        runtime: WechatRuntime,
        generation: number,
        signal: AbortSignal
    ): Promise<void> {
        while (!signal.aborted && generation === runtime.generation) {
            const qr = await httpClient.get<QrCodeResponse>('/ilink/bot/get_bot_qrcode', {
                query: { bot_type: 3 },
                signal
            })
            if (!qr.qrcode || !qr.qrcode_img_content) throw new Error('微信二维码响应不完整')

            const qrCodeDataUrl = await QRCode.toDataURL(qr.qrcode_img_content, {
                width: QR_IMAGE_WIDTH,
                margin: 1,
                color: { dark: '#1f2933', light: '#ffffff' }
            })
            this.updateStatus(runtime, {
                userId: runtime.ownerUserId,
                phase: 'awaiting_scan',
                qrCodeDataUrl
            })

            for (;;) {
                await this.waitForPoll(signal)
                const result = await httpClient.get<QrStatusResponse>(
                    '/ilink/bot/get_qrcode_status',
                    {
                        query: { qrcode: qr.qrcode },
                        headers: { 'iLink-App-ClientVersion': '1' },
                        signal
                    }
                )

                if (result.status === 'scaned') {
                    this.updateStatus(runtime, {
                        userId: runtime.ownerUserId,
                        phase: 'scanned',
                        qrCodeDataUrl
                    })
                    continue
                }
                if (shouldRefreshWechatQrCode(result.status)) break
                if (result.status !== 'confirmed') continue

                const credentials = await this.createCredentials(runtime.ownerUserId, result)
                await this.writeCredentials(runtime.ownerUserId, credentials)
                runtime.loginController = null
                this.startBot(runtime, credentials)
                return
            }
        }
    }

    /**
     * 根据扫码确认结果创建完整凭证及微信会话
     *
     * @param userId 笔笔用户 ID
     * @param result 扫码确认结果
     * @returns 可供 SDK 使用的凭证
     * @author xiangwei
     */
    private async createCredentials(
        userId: string,
        result: QrStatusResponse
    ): Promise<StoredWechatCredentials> {
        if (!result.bot_token || !result.ilink_bot_id || !result.ilink_user_id) {
            throw new Error('微信登录已确认，但未返回完整连接凭证')
        }
        const config = await loadAgentConfig()
        const conversationId = await conversationStore.createConversation(
            userId,
            WECHAT_CONVERSATION_TITLE,
            config.model
        )
        return {
            token: result.bot_token,
            baseUrl: result.baseurl || WECHAT_BASE_URL,
            accountId: result.ilink_bot_id,
            userId: result.ilink_user_id,
            conversationId
        }
    }

    /**
     * 启动官方 SDK 长轮询并注册消息处理器
     *
     * @param runtime 用户运行时
     * @param credentials 微信凭证
     * @author xiangwei
     */
    private startBot(runtime: WechatRuntime, credentials: StoredWechatCredentials): void {
        runtime.bot?.stop()
        const generation = runtime.generation
        const bot = new WeixinBot({
            baseUrl: credentials.baseUrl,
            tokenPath: this.getCredentialPath(runtime.ownerUserId),
            onError: (error: unknown) => {
                logger.warn('WechatChannel', '微信长轮询发生异常并将自动重试', {
                    userId: runtime.ownerUserId,
                    error: this.getErrorMessage(error)
                })
            }
        })
        runtime.bot = bot
        bot.onMessage((message) => this.enqueueIncomingMessage(runtime, bot, generation, message))
        void bot.run().catch((error: unknown) => {
            if (runtime.bot !== bot || generation !== runtime.generation) return
            const message = this.getErrorMessage(error)
            logger.error('WechatChannel', '微信长轮询已停止', {
                userId: runtime.ownerUserId,
                error: message
            })
            runtime.bot = null
            this.updateStatus(runtime, {
                userId: runtime.ownerUserId,
                phase: 'error',
                conversationId: credentials.conversationId,
                error: message
            })
        })
        this.updateStatus(runtime, {
            userId: runtime.ownerUserId,
            phase: 'connected',
            conversationId: credentials.conversationId,
            accountId: credentials.accountId
        })
        logger.info('WechatChannel', '微信渠道已连接并开始监听消息', {
            userId: runtime.ownerUserId,
            conversationId: credentials.conversationId
        })
    }

    /**
     * 将微信入站消息加入当前用户的串行处理队列
     *
     * @param runtime 用户运行时
     * @param bot 当前 SDK 实例
     * @param generation 连接代次
     * @param message 微信消息
     * @author xiangwei
     */
    private enqueueIncomingMessage(
        runtime: WechatRuntime,
        bot: WeixinBot,
        generation: number,
        message: IncomingMessage
    ): void {
        runtime.messageQueue = runtime.messageQueue
            .then(async () => {
                if (runtime.bot !== bot || generation !== runtime.generation) return
                await this.handleIncomingMessage(runtime, bot, message)
            })
            .catch((error: unknown) => {
                logger.error('WechatChannel', '微信消息处理失败', {
                    userId: runtime.ownerUserId,
                    error: this.getErrorMessage(error)
                })
            })
    }

    /**
     * 复用现有智能体处理微信文本并回复微信
     *
     * @param runtime 用户运行时
     * @param bot 当前 SDK 实例
     * @param message 微信消息
     * @author xiangwei
     */
    private async handleIncomingMessage(
        runtime: WechatRuntime,
        bot: WeixinBot,
        message: IncomingMessage
    ): Promise<void> {
        if (message.type !== 'text') {
            await bot.reply(message, UNSUPPORTED_MESSAGE_REPLY)
            return
        }
        const content = message.text.trim()
        if (!content) {
            await bot.reply(message, EMPTY_MESSAGE_REPLY)
            return
        }

        void bot.sendTyping(message.userId).catch((error: unknown) => {
            logger.warn('WechatChannel', '发送微信输入状态失败', {
                userId: runtime.ownerUserId,
                error: this.getErrorMessage(error)
            })
        })

        let messageController: AbortController | null = null
        try {
            const credentials = await this.requireCredentials(runtime.ownerUserId)
            const conversationId = await this.ensureConversation(runtime.ownerUserId, credentials)
            if (conversationId !== credentials.conversationId) {
                credentials.conversationId = conversationId
                await this.writeCredentials(runtime.ownerUserId, credentials)
                this.updateStatus(runtime, {
                    ...runtime.status,
                    conversationId
                })
            }

            let responseText = ''
            messageController = new AbortController()
            runtime.messageController = messageController
            const resolvedConversationId = await processMessage(
                conversationId,
                content,
                runtime.ownerUserId,
                false,
                async (event) => {
                    if (event.type === 'message' && event.message?.role === 'assistant') {
                        responseText += event.message.content
                    } else if (event.type === 'chunk' && event.content) {
                        responseText += event.content
                    }
                    this.publishAgentEvent(runtime.ownerUserId, {
                        ...event,
                        source: 'wechat',
                        conversationId: event.conversationId || conversationId
                    })
                },
                messageController.signal
            )
            this.publishAgentEvent(runtime.ownerUserId, {
                type: 'done',
                source: 'wechat',
                conversationId: resolvedConversationId
            })
            await bot.reply(message, responseText || AGENT_ERROR_REPLY)
        } catch (error: unknown) {
            if (messageController?.signal.aborted) {
                if (messageController.signal.reason === AGENT_CHAT_CANCELLED_MESSAGE) {
                    this.publishAgentEvent(runtime.ownerUserId, {
                        type: 'error',
                        source: 'wechat',
                        conversationId: runtime.status.conversationId,
                        error: AGENT_CHAT_CANCELLED_MESSAGE
                    })
                    await bot.reply(message, AGENT_CHAT_CANCELLED_MESSAGE)
                }
                return
            }
            this.publishAgentEvent(runtime.ownerUserId, {
                type: 'error',
                source: 'wechat',
                conversationId: runtime.status.conversationId,
                error: this.getErrorMessage(error)
            })
            logger.error('WechatChannel', '微信智能体回复失败', {
                userId: runtime.ownerUserId,
                error: this.getErrorMessage(error)
            })
            await bot.reply(message, AGENT_ERROR_REPLY)
        } finally {
            runtime.messageController = null
            void bot.stopTyping(message.userId).catch(() => undefined)
        }
    }

    /**
     * 确保微信会话仍存在，不存在时新建会话
     *
     * @param userId 笔笔用户 ID
     * @param credentials 微信凭证
     * @returns 可用会话 ID
     * @author xiangwei
     */
    private async ensureConversation(
        userId: string,
        credentials: StoredWechatCredentials
    ): Promise<string> {
        if (
            credentials.conversationId &&
            (await conversationStore.conversationBelongsToUser(credentials.conversationId, userId))
        ) {
            return credentials.conversationId
        }
        const config = await loadAgentConfig()
        return conversationStore.createConversation(userId, WECHAT_CONVERSATION_TITLE, config.model)
    }

    /**
     * 停止单个用户运行时
     *
     * @param runtime 用户运行时
     * @author xiangwei
     */
    private async stopRuntime(runtime: WechatRuntime): Promise<void> {
        runtime.loginController?.abort()
        runtime.loginController = null
        runtime.messageController?.abort()
        runtime.messageController = null
        runtime.bot?.stop()
        runtime.bot = null
        await runtime.messageQueue.catch(() => undefined)
        runtime.messageQueue = Promise.resolve()
    }

    /**
     * 等待下一次二维码状态轮询
     *
     * @param signal 取消信号
     * @author xiangwei
     */
    private waitForPoll(signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                reject(signal.reason ?? new DOMException('连接已取消', 'AbortError'))
                return
            }
            const timer = setTimeout(() => {
                signal.removeEventListener('abort', onAbort)
                resolve()
            }, QR_POLL_INTERVAL_MS)
            const onAbort = (): void => {
                clearTimeout(timer)
                reject(signal.reason ?? new DOMException('连接已取消', 'AbortError'))
            }
            signal.addEventListener('abort', onAbort, { once: true })
        })
    }

    /**
     * 获取或创建用户运行时
     *
     * @param userId 笔笔用户 ID
     * @returns 用户运行时
     * @author xiangwei
     */
    private getRuntime(userId: string): WechatRuntime {
        const existing = this.runtimes.get(userId)
        if (existing) return existing
        const runtime: WechatRuntime = {
            ownerUserId: userId,
            generation: 0,
            status: { userId, phase: 'disconnected' },
            loginController: null,
            messageController: null,
            bot: null,
            messageQueue: Promise.resolve()
        }
        this.runtimes.set(userId, runtime)
        return runtime
    }

    /**
     * 更新状态并通知订阅者
     *
     * @param runtime 用户运行时
     * @param status 最新状态
     * @author xiangwei
     */
    private updateStatus(runtime: WechatRuntime, status: WechatConnectionStatus): void {
        runtime.status = { ...status }
        for (const listener of this.statusListeners) listener({ ...runtime.status })
    }

    /**
     * 转发微信产生的智能体流事件
     *
     * @param userId 笔笔用户 ID
     * @param event 智能体流事件
     * @author xiangwei
     */
    private publishAgentEvent(userId: string, event: StreamEvent): void {
        for (const listener of this.agentEventListeners) listener(userId, event)
    }

    /**
     * 获取当前用户微信凭证路径
     *
     * @param userId 笔笔用户 ID
     * @returns 凭证绝对路径
     * @author xiangwei
     */
    private getCredentialPath(userId: string): string {
        const userKey = createHash('sha256').update(userId).digest('hex')
        return getAppDataPath('wechat', userKey, 'credentials.json')
    }

    /**
     * 读取并校验微信凭证
     *
     * @param userId 笔笔用户 ID
     * @returns 微信凭证，不存在时返回 null
     * @author xiangwei
     */
    private async readCredentials(userId: string): Promise<StoredWechatCredentials | null> {
        try {
            const content = await readFile(this.getCredentialPath(userId), 'utf8')
            const value = JSON.parse(content) as Partial<StoredWechatCredentials>
            if (
                !value.token ||
                !value.baseUrl ||
                !value.accountId ||
                !value.userId ||
                !value.conversationId
            ) {
                throw new Error('微信连接凭证格式无效')
            }
            return value as StoredWechatCredentials
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
            throw error
        }
    }

    /**
     * 读取必须存在的微信凭证
     *
     * @param userId 笔笔用户 ID
     * @returns 微信凭证
     * @author xiangwei
     */
    private async requireCredentials(userId: string): Promise<StoredWechatCredentials> {
        const credentials = await this.readCredentials(userId)
        if (!credentials) throw new Error('微信连接凭证不存在')
        return credentials
    }

    /**
     * 安全写入微信凭证
     *
     * @param userId 笔笔用户 ID
     * @param credentials 微信凭证
     * @author xiangwei
     */
    private async writeCredentials(
        userId: string,
        credentials: StoredWechatCredentials
    ): Promise<void> {
        const credentialPath = this.getCredentialPath(userId)
        await mkdir(dirname(credentialPath), { recursive: true, mode: 0o700 })
        await writeFile(credentialPath, `${JSON.stringify(credentials, null, 2)}\n`, {
            mode: 0o600
        })
        await chmod(credentialPath, 0o600)
    }

    /**
     * 删除微信凭证文件
     *
     * @param userId 笔笔用户 ID
     * @author xiangwei
     */
    private async removeCredentials(userId: string): Promise<void> {
        await rm(this.getCredentialPath(userId), { force: true })
    }

    /**
     * 获取可公开记录的异常信息
     *
     * @param error 异常
     * @returns 异常信息
     * @author xiangwei
     */
    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : '微信连接失败'
    }
}

export const wechatChannelService = new WechatChannelService()
