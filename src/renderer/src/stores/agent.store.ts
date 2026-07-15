/**
 * 智能体状态管理
 *
 * 消息模型：user → tool × N → assistant
 * 后端通过 message/chunk/done 三种事件驱动前端渲染。
 * 每条 message 是完整原子单元，与 DB 持久化结构一致。
 *
 * @author xiangwei
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { desktopApi } from '../api/desktop-api'
import type {
    AgentConfig,
    AgentMessageCursor,
    AgentToolInfo,
    ConversationCursor,
    ConversationDetail,
    ConversationListItem,
    McpConnectionResult,
    McpServerConfig,
    McpServerInput,
    SkillMeta,
    SkillDetail,
    StreamEvent
} from '@shared/types'
import { DEFAULT_MEMORY_DISTILLATION_THRESHOLD } from '../../../shared/types/agent'
import {
    captureUserRequestGeneration,
    isUserRequestCurrent
} from '../app/session/user-request-generation'

/** 消息角色 */
type AgentMsgRole = 'user' | 'assistant' | 'tool'

/** 消息条目 */
export interface AgentMsg {
    id: string
    role: AgentMsgRole
    content: string
    toolName?: string
    toolArgs?: string
    isStreaming?: boolean
    thinking?: string
}

let _seq = 0
function uid(): string {
    return `msg_${Date.now()}_${++_seq}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 为流式对话错误追加可检索的日志编号
 *
 * @param event 智能体流式事件
 * @returns 面向用户的错误信息
 * @author xiangwei
 */
function formatStreamError(event: StreamEvent): string {
    const errorMessage = event.error || '处理出错'
    return event.traceId ? `${errorMessage}（排查编号：${event.traceId}）` : errorMessage
}

export const useAgentStore = defineStore('agent', () => {
    const config = ref<AgentConfig>({
        apiKey: '',
        model: 'deepseek-v4-flash',
        temperature: 0.7,
        maxTokens: 4096,
        memoryDistillationThreshold: DEFAULT_MEMORY_DISTILLATION_THRESHOLD,
        enabled: false
    })

    const conversations = ref<ConversationListItem[]>([])
    const localTools = ref<AgentToolInfo[]>([])
    const skills = ref<SkillMeta[]>([])
    const skillDetails = ref<Map<string, SkillDetail>>(new Map())
    const mcpServers = ref<McpServerConfig[]>([])
    const mcpConnectionResults = ref<Record<string, McpConnectionResult>>({})
    const mcpConnectionErrors = ref<Record<string, string>>({})
    const currentConversationId = ref<string | null>(null)
    const messages = ref<AgentMsg[]>([])
    const isProcessing = ref(false)
    const currentThinking = ref('')
    const deepThink = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isLoadingMessages = ref(false)
    const messageError = ref<string | null>(null)
    const nextMessageCursor = ref<AgentMessageCursor | null>(null)
    const nextConversationCursor = ref<ConversationCursor | null>(null)
    const loadingMoreConversations = ref(false)

    /** 工具调用次数（按工具显示名累计，用户级别） */
    const toolCallCounts = ref<Record<string, number>>({})

    const hasConfig = computed(() => !!config.value.apiKey && config.value.enabled)

    let cleanupListener: (() => void) | null = null
    let initializeRequestId = 0
    let conversationRequestId = 0

    /**
     * 持久化工具调用次数到后端
     * @author xiangwei
     */
    function persistToolCallCounts(): void {
        desktopApi.agent.setToolCallCounts({ ...toolCallCounts.value }).catch(() => {
            // 静默失败，不影响用户操作
        })
    }

    /**
     * 处理主进程推送的流式事件
     *
     * @param event 流式事件
     * @author xiangwei
     */
    function handleStreamEvent(event: StreamEvent): void {
        switch (event.type) {
            case 'message': {
                const message = event.message
                if (!message || message.role === 'user') break
                const existing = messages.value.find((item) => item.id === message.id)
                if (existing) {
                    existing.content = message.content || ''
                    existing.toolName = message.tool_used
                } else {
                    messages.value.push({
                        id: message.id,
                        role: message.role === 'tool' ? 'tool' : 'assistant',
                        content: message.content || '',
                        toolName: message.tool_used,
                        isStreaming: message.streaming ?? false,
                        thinking: deepThink.value ? message.thinking || undefined : undefined
                    })
                }
                if (message.role === 'tool' && message.tool_used) {
                    const name = message.tool_used
                    toolCallCounts.value[name] = (toolCallCounts.value[name] || 0) + 1
                    persistToolCallCounts()
                }
                break
            }
            case 'chunk': {
                if (!event.content || !event.id) break
                const target = messages.value.find((item) => item.id === event.id)
                if (target) target.content += event.content
                break
            }
            case 'thinking':
                currentThinking.value = event.content || ''
                break
            case 'done':
                for (const message of messages.value) {
                    if (message.isStreaming) message.isStreaming = false
                }
                isProcessing.value = false
                currentConversationId.value = event.conversationId || currentConversationId.value
                void refreshConversationList()
                break
            case 'error': {
                const errorMessage = formatStreamError(event)
                const lastMessage = messages.value.at(-1)
                if (lastMessage?.role === 'assistant') {
                    lastMessage.content += `\n\n${errorMessage}`
                    lastMessage.isStreaming = false
                } else {
                    messages.value.push({
                        id: uid(),
                        role: 'assistant',
                        content: errorMessage
                    })
                }
                isProcessing.value = false
                break
            }
        }
    }

    /**
     * 确保流式事件监听在 Store 生命周期内持续存在
     *
     * @author xiangwei
     */
    function ensureStreamListener(): void {
        if (cleanupListener) return
        cleanupListener = desktopApi.agent.onEvent(handleStreamEvent)
    }

    /**
     * 刷新当前用户的会话摘要列表
     *
     * @author xiangwei
     */
    async function refreshConversationList(): Promise<void> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.agent.listConversations()
        if (result.ok && isUserRequestCurrent(generation)) {
            conversations.value = result.data.items
            nextConversationCursor.value = result.data.next_cursor
        }
    }

    /**
     * 加载更多会话摘要
     *
     * @author xiangwei
     */
    async function loadMoreConversations(): Promise<void> {
        const cursor = nextConversationCursor.value
        if (!cursor || loadingMoreConversations.value) return

        const generation = captureUserRequestGeneration()
        loadingMoreConversations.value = true
        const cursorInput: ConversationCursor = {
            updated_at: cursor.updated_at,
            id: cursor.id
        }

        try {
            const result = await desktopApi.agent.listConversations(cursorInput)
            if (!isUserRequestCurrent(generation)) return
            if (!result.ok) {
                error.value = result.error
                return
            }

            const existingIds = new Set(conversations.value.map((conversation) => conversation.id))
            conversations.value.push(
                ...result.data.items.filter((conversation) => !existingIds.has(conversation.id))
            )
            nextConversationCursor.value = result.data.next_cursor
        } catch (requestError: unknown) {
            if (isUserRequestCurrent(generation)) {
                error.value =
                    requestError instanceof Error ? requestError.message : '加载更多会话失败'
            }
        } finally {
            if (isUserRequestCurrent(generation)) loadingMoreConversations.value = false
        }
    }

    /**
     * 只加载导航显隐所需的智能体配置
     *
     * @author xiangwei
     */
    async function loadConfig(): Promise<void> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.agent.getConfig()
        if (result.ok && isUserRequestCurrent(generation)) {
            config.value = result.data
        }
    }

    /**
     * 初始化智能体工作区数据
     *
     * @author xiangwei
     */
    async function initialize(): Promise<void> {
        ensureStreamListener()
        const requestId = ++initializeRequestId
        const generation = captureUserRequestGeneration()
        loading.value = true
        error.value = null
        const [configResult, localToolsResult, skillsResult, convResult, countsResult, mcpResult] =
            await Promise.all([
                desktopApi.agent.getConfig(),
                desktopApi.agent.listLocalTools(),
                desktopApi.agent.listSkills(),
                desktopApi.agent.listConversations(),
                desktopApi.agent.getToolCallCounts(),
                desktopApi.agent.listMcpServers()
            ])
        if (requestId !== initializeRequestId || !isUserRequestCurrent(generation)) return

        if (configResult.ok) config.value = configResult.data
        if (localToolsResult.ok) localTools.value = localToolsResult.data
        if (skillsResult.ok) skills.value = skillsResult.data
        if (convResult.ok) {
            conversations.value = convResult.data.items
            nextConversationCursor.value = convResult.data.next_cursor
        }
        if (countsResult.ok) {
            toolCallCounts.value = countsResult.data || {}
        }
        if (mcpResult.ok) mcpServers.value = mcpResult.data
        const failedResult = [
            configResult,
            localToolsResult,
            skillsResult,
            convResult,
            countsResult,
            mcpResult
        ].find((result) => !result.ok)
        if (failedResult && !failedResult.ok) error.value = failedResult.error
        loading.value = false
    }

    /**
     * 发送消息（流式）
     *
     * 后端事件流：
     *   message(user) → thinking → message(tool)×N → message(assistant) → chunk×N → done
     *
     * @author xiangwei
     */
    async function sendMessage(message: string): Promise<void> {
        if (!message.trim() || isProcessing.value) return

        ensureStreamListener()
        isProcessing.value = true
        currentThinking.value = ''

        // 本地先添加用户消息（即时反馈，后端也会发但会跳过）
        messages.value.push({ id: uid(), role: 'user', content: message })

        const result = await desktopApi.agent.chat(currentConversationId.value, message)

        if (!result.ok) {
            messages.value.push({
                id: uid(),
                role: 'assistant',
                content: `❌ ${result.error || '发送失败'}`
            })
            isProcessing.value = false
        }
    }

    function newConversation(): void {
        if (isProcessing.value) return
        currentConversationId.value = null
        messages.value = []
        currentThinking.value = ''
        nextMessageCursor.value = null
        messageError.value = null
    }

    /**
     * 将持久化消息转换为页面消息模型
     *
     * @param conversation 会话详情
     * @returns 页面消息列表
     * @author xiangwei
     */
    function mapConversationMessages(conversation: ConversationDetail): AgentMsg[] {
        return conversation.messages.map((message) => ({
            id: message.id,
            role: message.role === 'tool' ? 'tool' : message.role === 'user' ? 'user' : 'assistant',
            content: message.content,
            toolName: message.tool_used,
            thinking: message.thinking
        }))
    }

    /**
     * 加载会话的最近一页消息
     *
     * @param id 会话 ID
     * @returns 是否加载成功
     * @author xiangwei
     */
    async function loadConversation(id: string): Promise<boolean> {
        if (isProcessing.value) return false
        const requestId = ++conversationRequestId
        const generation = captureUserRequestGeneration()
        isLoadingMessages.value = true
        messageError.value = null
        const result = await desktopApi.agent.getConversation(id)
        if (requestId !== conversationRequestId || !isUserRequestCurrent(generation)) return false

        isLoadingMessages.value = false
        if (!result.ok || !result.data) {
            messageError.value = result.ok ? '会话不存在' : result.error
            return false
        }

        currentConversationId.value = result.data.id
        messages.value = mapConversationMessages(result.data)
        nextMessageCursor.value = result.data.next_cursor
        return true
    }

    /**
     * 向前加载当前会话的更早消息
     *
     * @returns 新增的消息数量
     * @author xiangwei
     */
    async function loadOlderMessages(): Promise<number> {
        const conversationId = currentConversationId.value
        const cursor = nextMessageCursor.value
        if (!conversationId || !cursor || isLoadingMessages.value) return 0

        const requestId = conversationRequestId
        const generation = captureUserRequestGeneration()
        isLoadingMessages.value = true
        messageError.value = null
        const cursorInput: AgentMessageCursor = {
            created_at: cursor.created_at,
            id: cursor.id
        }

        try {
            const result = await desktopApi.agent.getConversation(conversationId, cursorInput)
            if (
                requestId !== conversationRequestId ||
                conversationId !== currentConversationId.value ||
                !isUserRequestCurrent(generation)
            ) {
                return 0
            }

            if (!result.ok || !result.data) {
                messageError.value = result.ok ? '会话不存在' : result.error
                return 0
            }

            const existingIds = new Set(messages.value.map((message) => message.id))
            const olderMessages = mapConversationMessages(result.data).filter(
                (message) => !existingIds.has(message.id)
            )
            messages.value = [...olderMessages, ...messages.value]
            nextMessageCursor.value = result.data.next_cursor
            return olderMessages.length
        } catch (requestError: unknown) {
            if (
                requestId === conversationRequestId &&
                conversationId === currentConversationId.value &&
                isUserRequestCurrent(generation)
            ) {
                messageError.value =
                    requestError instanceof Error ? requestError.message : '加载更早消息失败'
            }
            return 0
        } finally {
            if (
                requestId === conversationRequestId &&
                conversationId === currentConversationId.value &&
                isUserRequestCurrent(generation)
            ) {
                isLoadingMessages.value = false
            }
        }
    }

    async function deleteConversation(id: string): Promise<void> {
        const result = await desktopApi.agent.deleteConversation(id)
        if (!result.ok) return
        conversations.value = conversations.value.filter((c) => c.id !== id)
        if (currentConversationId.value === id) newConversation()
    }

    /**
     * 重命名会话
     * @param id 会话 ID
     * @param title 新标题
     * @author xiangwei
     */
    async function renameConversation(id: string, title: string): Promise<boolean> {
        const result = await desktopApi.agent.renameConversation(id, title)
        if (!result.ok) return false
        const conv = conversations.value.find((c) => c.id === id)
        if (conv) conv.title = title
        return true
    }

    async function saveConfig(newConfig: Partial<AgentConfig>): Promise<boolean> {
        const result = await desktopApi.agent.updateConfig(newConfig)
        if (!result.ok) return false
        Object.assign(config.value, newConfig)
        return true
    }

    /**
     * 刷新本地工具目录
     *
     * @returns 是否加载成功
     * @author xiangwei
     */
    async function refreshLocalTools(): Promise<boolean> {
        const result = await desktopApi.agent.listLocalTools()
        if (!result.ok) return false
        localTools.value = result.data
        return true
    }

    async function refreshSkills(): Promise<void> {
        await desktopApi.agent.reloadSkills()
        const result = await desktopApi.agent.listSkills()
        if (result.ok) skills.value = result.data as SkillMeta[]
    }

    async function createSkill(data: {
        name: string
        displayName: string
        description: string
        markdown: string
    }): Promise<boolean> {
        const result = await desktopApi.agent.createSkill(data)
        if (!result.ok) return false
        await refreshSkills()
        return true
    }

    async function deleteSkill(name: string): Promise<boolean> {
        const result = await desktopApi.agent.deleteSkill(name)
        if (!result.ok) return false
        await refreshSkills()
        return true
    }

    async function toggleSkill(name: string, enabled: boolean): Promise<void> {
        const result = await desktopApi.agent.toggleSkill(name, enabled)
        if (!result.ok) return
        const idx = skills.value.findIndex((s) => s.name === name)
        if (idx >= 0) skills.value[idx] = { ...skills.value[idx], isEnabled: enabled }
    }

    async function loadSkillDetail(name: string): Promise<SkillDetail | null> {
        const cached = skillDetails.value.get(name)
        if (cached) return cached
        const result = await desktopApi.agent.getSkillDetail(name)
        if (!result.ok) return null
        const detail = result.data as SkillDetail
        skillDetails.value.set(name, detail)
        return detail
    }

    function getCachedSkillDetail(name: string): SkillDetail | null {
        return skillDetails.value.get(name) ?? null
    }

    /**
     * 刷新 MCP 服务配置列表
     *
     * @returns 是否加载成功
     * @author xiangwei
     */
    async function refreshMcpServers(): Promise<boolean> {
        const result = await desktopApi.agent.listMcpServers()
        if (!result.ok) return false
        mcpServers.value = result.data
        return true
    }

    /**
     * 新增或更新 MCP 服务
     *
     * @param server MCP 服务参数
     * @returns 是否保存成功
     * @author xiangwei
     */
    async function saveMcpServer(server: McpServerInput): Promise<boolean> {
        const result = await desktopApi.agent.saveMcpServer(server)
        if (!result.ok) return false
        mcpServers.value = result.data
        if (server.previousName) delete mcpConnectionResults.value[server.previousName]
        if (server.previousName) delete mcpConnectionErrors.value[server.previousName]
        delete mcpConnectionResults.value[server.name]
        delete mcpConnectionErrors.value[server.name]
        return true
    }

    /**
     * 删除 MCP 服务
     *
     * @param name 服务名称
     * @returns 是否删除成功
     * @author xiangwei
     */
    async function deleteMcpServer(name: string): Promise<boolean> {
        const result = await desktopApi.agent.deleteMcpServer(name)
        if (!result.ok) return false
        mcpServers.value = result.data
        delete mcpConnectionResults.value[name]
        delete mcpConnectionErrors.value[name]
        return true
    }

    /**
     * 更新 MCP 服务启用状态
     *
     * @param name 服务名称
     * @param enabled 是否启用
     * @returns 是否保存成功
     * @author xiangwei
     */
    async function toggleMcpServer(name: string, enabled: boolean): Promise<boolean> {
        const result = await desktopApi.agent.toggleMcpServer(name, enabled)
        if (!result.ok) return false
        mcpServers.value = result.data
        if (!enabled) {
            delete mcpConnectionResults.value[name]
            delete mcpConnectionErrors.value[name]
        }
        return true
    }

    /**
     * 连接 MCP 服务并发现工具
     *
     * @param name 服务名称
     * @returns 连接结果，失败时返回 null
     * @author xiangwei
     */
    async function inspectMcpServer(name: string): Promise<McpConnectionResult | null> {
        const result = await desktopApi.agent.inspectMcpServer(name)
        if (!result.ok) {
            mcpConnectionErrors.value[name] = result.error
            delete mcpConnectionResults.value[name]
            return null
        }
        mcpConnectionResults.value[name] = result.data
        delete mcpConnectionErrors.value[name]
        return result.data
    }

    function dispose(): void {
        if (cleanupListener) {
            cleanupListener()
            cleanupListener = null
        }
    }

    /**
     * 重置所有用户相关数据（切换用户时调用）
     * @author xiangwei
     */
    function reset(): void {
        initializeRequestId++
        conversationRequestId++
        dispose()
        conversations.value = []
        localTools.value = []
        nextConversationCursor.value = null
        loadingMoreConversations.value = false
        skills.value = []
        skillDetails.value = new Map()
        mcpServers.value = []
        mcpConnectionResults.value = {}
        mcpConnectionErrors.value = {}
        currentConversationId.value = null
        messages.value = []
        isProcessing.value = false
        currentThinking.value = ''
        toolCallCounts.value = {}
        loading.value = false
        error.value = null
        isLoadingMessages.value = false
        messageError.value = null
        nextMessageCursor.value = null
    }

    return {
        config,
        conversations,
        localTools,
        skills,
        skillDetails,
        mcpServers,
        mcpConnectionResults,
        mcpConnectionErrors,
        currentConversationId,
        messages,
        toolCallCounts,
        isProcessing,
        currentThinking,
        deepThink,
        loading,
        error,
        isLoadingMessages,
        messageError,
        nextMessageCursor,
        nextConversationCursor,
        loadingMoreConversations,
        hasConfig,
        loadConfig,
        initialize,
        loadMoreConversations,
        sendMessage,
        newConversation,
        loadConversation,
        loadOlderMessages,
        deleteConversation,
        renameConversation,
        saveConfig,
        refreshLocalTools,
        refreshSkills,
        toggleSkill,
        loadSkillDetail,
        getCachedSkillDetail,
        createSkill,
        deleteSkill,
        refreshMcpServers,
        saveMcpServer,
        deleteMcpServer,
        toggleMcpServer,
        inspectMcpServer,
        dispose,
        reset
    }
})
