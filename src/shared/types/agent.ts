/**
 * AI 智能体共享类型定义（Skill 驱动架构）
 * @author xiangwei
 */

import type { IpcResult } from './api'

// ========== Skill 相关 ==========

export interface SkillMeta {
    name: string
    displayName: string
    description: string
    version: string
    author?: string
    isSystem: boolean
    isEnabled: boolean
}

/** Agent 工具展示信息 */
export interface AgentToolInfo {
    name: string
    description: string
    parameters: Record<string, unknown>
}

// ========== MCP 相关 ==========

/** MCP 服务配置 */
export interface McpServerConfig {
    name: string
    url: string
    headers: Record<string, string>
    enabled: boolean
    isDefault: boolean
}

/** MCP 服务新增或更新参数 */
export interface McpServerInput {
    previousName?: string
    name: string
    url: string
    headers: Record<string, string>
    enabled: boolean
}

/** MCP 服务提供的工具摘要 */
export interface McpToolInfo {
    serverName: string
    name: string
    description: string
}

/** MCP 服务连接检测结果 */
export interface McpConnectionResult {
    serverName: string
    serverDisplayName: string
    serverVersion: string
    tools: McpToolInfo[]
}

// ========== 对话相关 ==========

/** 默认记忆提炼阈值 */
export const DEFAULT_MEMORY_DISTILLATION_THRESHOLD = 10

/** 最小记忆提炼阈值 */
export const MIN_MEMORY_DISTILLATION_THRESHOLD = 1

/** 最大记忆提炼阈值 */
export const MAX_MEMORY_DISTILLATION_THRESHOLD = 50

/** 默认最大工具调用步数 */
export const DEFAULT_MAX_AGENT_STEPS = 20

/** 最小最大工具调用步数 */
export const MIN_MAX_AGENT_STEPS = 1

/** 最大最大工具调用步数 */
export const MAX_MAX_AGENT_STEPS = 50

export interface AgentConfig {
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    memoryDistillationThreshold: number
    enabled: boolean
    maxSteps: number
}

/** 允许下载和加载的本地语音模型 ID */
export const STT_MODEL_IDS = [
    'Xenova/whisper-tiny',
    'Xenova/whisper-base',
    'Xenova/whisper-small',
    'Xenova/whisper-medium'
] as const

/** 本地语音模型 ID */
export type SttModelId = (typeof STT_MODEL_IDS)[number]

/** 本地语音模型列表 */
export const STT_MODELS: ReadonlyArray<{
    id: SttModelId
    name: string
    size: string
    desc: string
}> = [
    { id: STT_MODEL_IDS[0], name: 'tiny', size: '~75MB', desc: '速度最快，适合轻量使用' },
    {
        id: STT_MODEL_IDS[1],
        name: 'base',
        size: '~150MB',
        desc: '速度和准确率平衡（默认）'
    },
    {
        id: STT_MODEL_IDS[2],
        name: 'small',
        size: '~466MB',
        desc: '中文识别质量明显提升'
    },
    { id: STT_MODEL_IDS[3], name: 'medium', size: '~1.5GB', desc: '最高准确率，需较好硬件' }
]

export interface Conversation {
    id: string
    user_id: string
    title: string
    message_count: number
    model: string | null
    source: 'desktop' | 'wechat'
    created_at: string
    updated_at: string
}

export interface ConversationListItem {
    id: string
    title: string
    message_count: number
    last_message: string | null
    total_tokens: number
    model: string | null
    source: 'desktop' | 'wechat'
    updated_at: string
}

/** 会话摘要分页游标 */
export interface ConversationCursor {
    updated_at: string
    id: string
}

/** 会话摘要分页结果 */
export interface ConversationListPage {
    items: ConversationListItem[]
    next_cursor: ConversationCursor | null
}

export interface AgentChatMessage {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    skill_used?: string
    skill_display_name?: string
    tool_used?: string
    tool_args?: string
    tool_result?: string
    thinking?: string
    thinking_duration_ms?: number
    created_at: string
}

/** 智能体消息分页游标 */
export interface AgentMessageCursor {
    created_at: string
    id: string
}

/** 会话详情及最近一页消息 */
export interface ConversationDetail extends Conversation {
    messages: AgentChatMessage[]
    next_cursor: AgentMessageCursor | null
}

