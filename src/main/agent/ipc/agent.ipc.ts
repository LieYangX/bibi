/**
 * Agent IPC 处理器
 * 注册所有智能体相关的 IPC 通道
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { registerUserIpcHandler } from '../../ipc/handle-ipc'
import { getSetting, setSetting } from '../../services/setting.service'
import { processMessage } from '../orchestrator'
import type { EventEmitter } from '../orchestrator'
import { skillRegistry } from '../skill-registry'
import * as conversationStore from '../memory/conversation-store'
import type { AgentConfig } from '@shared/types'
import { createTraceId, getLogContext, logger, runWithLogContext } from '../../utils/logger'
import { summarizeLogValue } from '../../utils/log-sanitizer'
import {
    deleteMcpServer,
    getMcpServers,
    inspectSavedMcpServer,
    saveMcpServer,
    toggleMcpServer
} from '../mcp-service'
import { loadAgentConfig, updateAgentConfig } from '../agent-config'
import { toolRegistry } from '../tools/registry'

/** 活跃的智能体对话任务 */
interface ActiveChat {
    controller: AbortController
    traceId: string
    conversationId: string | null
}

/** 活跃的处理任务，用于取消 */
const activeChats = new Map<string, ActiveChat>()

/**
 * 取消指定用户的全部活跃对话
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
function cancelUserChats(userId: string): void {
    const keyPrefix = `${userId}:`
    for (const [key, chat] of activeChats) {
        if (!key.startsWith(keyPrefix)) continue
        chat.controller.abort()
        logger.info('Agent', '请求取消智能体对话', {
            agentTraceId: chat.traceId,
            conversationId: chat.conversationId
        })
    }
}

/**
 * 仅在控制器仍属于当前任务时清理活跃记录
 *
 * @param chatKey 对话任务键
 * @param chat 对话任务
 * @author xiangwei
 */
function clearActiveChat(chatKey: string, chat: ActiveChat): void {
    if (activeChats.get(chatKey) === chat) {
        activeChats.delete(chatKey)
    }
}

/**
 * 让出主进程事件循环，确保刚发送的流事件及时交付给渲染进程。
 *
 * @returns 下一轮事件循环完成信号
 * @author xiangwei
 */
function flushStreamEvent(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
}

/**
 * 注册 Agent IPC 处理器
 * @author xiangwei
 */
