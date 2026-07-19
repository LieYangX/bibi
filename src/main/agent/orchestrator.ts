/**
 * Agent 智能体编排器
 *
 * 消息模型：每一轮对话产生 user → (tool × N) → assistant 序列。
 * 每条消息是独立的原子单元，后端存什么前端就渲染什么。
 * 事件只分三类：message（完整消息）、chunk（追加文本）、thinking（仅 UI 显示）。
 *
 * @author xiangwei
 */

import { streamText, isStepCount } from 'ai'
import type { ModelMessage, Tool } from 'ai'
import { randomUUID } from 'crypto'
import { createModel } from './llm-gateway'
import { skillRegistry } from './skill-registry'
import { toolRegistry } from './tools/registry'
import { buildSystemPrompt } from './context/system-prompt'
import { buildMessages } from './context/message-builder'
import * as conversationStore from './memory/conversation-store'
import { localMemoryStore } from './memory/local-memory'
import { distillSoulIfNeeded } from './memory/soul-distiller'
import { loadAgentConfig } from './agent-config'
import type { AgentConfig } from '@shared/types'
import type { EventEmitter } from './agent-run-context'
import { logger, runWithLogContext } from '../utils/logger'
import { summarizeLogValue } from '../utils/log-sanitizer'
import { closeMcpClients, loadMcpRuntimeTools } from './mcp-service'
import { getRuntimeSystemInfo } from './runtime-system-info'
import { getUser } from '../services/user.service'

/** 流式事件发射器（从 agent-run-context re-export，保持向后兼容） */
export type { EventEmitter }

/** Agent 运行时配置 */
type AgentRuntimeConfig = AgentConfig

/** 工具英文名 → 中文名 */
const TOOL_CN: Record<string, string> = {
    queryTransactions: '流水查询',
    queryRecentTransactions: '最近流水',
    queryAccountBalance: '账户余额',
    queryMonthlySummary: '月度汇总',
    queryYearlySummary: '年度汇总',
    queryCategorySummary: '分类统计',
    queryBudgetProgress: '预算进度',
    evaluate: '表达式计算',
    summarize: '数据汇总',
    compareValues: '数值对比',
    convertCentsToYuan: '单位换算',
    analyzeTrend: '趋势分析',
    detectAnomalies: '异常检测',
    comparePeriods: '周期对比',
    createTransaction: '记账',
    deleteTransaction: '删除流水',
    queryAllAccounts: '账户列表',
    queryAllCategories: '分类列表',
    getSkill: '加载 Skill',
    readLocalMemory: '读取本地记忆',
    writeLocalMemory: '写入本地记忆',
    createAgentTasks: '创建任务清单',
    updateAgentTaskStatus: '更新任务状态',
    queryAgentTasks: '查询任务进度',
    clearAgentTasks: '清空任务清单',
    createUserTodo: '创建待办',
    deleteUserTodo: '删除待办',
    queryUserTodos: '查询待办',
    updateUserTodo: '修改待办'
}

const MAX_AGENT_STEPS = 10
const MAX_TOOL_MESSAGE_LENGTH = 1_000
const CONVERSATION_TITLE_MAX_LENGTH = 20

/**
 * 处理用户消息——主入口
 *
 * 事件流顺序（前端据此构建消息时间线）：
 *   thinking → (tool_called → tool_result)* → chunk* → done
 *
 * @param conversationId 会话 ID（null 表示新建）
 * @param userMessage 用户输入
 * @param userId 当前用户 ID
 * @param deepThink 是否启用深度思考
 * @param emit 事件发射器
 * @returns 会话 ID
 * @author xiangwei
 */
export async function processMessage(
    conversationId: string | null,
    userMessage: string,
    userId: string,
    deepThink: boolean,
    emit: EventEmitter,
    abortSignal?: AbortSignal
): Promise<string> {
    const startedAt = Date.now()
    let modelName: string | undefined
    logger.info('Agent', '开始处理智能体对话', {
        requestedConversationId: conversationId,
        message: summarizeLogValue(userMessage)
    })

    try {
        const config = await loadAgentConfig()
        modelName = config.model
        if (!config.enabled) throw new Error('智能体未启用')
        if (!config.apiKey) throw new Error('API Key 未配置')

        // 创建或校验会话归属，后续日志均附带实际会话编号。
        const resolvedConversationId = await resolveConversationId(
            conversationId,
            userId,
            config.model
        )
        return await runWithLogContext(
            { userId, conversationId: resolvedConversationId, operation: 'agent.chat' },
            () =>
                runConversation(
                    resolvedConversationId,
                    userMessage,
                    userId,
                    deepThink,
                    emit,
                    config,
                    abortSignal
                )
        )
    } catch (error: unknown) {
        logger.error('Agent', '智能体对话处理失败', {
            requestedConversationId: conversationId,
            model: modelName,
            durationMs: Date.now() - startedAt,
            error
        })
        throw error
    }
}

