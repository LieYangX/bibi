/**
 * 消息窗口构建
 * 按记忆阈值裁剪最近对话，拼接 runtime_context
 *
 * @author xiangwei
 */

import { pruneMessages, type ModelMessage } from 'ai'
import type { RuntimeSystemInfo } from '../runtime-system-info'

/** 上下文中的持久化消息 */
interface ConversationMessage {
    role: string
    content: string
}

/** 构建消息窗口的参数 */
interface BuildMessagesOptions {
    history: ConversationMessage[]
    userMessage: string
    maxUserTurns: number
    soulMemory: string
    profileMemory: string
    userName: string
    systemInfo: RuntimeSystemInfo
    currentDate?: string
}

/**
 * 构建带滑动窗口的模型消息
 * 当前消息也计入阈值，因此历史最多保留阈值减一轮。
 *
 * @param options 构建参数
 * @returns AI SDK 模型消息
 * @author xiangwei
 */
export function buildMessages(options: BuildMessagesOptions): ModelMessage[] {
    const previousTurnLimit = Math.max(0, options.maxUserTurns - 1)
    const filteredHistory = options.history.filter(
        (message) => message.role === 'user' || message.role === 'assistant'
    )
    const recentHistory = trimToRecentUserTurns(filteredHistory, previousTurnLimit)
    const historyMessages = recentHistory.map(
        (message) =>
            ({
                role: message.role as 'user' | 'assistant',
                content: message.content
            }) satisfies ModelMessage
    )
    const currentDate = options.currentDate ?? formatCurrentDate(new Date())
    const currentTime = formatCurrentTime(new Date())
    const userName = options.userName.replace(/\s+/g, ' ').trim() || '未命名用户'
    const runtimeContext = `<runtime_context>
 当前日期：${currentDate}
 当前时间：${currentTime}
 用户名：${userName}
系统信息：
- 操作系统：${options.systemInfo.operatingSystem} ${options.systemInfo.systemRelease}
- 系统架构：${options.systemInfo.architecture}
- 应用版本：${options.systemInfo.appVersion}
- 语言区域：${options.systemInfo.locale}
- 时区：${options.systemInfo.timeZone}
用户画像：
${options.profileMemory || '暂无用户画像'}
最新灵魂记忆：
${options.soulMemory || '暂无已提炼的灵魂记忆'}
</runtime_context>`
    const messages: ModelMessage[] = [
        ...historyMessages,
        {
            role: 'user',
            content: `${options.userMessage}\n\n${runtimeContext}`
        }
    ]

    return pruneMessages({
        messages,
        reasoning: 'before-last-message',
        toolCalls: 'before-last-message',
        emptyMessages: 'remove'
    })
}

/**
 * 从历史中保留最近若干个用户轮次
 *
 * @param history 已过滤的用户和助手消息
 * @param userTurnLimit 用户轮次上限
 * @returns 裁剪后的消息
 * @author xiangwei
 */
function trimToRecentUserTurns(
    history: ConversationMessage[],
    userTurnLimit: number
): ConversationMessage[] {
    if (userTurnLimit <= 0) return []

    let userTurnCount = 0
    let startIndex = 0
    for (let index = history.length - 1; index >= 0; index--) {
        if (history[index].role === 'user') {
            userTurnCount++
            if (userTurnCount === userTurnLimit) {
                startIndex = index
                break
            }
        }
    }
    return history.slice(startIndex)
}

/**
 * 格式化本地日期
 *
 * @param date 日期
 * @returns 中文日期
 * @author xiangwei
 */
function formatCurrentDate(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 格式化本地时间
 *
 * @param date 日期
 * @returns HH:mm 时间
 * @author xiangwei
 */
function formatCurrentTime(date: Date): string {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
}