export function registerAgentIpc(): void {
    // 先初始化注册中心，确保所有 IPC 请求到来时 Skill 已就绪
    skillRegistry.initialize().catch((error: unknown) => {
        logger.error('SkillRegistry', '启动时初始化 Skill 失败', { error })
    })

    // 流式对话通过 invoke 初始化，并使用 event.sender.send 推流
    registerUserIpcHandler(
        IPC_CHANNELS.agent.chat,
        IPC_SCHEMAS.agent.chat,
        '发送消息失败',
        async (userId, event, conversationId, message) => {
            // 取消该用户上次未完成的流，防止竞态
            cancelUserChats(userId)

            const chatKey = `${userId}:${conversationId ?? 'new'}`
            const traceId = createTraceId('agent')
            const chat: ActiveChat = {
                controller: new AbortController(),
                traceId,
                conversationId
            }
            const parentTraceId = getLogContext().traceId
            activeChats.set(chatKey, chat)

            const sendEvent: EventEmitter = async (streamEvent) => {
                if (activeChats.get(chatKey) === chat && !event.sender.isDestroyed()) {
                    event.sender.send(IPC_CHANNELS.agent.event, { ...streamEvent, traceId })
                    await flushStreamEvent()
                }
            }

            // 异步处理，不阻塞 invoke 返回
            void runWithLogContext(
                {
                    traceId,
                    parentTraceId,
                    userId,
                    conversationId: conversationId ?? undefined,
                    channel: IPC_CHANNELS.agent.chat,
                    operation: 'agent.chat',
                    webContentsId: event.sender.id
                },
                async () => {
                    const startedAt = Date.now()
                    logger.info('Agent', '接收智能体对话请求', {
                        requestedConversationId: conversationId,
                        message: summarizeLogValue(message)
                    })
                    try {
                        const newConversationId = await processMessage(
                            conversationId,
                            message,
                            userId,
                            sendEvent,
                            chat.controller.signal
                        )
                        logger.info('Agent', '智能体对话完成', {
                            durationMs: Date.now() - startedAt,
                            conversationId: newConversationId
                        })
                        await sendEvent({ type: 'done', conversationId: newConversationId })
                    } catch (error: unknown) {
                        const cancelled = chat.controller.signal.aborted
                        const errorMessage = cancelled
                            ? '对话已取消'
                            : error instanceof Error
                              ? error.message
                              : '处理失败'
                        const logData = {
                            durationMs: Date.now() - startedAt,
                            cancelled,
                            error
                        }
                        if (cancelled) {
                            logger.warn('Agent', '智能体对话已取消', logData)
                        } else {
                            logger.error('Agent', '智能体对话失败', logData)
                        }
                        await sendEvent({ type: 'error', error: errorMessage })
                    } finally {
                        clearActiveChat(chatKey, chat)
                    }
                }
            )

            return 'started'
        }
    )

    // 取消对话
    registerUserIpcHandler(
        IPC_CHANNELS.agent.cancelChat,
        IPC_SCHEMAS.none,
        '取消失败',
        async (userId) => cancelUserChats(userId)
    )

    // 列出会话
    registerUserIpcHandler(
        IPC_CHANNELS.agent.listConversations,
        IPC_SCHEMAS.agent.listConversations,
        '获取会话列表失败',
        async (userId, _event, cursor) => {
            return conversationStore.listConversations(userId, cursor)
        }
    )

    // 删除会话
    registerUserIpcHandler(
        IPC_CHANNELS.agent.deleteConversation,
        IPC_SCHEMAS.agent.deleteConversation,
        '删除会话失败',
        async (userId, _event, id) => {
            return conversationStore.deleteConversation(id, userId)
        }
    )

    // 获取会话详情
    registerUserIpcHandler(
        IPC_CHANNELS.agent.getConversation,
        IPC_SCHEMAS.agent.getConversation,
        '获取会话失败',
        async (userId, _event, id, cursor) => {
            return conversationStore.getConversation(id, userId, cursor)
        }
    )

    // 获取配置
    registerUserIpcHandler(
        IPC_CHANNELS.agent.getConfig,
        IPC_SCHEMAS.none,
        '获取配置失败',
        async () => loadAgentConfig()
    )

    // 更新配置
    registerUserIpcHandler(
        IPC_CHANNELS.agent.updateConfig,
        IPC_SCHEMAS.agent.updateConfig,
        '更新配置失败',
        async (_userId, _event, config: Partial<AgentConfig>) => updateAgentConfig(config)
    )

    // 获取本地工具目录
    registerUserIpcHandler(
        IPC_CHANNELS.agent.listLocalTools,
        IPC_SCHEMAS.none,
        '获取本地工具失败',
        async () => toolRegistry.getToolInfos()
    )

    // 列出 Skills
    registerUserIpcHandler(
        IPC_CHANNELS.agent.listSkills,
        IPC_SCHEMAS.none,
        '获取 Skill 列表失败',
        async () => {
            return skillRegistry.getAllSkillMetas()
        }
    )

    // 重新加载 Skills
    registerUserIpcHandler(
        IPC_CHANNELS.agent.reloadSkills,
        IPC_SCHEMAS.none,
        '重新加载 Skill 失败',
        async () => {
            await skillRegistry.initialize()
        }
    )

    // 获取 Skill 详情
    registerUserIpcHandler(
        IPC_CHANNELS.agent.getSkillDetail,
        IPC_SCHEMAS.agent.getSkillDetail,
        '获取 Skill 详情失败',
        async (_userId, _event, name: string) => {
            const def = skillRegistry.getSkill(name)
            if (!def) return null
            return {
                meta: def.meta,
                markdown: def.markdown
            }
        }
    )

    // 启用/禁用 Skill
    registerUserIpcHandler(
        IPC_CHANNELS.agent.toggleSkill,
        IPC_SCHEMAS.agent.toggleSkill,
        '更新 Skill 状态失败',
        async (_userId, _event, name: string, enabled: boolean) => {
            return await skillRegistry.toggleSkill(name, enabled)
        }
    )

    // 重命名会话
    registerUserIpcHandler(
        IPC_CHANNELS.agent.renameConversation,
        IPC_SCHEMAS.agent.renameConversation,
        '重命名失败',
        async (userId, _event, id: string, title: string) => {
            const updated = await conversationStore.updateConversationTitle(id, title, userId)
            if (!updated) throw new Error('会话不存在或不属于当前用户')
            return true
        }
    )

    // 获取工具调用次数（用户级别持久化）
    registerUserIpcHandler(
        IPC_CHANNELS.agent.getToolCallCounts,
        IPC_SCHEMAS.agent.getToolCallCounts,
        '获取工具调用次数失败',
        async (userId) => {
            const key = `agent_tool_call_counts_${userId}`
            const data = await getSetting<string>(key)
            return data ? JSON.parse(data) : {}
        }
    )

    // 保存工具调用次数
    registerUserIpcHandler(
        IPC_CHANNELS.agent.setToolCallCounts,
        IPC_SCHEMAS.agent.setToolCallCounts,
        '保存工具调用次数失败',
        async (userId, _event, counts: Record<string, number>) => {
            const key = `agent_tool_call_counts_${userId}`
            await setSetting(key, JSON.stringify(counts))
        }
    )

    // 创建自定义 Skill
    registerUserIpcHandler(
        IPC_CHANNELS.agent.createSkill,
        IPC_SCHEMAS.agent.createSkill,
        '创建 Skill 失败',
        async (_userId, _event, data) => {
            await skillRegistry.createCustomSkill(data)
        }
    )

    // 删除自定义 Skill
    registerUserIpcHandler(
        IPC_CHANNELS.agent.deleteSkill,
        IPC_SCHEMAS.agent.deleteSkill,
        '删除 Skill 失败',
        async (_userId, _event, name) => {
            await skillRegistry.deleteCustomSkill(name)
        }
    )

    // 获取 MCP 服务配置
    registerUserIpcHandler(
        IPC_CHANNELS.agent.listMcpServers,
        IPC_SCHEMAS.none,
        '获取 MCP 服务失败',
        async () => getMcpServers()
    )

    // 新增或更新 MCP 服务
    registerUserIpcHandler(
        IPC_CHANNELS.agent.saveMcpServer,
        IPC_SCHEMAS.agent.saveMcpServer,
        '保存 MCP 服务失败',
        async (_userId, _event, server) => saveMcpServer(server)
    )

    // 删除 MCP 服务
    registerUserIpcHandler(
        IPC_CHANNELS.agent.deleteMcpServer,
        IPC_SCHEMAS.agent.deleteMcpServer,
        '删除 MCP 服务失败',
        async (_userId, _event, name) => deleteMcpServer(name)
    )

    // 启用或禁用 MCP 服务
    registerUserIpcHandler(
        IPC_CHANNELS.agent.toggleMcpServer,
        IPC_SCHEMAS.agent.toggleMcpServer,
        '更新 MCP 服务状态失败',
        async (_userId, _event, name, enabled) => toggleMcpServer(name, enabled)
    )

    // 连接 MCP 服务并发现工具
    registerUserIpcHandler(
        IPC_CHANNELS.agent.inspectMcpServer,
        IPC_SCHEMAS.agent.inspectMcpServer,
        '连接 MCP 服务失败',
        async (_userId, _event, name) => inspectSavedMcpServer(name)
    )
}