// ========== 结构化数据 ==========

/**
 * 支持的结构化数据块类型
 * - table：二维表格（如流水列表、分类对比）
 * - chart：图表（如月度趋势、分类占比）
 * - card：摘要卡片（如余额总览、单条流水详情）
 * - file：文件条目（可点击打开）
 */
export type StructuredDataType = 'table' | 'chart' | 'card' | 'file'

/** 表格结构化数据 */
export interface StructuredTableData {
    title?: string
    columns: string[]
    rows: string[][]
}

/** 图表结构化数据 */
export interface StructuredChartData {
    title?: string
    type: 'pie' | 'bar' | 'line'
    labels: string[]
    datasets: Array<{
        name: string
        values: number[]
    }>
}

/** 卡片结构化数据 */
export interface StructuredCardData {
    title?: string
    fields: Array<{
        label: string
        value: string
        /** 可选语义色：positive / negative / neutral */
        color?: string
    }>
}

/** 文件结构化数据 */
export interface StructuredFileData {
    /** 文件路径（绝对路径） */
    path: string
    /** 操作：created / modified / deleted / ran */
    action: string
    /** 文件大小（可选，字节） */
    size?: number
}

/** 结构化数据条目（前端解析或后端发射的统一格式） */
export interface StructuredDataEntry {
    data_type: StructuredDataType
    data: StructuredTableData | StructuredChartData | StructuredCardData | StructuredFileData
}

// ========== 流式事件 ==========

/** 工具确认请求详情 */
export interface ConfirmationDetail {
    /** 确认标题 */
    title: string
    /** 确认描述 */
    description: string
    /** 要执行的命令（executeCommand 时） */
    command?: string
    /** 要操作的文件路径（editFile 时） */
    filePath?: string
    /** 操作类型 */
    action: string
}

export type StreamEventType =
    | 'message'
    | 'thinking'
    | 'skill_selected'
    | 'tool_called'
    | 'tool_result'
    | 'chunk'
    | 'done'
    | 'error'
    | 'task_update'
    | 'structured_data'
    | 'confirmation_request'

/** 智能体任务清单条目（2 状态：pending / completed） */
export interface AgentTaskInfo {
    id: string
    title: string
    status: 'pending' | 'completed'
    sort_order: number
}

export interface StreamEvent {
    type: StreamEventType
    /** 事件来源，微信事件会同步到当前桌面会话 */
    source?: 'desktop' | 'wechat'
    /** 可用于关联本轮智能体对话日志的排查编号 */
    traceId?: string
    content?: string
    skillName?: string
    displayName?: string
    toolName?: string
    toolArgs?: Record<string, unknown>
    toolResult?: unknown
    conversationId?: string
    error?: string
    /** message 事件携带的消息体 */
    message?: {
        id: string
        role: string
        content: string
        tool_used?: string
        streaming?: boolean
        thinking?: string
        thinking_duration_ms?: number
        /** 结构化数据标记，前端据此选择渲染组件 */
        data_type?: StructuredDataType
        /** 结构化的载荷数据，与 data_type 配对使用 */
        structured_data?:
            StructuredTableData | StructuredChartData | StructuredCardData | StructuredFileData
    }
    /** chunk 事件携带的增量数据 */
    id?: string
    /** task_update 事件携带的当前会话全量任务列表 */
    tasks?: AgentTaskInfo[]
    /** structured_data 事件携带的结构化条目列表 */
    structured_entries?: StructuredDataEntry[]
    /** confirmation_request 事件携带的确认请求 ID */
    confirmId?: string
    /** confirmation_request 事件携带的确认详情 */
    confirmDetail?: ConfirmationDetail
}

/** 智能体回答被用户主动取消时的统一消息 */
export const AGENT_CHAT_CANCELLED_MESSAGE = '对话已取消'

// ========== 微信渠道 ==========

/** 微信渠道连接阶段 */
export type WechatConnectionPhase =
    'disconnected' | 'connecting' | 'awaiting_scan' | 'scanned' | 'connected' | 'error'

/** 微信渠道连接状态 */
export interface WechatConnectionStatus {
    userId: string
    phase: WechatConnectionPhase
    qrCodeDataUrl?: string
    conversationId?: string
    accountId?: string
    error?: string
}

// ========== STT 进度事件 ==========