/**
 * 创建新会话或校验既有会话归属
 *
 * @param conversationId 请求中的会话 ID
 * @param userId 当前用户 ID
 * @param model 模型名称
 * @returns 可安全使用的会话 ID
 * @author xiangwei
 */
async function resolveConversationId(
    conversationId: string | null,
    userId: string,
    model: string
): Promise<string> {
    if (!conversationId) {
        return conversationStore.createConversation(userId, undefined, model)
    }
    if (!(await conversationStore.conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    return conversationId
}

/**
 * 执行已完成校验的智能体对话
 *
 * @param conversationId 已校验的会话 ID
 * @param userMessage 用户输入
 * @param userId 当前用户 ID
 * @param deepThink 是否启用深度思考
 * @param emit 流式事件发射器
 * @param config 智能体运行配置
 * @param abortSignal 取消信号
 * @returns 会话 ID
 * @author xiangwei
 */
async function runConversation(
    conversationId: string,
    userMessage: string,
    userId: string,
    deepThink: boolean,
    emit: EventEmitter,
    config: AgentRuntimeConfig,
    abortSignal?: AbortSignal
): Promise<string> {
    const startedAt = Date.now()
    const enabledSkills = skillRegistry.getEnabledSkills()

    const model = createModel(config.apiKey, config.model)
    const [soulMemory, profileMemory, history, currentUser, mcpRuntime] = await Promise.all([
        localMemoryStore.readMemory(userId, 'soul'),
        localMemoryStore.readMemory(userId, 'profile'),
        conversationStore.restoreRecentMessages(
            conversationId,
            userId,
            Math.max(0, config.memoryDistillationThreshold - 1)
        ),
        getUser(userId),
        loadMcpRuntimeTools()
    ])
    if (!currentUser) throw new Error('当前用户不存在')
    const messages = buildMessages({
        history,
        userMessage,
        maxUserTurns: config.memoryDistillationThreshold,
        soulMemory: soulMemory.content,
        profileMemory: profileMemory.content,
        userName: currentUser.name,
        systemInfo: getRuntimeSystemInfo()
    })
    const systemPrompt = buildSystemPrompt(
        enabledSkills,
        toolRegistry.getGroupedToolInfos(),
        mcpRuntime.toolInfos
    )
    const localTools = toolRegistry.createTools({ userId, conversationId, emit })
    const allTools: Record<string, Tool> = {
        ...localTools,
        ...mcpRuntime.tools
    }
    logger.info('Agent', '智能体对话上下文已就绪', {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        memoryDistillationThreshold: config.memoryDistillationThreshold,
        enabledSkills: enabledSkills.map((skill) => skill.meta.name),
        historyMessageCount: history.length,
        soulMemoryLength: soulMemory.content.length,
        modelMessageCount: messages.length,
        localToolCount: Object.keys(localTools).length,
        mcpToolCount: Object.keys(mcpRuntime.tools).length,
        toolCount: Object.keys(allTools).length
    })

    // 保存并发射 user 消息（按内容估算 token）
    const userTokenEstimate = Math.max(Math.round(userMessage.length / 2), 1)
    await conversationStore.saveMessage(conversationId, userId, 'user', userMessage, {
        token_count: userTokenEstimate
    })
    await emit({
        type: 'message',
        message: { id: randomUUID(), role: 'user', content: userMessage }
    })
    await emit({ type: 'thinking', content: '', conversationId })

    let fullResponse = ''
    let currentAsstId: string | null = null
    let thinkingText = ''
    let thinkingForNextMsg = ''
    let firstPhaseThinking = ''
    let thinkingStartedAt: number | null = null
    let thinkingDurationMs = 0
    let totalTokens = 0
    let toolResultCount = 0

    // 按时间线处理模型输出，日志仅保存长度与结构摘要，不写入推理内容。
    try {
        const result = streamText({
            model,
            system: systemPrompt,
            messages: messages as ModelMessage[],
            tools: allTools,
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
            stopWhen: isStepCount(MAX_AGENT_STEPS),
            abortSignal,
            providerOptions: {
                deepseek: deepThink
                    ? {
                          thinking: { type: 'enabled' as const },
                          reasoningEffort: 'high' as const
                      }
                    : { thinking: { type: 'disabled' as const } }
            }
        })

        // 直接消费完整事件流，收到一个模型事件就立即转发一个 IPC 事件。
        for await (const part of result.stream) {
            if (part.type === 'reasoning-start') {
                thinkingStartedAt ??= Date.now()
                continue
            }
            if (part.type === 'reasoning-delta') {
                thinkingStartedAt ??= Date.now()
                thinkingText += part.text
                await emit({ type: 'thinking', content: thinkingText })
                continue
            }
            if (part.type === 'reasoning-end') {
                if (thinkingStartedAt !== null) {
                    thinkingDurationMs += Date.now() - thinkingStartedAt
                    thinkingStartedAt = null
                }
                thinkingForNextMsg = thinkingText
                thinkingText = ''
                continue
            }
            if (part.type === 'text-delta') {
                const text = part.text
                fullResponse += text
                if (!currentAsstId) {
                    currentAsstId = randomUUID()
                    await emit({
                        type: 'message',
                        message: {
                            id: currentAsstId,
                            role: 'assistant',
                            content: text,
                            streaming: true,
                            thinking: thinkingForNextMsg || undefined,
                            thinking_duration_ms: thinkingDurationMs || undefined
                        }
                    })
                    if (!firstPhaseThinking && thinkingForNextMsg) {
                        firstPhaseThinking = thinkingForNextMsg
                        logger.debug('Agent', '模型开始输出回复', {
                            thinkingLength: firstPhaseThinking.length
                        })
                    }
                    thinkingForNextMsg = ''
                } else {
                    await emit({ type: 'chunk', content: text, id: currentAsstId })
                }
                continue
            }
            if (part.type === 'tool-result') {
                const toolName = part.toolName as string
                const cnName = TOOL_CN[toolName] || mcpRuntime.displayNames[toolName] || toolName
                const resultStr = JSON.stringify(part.output ?? '') || '完成'
                toolResultCount++
                logger.info('Agent', '模型工具调用返回', {
                    toolName,
                    displayName: cnName,
                    result: summarizeLogValue(part.output)
                })
                await emit({
                    type: 'message',
                    message: {
                        id: randomUUID(),
                        role: 'tool',
                        content: resultStr.slice(0, MAX_TOOL_MESSAGE_LENGTH),
                        tool_used: cnName
                    }
                })
                currentAsstId = null
                thinkingForNextMsg = ''
                const toolContent = resultStr.slice(0, MAX_TOOL_MESSAGE_LENGTH)
                const toolTokenEstimate = Math.max(Math.round(toolContent.length / 2), 1)
                void conversationStore
                    .saveMessage(conversationId, userId, 'tool', toolContent, {
                        tool_used: cnName,
                        token_count: toolTokenEstimate
                    })
                    .catch((error: unknown) => {
                        logger.error('Agent', '工具结果持久化失败', { toolName, error })
                    })
                continue
            }
            if (part.type === 'finish-step') {
                const usage = part.usage
                if (usage?.totalTokens) totalTokens += usage.totalTokens
                continue
            }
            if (part.type === 'error') {
                throw part.error instanceof Error ? part.error : new Error(String(part.error))
            }
        }

        // 流消费完后取最终用量（部分提供商不在 finish-step 中返回用量）
        const finalUsage = await result.usage
        if (finalUsage?.totalTokens && !totalTokens) {
            totalTokens = finalUsage.totalTokens
        }
    } finally {
        await closeMcpClients(mcpRuntime.clients)
    }

    if (fullResponse) {
        // 最终兜底：按内容长度估算 token
        const asstTokens = totalTokens || Math.max(Math.round(fullResponse.length / 2), 1)
        await conversationStore.saveMessage(conversationId, userId, 'assistant', fullResponse, {
            finish_reason: 'stop',
            token_count: asstTokens,
            thinking: firstPhaseThinking || undefined,
            thinking_duration_ms: thinkingDurationMs || undefined
        })
    }

    const conversations = await conversationStore.listConversations(userId)
    const currentConversation = conversations.items.find(
        (conversation) => conversation.id === conversationId
    )
    if (currentConversation && currentConversation.title === '新对话' && fullResponse) {
        const title =
            userMessage.length > CONVERSATION_TITLE_MAX_LENGTH
                ? `${userMessage.slice(0, CONVERSATION_TITLE_MAX_LENGTH)}...`
                : userMessage
        await conversationStore.updateConversationTitle(conversationId, title, userId)
    }

    // 灵魂记忆提炼属于非关键后台任务，不能阻塞对话完成事件和输入框解锁。
    void distillSoulIfNeeded({
        userId,
        threshold: config.memoryDistillationThreshold,
        model,
        maxOutputTokens: config.maxTokens
    }).catch((error: unknown) => {
        logger.error('AgentMemory', '灵魂记忆自动提炼失败', { error })
    })

    logger.info('Agent', '模型流式响应结束', {
        durationMs: Date.now() - startedAt,
        assistantMessageLength: fullResponse.length,
        thinkingLength: firstPhaseThinking.length,
        thinkingDurationMs,
        totalTokens,
        toolResultCount
    })
    return conversationId
}
