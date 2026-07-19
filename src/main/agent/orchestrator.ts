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
import { summarizeConversationIfNeeded } from './memory/conversation-summarizer'
import { loadAgentConfig } from './agent-config'
import type { AgentConfig } from '@shared/types'
import type { EventEmitter } from './agent-run-context'
import { logger, runWithLogContext } from '../utils/logger'
import { summarizeLogValue } from '../utils/log-sanitizer'
import { closeMcpClients, loadMcpRuntimeTools } from './mcp-service'
import { getRuntimeSystemInfo } from './runtime-system-info'
import type { RuntimeSystemInfo } from './runtime-system-info'
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
    updateUserTodo: '修改待办',
    executeCommand: '执行命令',
    editFile: '编辑文件'
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
        const { conversationId: resolvedConversationId, source } = await resolveConversationId(
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
                    source,
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
 * @returns 会话 ID 与来源
 * @author xiangwei
 */
async function resolveConversationId(
    conversationId: string | null,
    userId: string,
    model: string
): Promise<{ conversationId: string; source: 'desktop' | 'wechat' }> {
    if (!conversationId) {
        const newId = await conversationStore.createConversation(userId, undefined, model)
        return { conversationId: newId, source: 'desktop' }
    }
    if (!(await conversationStore.conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    const source = await conversationStore.getConversationSource(conversationId, userId)
    return { conversationId, source: source ?? 'desktop' }
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
/**
 * 构建桌面端用户消息后缀（含运行时上下文、执行协议与结构化输出指令）
 *
 * @param context 运行时上下文
 * @returns 后缀文本
 * @author xiangwei
 */
function buildDesktopUserInstruction(context: {
    userName: string
    currentDate: string
    currentTime: string
    systemInfo: RuntimeSystemInfo
    profileMemory: string
    soulMemory: string
}): string {
    return `

<context>
当前用户：${context.userName}
当前日期：${context.currentDate}
当前时间：${context.currentTime}
系统信息：
- 操作系统：${context.systemInfo.operatingSystem} ${context.systemInfo.systemRelease}
- 系统架构：${context.systemInfo.architecture}
- 应用版本：${context.systemInfo.appVersion}
- 语言区域：${context.systemInfo.locale}
- 时区：${context.systemInfo.timeZone}
用户画像（profile）：
${context.profileMemory || '暂无用户画像'}
最新灵魂记忆（soul）：
${context.soulMemory || '暂无已提炼的灵魂记忆'}

记忆使用规则：
- 画像和灵魂属于"工作记忆"，每轮自动注入，仅作理解需求的隐性背景。
- 严禁向用户透露记忆的存在，不得说"根据记录""我记得你"。
- 当前输入与记忆冲突时，以当前输入为准。
- 余额、流水、预算等实时数据必须通过工具查询，不得凭记忆回答。
- 如需更新长期记忆，使用 writeLocalMemory 工具，且仅写入用户明确透露的稳定信息。
</context>

<execution_protocol>
1. 识别目标：明确用户真实需求、目标结果以及完成任务所需的信息。仅当缺少无法推断的关键信息时才向用户追问；可以合理推断的信息不得反复确认。

2. 判断能力域：判断用户请求属于哪个能力域，并选择对应执行方式：
   - 流程型任务（记账、报告生成）：必须先调用 getSkill 获取完整流程，再基于 Skill 规则制定执行计划。
   - 原子型任务（数据查询、数学计算、消费分析、待办管理）：无需调用 getSkill，可直接调用对应工具。

3. 分步执行：按顺序执行每一步，每完成一步立即调用 updateAgentTaskStatus 更新状态，完成后及时反馈结果。

4. 验证交付：执行完成后检查结果是否满足用户目标。如果失败，说明已完成部分、失败原因，不编造不存在的结果。
</execution_protocol>

<structured_output>
当你的回复包含适合结构化展示的数据时，使用以下 fenced code block 语法包裹，前端会自动识别并渲染为更美观的组件：

**表格** - 适用于多条行记录（流水列表、分类对比、账户概览）：
\`\`\`bibi-table
{"columns": ["分类", "金额", "占比"], "rows": [["餐饮", "1280.00", "39.5%"], ["交通", "560.00", "17.3%"]], "title": "本月支出分类"}
\`\`\`

**图表** - 适用于趋势、分布等可视化数据（月度趋势、分类占比）：
\`\`\`bibi-chart
{"type": "bar", "labels": ["1月", "2月", "3月"], "datasets": [{"name": "支出", "values": [3200, 2800, 3500]}], "title": "季度支出趋势"}
\`\`\`

**卡片** - 适用于摘要信息（余额总览、关键指标）：
\`\`\`bibi-card
{"title": "账户总览", "fields": [{"label": "总资产", "value": "12,580.00"}, {"label": "本月支出", "value": "3,240.50", "color": "negative"}, {"label": "本月收入", "value": "8,500.00", "color": "positive"}]}
\`\`\`

**文件** - 适用于命令行执行或文件编辑的结果展示（可点击打开文件）：
\`\`\`bibi-file
{"path": "/Users/xxx/bibi/src/test.ts", "action": "modified", "size": 1234}
\`\`\`
action 取值：created（新文件）、modified（已修改）、deleted（已删除）、ran（已执行命令）。

使用规则：
1. 结构化块之后仍保留 1-2 句文字总结。
2. 同一个回复可包含多个结构化块（如先表格后图表）。
3. 普通文字回复不需使用结构化块，仅在有明确行/列数据或可视化场景时使用。
4. 结构化块仅用于数据展示，不用于交互式操作。
</structured_output>`
}

async function runConversation(
    conversationId: string,
    userMessage: string,
    userId: string,
    deepThink: boolean,
    emit: EventEmitter,
    config: AgentRuntimeConfig,
    source: 'desktop' | 'wechat',
    abortSignal?: AbortSignal
): Promise<string> {
    const startedAt = Date.now()
    const enabledSkills = skillRegistry.getEnabledSkills()

    const model = createModel(config.apiKey, config.model)
    const [soulMemory, profileMemory, history, summary, currentUser, mcpRuntime] =
        await Promise.all([
            localMemoryStore.readMemory(userId, 'soul'),
            localMemoryStore.readMemory(userId, 'profile'),
            conversationStore.restoreRecentMessages(
                conversationId,
                userId,
                Math.max(0, config.memoryDistillationThreshold - 1)
            ),
            conversationStore.getConversationSummary(conversationId, userId),
            getUser(userId),
            loadMcpRuntimeTools()
        ])
    if (!currentUser) throw new Error('当前用户不存在')
    const systemInfo = getRuntimeSystemInfo()
    // 检测用户请求是否需要调用工具，若是则在用户消息末尾追加任务规划指令
    // 不使用 system 消息（DeepSeek provider 的 messages 不支持 system 角色）
    const needsToolCall = detectToolCallRequest(userMessage)
    let effectiveUserMessage = userMessage

    // 桌面端：追加运行时上下文、执行协议与结构化输出指令
    if (source === 'desktop') {
        effectiveUserMessage += buildDesktopUserInstruction({
            userName: currentUser.name,
            currentDate: formatSystemDate(new Date()),
            currentTime: formatSystemTime(new Date()),
            systemInfo,
            profileMemory: profileMemory.content,
            soulMemory: soulMemory.content
        })
    }

    // 桌面端：追加任务规划指令，让 AI 先创建任务清单再执行
    if (source === 'desktop' && needsToolCall) {
        effectiveUserMessage += `\n\n[执行要求] 本请求需要调用工具来完成。在调用业务工具之前，先调用 createAgentTasks 创建任务清单让用户看到执行步骤；每完成一步立即调用 updateAgentTaskStatus 更新状态。\n[执行要求]`
    }
    const messages = buildMessages({
        history,
        userMessage: effectiveUserMessage,
        maxUserTurns: config.memoryDistillationThreshold,
        summary
    })
    const enabledSkillNames = new Set(enabledSkills.map((skill) => skill.meta.name))
    const systemPrompt = buildSystemPrompt(
        enabledSkills,
        toolRegistry.getGroupedToolInfos(enabledSkillNames),
        mcpRuntime.toolInfos
    )
    const localTools = toolRegistry.createTools({ userId, conversationId, emit }, enabledSkillNames)
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

    // 灵魂记忆提炼与对话摘要属于非关键后台任务，不能阻塞对话完成事件和输入框解锁。
    void distillSoulIfNeeded({
        userId,
        threshold: config.memoryDistillationThreshold,
        model,
        maxOutputTokens: config.maxTokens
    }).catch((error: unknown) => {
        logger.error('AgentMemory', '灵魂记忆自动提炼失败', { error })
    })
    void summarizeConversationIfNeeded({
        conversationId,
        userId,
        recentUserTurnsToKeep: config.memoryDistillationThreshold,
        model,
        maxOutputTokens: config.maxTokens
    }).catch((error: unknown) => {
        logger.error('AgentMemory', '对话运行摘要生成失败', { error })
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

/** 纯闲聊模式（明确不需要调用工具） */
const CHITCHAT_PATTERNS = [
    /^你好$|^嗨$|^hi$|^hello$|^在吗$/i,
    /^[哈呵呵嘿嘿]+$/,
    /^早[上安安]?$|^晚[上安安]?$|^午[安安好]?$/,
    /^再见$|^拜拜$|^回见$/,
    /^(谢谢|感谢|多谢|3q|thx|thanks)$/i,
    /^(好的|好的吧|行|可以|没问题|ok|okay)$/i,
    /^(嗯|昂|哦|噢|喔|好)$/,
    /^(没什么|没了|没有|算了)$/
]

/** 触发任务规划的用户请求模式（匹配任意一个即需要创建任务清单） */
const TOOL_TRIGGER_PATTERNS = [
    /查|查询|找|搜索|搜/,
    /多少|余额|预算|统计|汇总|合计/,
    /记|记账|流水|收支|花费|支出|收入/,
    /对比|比较|差别|差异/,
    /分析|趋势|异常|变化/,
    /报告|月报|周报|年报|总结/,
    /生成|创建|制作/,
    /删|删除|修改|更新/,
    /分类|分月|分周|逐年|全部|每个/,
    /为什么|原因|怎么回事/,
    /检查|审核|核对|对账/,
    /建议|优化|方案/,
    /待办|todo|任务/,
    /转|转账|调账|调/,
    /这个月|上个月|这周|上周|今年|去年/,
    /\d{4}年|\d{1,2}月|\d{1,2}日|最近/
]

/**
 * 检测用户请求是否需要调用工具
 *
 * @param message 用户消息
 * @returns 是否需要任务规划
 * @author xiangwei
 */
function detectToolCallRequest(message: string): boolean {
    const normalized = message.trim().toLowerCase()

    // 纯闲聊直接跳过
    for (const pattern of CHITCHAT_PATTERNS) {
        if (pattern.test(normalized)) return false
    }

    // 触发工具调用的模式
    for (const pattern of TOOL_TRIGGER_PATTERNS) {
        if (pattern.test(normalized)) return true
    }

    // 默认：消息长度超过 10 个字就视为需要工具调用
    return normalized.length > 10
}

/**
 * 格式化 System Prompt 使用的本地日期
 *
 * @param date 日期
 * @returns 中文日期
 * @author xiangwei
 */
function formatSystemDate(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 格式化 System Prompt 使用的本地时间
 *
 * @param date 日期
 * @returns HH:mm 时间
 * @author xiangwei
 */
function formatSystemTime(date: Date): string {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
}