export interface SttProgressEvent {
    status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'error'
    file?: string
    progress?: number
    loaded?: number
    total?: number
    error?: string
}

// ========== Agent API 声明 ==========

export interface AgentAPI {
    chat: (
        conversationId: string | null,
        message: string,
        deepThink: boolean
    ) => Promise<IpcResult<string>>
    cancelChat: () => Promise<IpcResult>
    listConversations: (cursor?: ConversationCursor) => Promise<IpcResult<ConversationListPage>>
    deleteConversation: (id: string) => Promise<IpcResult>
    getConversation: (
        id: string,
        cursor?: AgentMessageCursor
    ) => Promise<IpcResult<ConversationDetail | null>>
    getConfig: () => Promise<IpcResult<AgentConfig>>
    updateConfig: (config: Partial<AgentConfig>) => Promise<IpcResult>
    listLocalTools: () => Promise<IpcResult<AgentToolInfo[]>>
    listSkills: () => Promise<IpcResult<SkillMeta[]>>
    getSkillDetail: (name: string) => Promise<IpcResult<SkillDetail>>
    reloadSkills: () => Promise<IpcResult>
    toggleSkill: (name: string, enabled: boolean) => Promise<IpcResult>
    createSkill: (data: {
        name: string
        displayName: string
        description: string
        markdown: string
    }) => Promise<IpcResult>
    deleteSkill: (name: string) => Promise<IpcResult>
    listMcpServers: () => Promise<IpcResult<McpServerConfig[]>>
    saveMcpServer: (server: McpServerInput) => Promise<IpcResult<McpServerConfig[]>>
    deleteMcpServer: (name: string) => Promise<IpcResult<McpServerConfig[]>>
    toggleMcpServer: (name: string, enabled: boolean) => Promise<IpcResult<McpServerConfig[]>>
    inspectMcpServer: (name: string) => Promise<IpcResult<McpConnectionResult>>
    renameConversation: (id: string, title: string) => Promise<IpcResult>
    getToolCallCounts: () => Promise<IpcResult<Record<string, number>>>
    setToolCallCounts: (counts: Record<string, number>) => Promise<IpcResult>
    /** 语音转文字——接收音频 Float32Array Buffer，返回转录文本 */
    transcribeAudio: (buffer: ArrayBuffer) => Promise<IpcResult<string>>
    /** 语音转文字进度事件监听 */
    onTranscribeProgress: (callback: (event: SttProgressEvent) => void) => () => void
    /** 下载 STT 模型（触发下载，进度由 onTranscribeProgress 推送） */
    sttDownloadModel: (modelId: string) => Promise<IpcResult>
    /** 查询 STT 模型状态（可选指定 modelId 检查特定模型是否就绪） */
    sttModelStatus: (modelId?: string) => Promise<
        IpcResult<{
            status: 'none' | 'loading' | 'ready' | 'error'
            currentModel: string | null
            error: string | null
            cached: boolean
            models: Array<{ id: string; name: string; size: string; desc: string }>
        }>
    >
    /** 删除已下载的 STT 模型缓存 */
    sttDeleteModel: (modelId: string) => Promise<IpcResult<boolean>>
    /** 发起微信扫码连接 */
    connectWechat: () => Promise<IpcResult<WechatConnectionStatus>>
    /** 断开微信并清除当前用户的连接凭证 */
    disconnectWechat: () => Promise<IpcResult<WechatConnectionStatus>>
    /** 获取微信渠道状态，已有凭证时自动恢复消息监听 */
    getWechatStatus: () => Promise<IpcResult<WechatConnectionStatus>>
    /** 微信渠道状态事件监听 */
    onWechatStatus: (callback: (status: WechatConnectionStatus) => void) => () => void
    /** 事件监听（流式） */
    onEvent: (callback: (event: StreamEvent) => void) => () => void
    /** 查询指定会话的智能体任务清单 */
    listTasks: (conversationId: string) => Promise<IpcResult<AgentTaskInfo[]>>
    /** 清空指定会话的智能体任务清单 */
    clearTasks: (conversationId: string) => Promise<IpcResult>
    /** 确认或拒绝危险工具操作 */
    confirmTool: (confirmId: string, approved: boolean) => Promise<IpcResult>
}

export interface SkillDetail {
    meta: SkillMeta
    markdown: string
}
