import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AGENT_CHAT_CANCELLED_MESSAGE } from '../../src/shared/types'
import type { StreamEvent, WechatConnectionStatus } from '../../src/shared/types'

let streamListener: ((event: StreamEvent) => void) | null = null
let wechatStatusListener: ((status: WechatConnectionStatus) => void) | null = null

const desktopApiMock = vi.hoisted(() => ({
    agent: {
        getConfig: vi.fn(),
        listLocalTools: vi.fn(),
        listSkills: vi.fn(),
        listConversations: vi.fn(),
        getConversation: vi.fn(),
        getToolCallCounts: vi.fn(),
        listMcpServers: vi.fn(),
        setToolCallCounts: vi.fn(),
        onEvent: vi.fn(),
        chat: vi.fn(),
        cancelChat: vi.fn(),
        getWechatStatus: vi.fn(),
        connectWechat: vi.fn(),
        disconnectWechat: vi.fn(),
        onWechatStatus: vi.fn()
    }
}))

vi.mock('../../src/renderer/src/api/desktop-api', () => ({
    desktopApi: desktopApiMock
}))

import { useAgentStore } from '../../src/renderer/src/stores/agent.store'

describe('智能体流监听生命周期', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
        streamListener = null
        wechatStatusListener = null
        desktopApiMock.agent.getConfig.mockResolvedValue({
            ok: true,
            data: {
                apiKey: 'test-key',
                model: 'deepseek-v4-flash',
                temperature: 0.7,
                maxTokens: 4096,
                memoryDistillationThreshold: 10,
                enabled: true
            }
        })
        desktopApiMock.agent.listLocalTools.mockResolvedValue({
            ok: true,
            data: [
                {
                    name: 'readLocalMemory',
                    description: '读取本地记忆',
                    parameters: {}
                }
            ]
        })
        desktopApiMock.agent.listSkills.mockResolvedValue({ ok: true, data: [] })
        desktopApiMock.agent.listConversations.mockResolvedValue({
            ok: true,
            data: { items: [], next_cursor: null }
        })
        desktopApiMock.agent.getToolCallCounts.mockResolvedValue({ ok: true, data: {} })
        desktopApiMock.agent.listMcpServers.mockResolvedValue({ ok: true, data: [] })
        desktopApiMock.agent.setToolCallCounts.mockResolvedValue({ ok: true })
        desktopApiMock.agent.chat.mockResolvedValue({ ok: true, data: 'started' })
        desktopApiMock.agent.cancelChat.mockResolvedValue({ ok: true })
        desktopApiMock.agent.getWechatStatus.mockResolvedValue({
            ok: true,
            data: { userId: 'user-1', phase: 'disconnected' }
        })
        desktopApiMock.agent.connectWechat.mockResolvedValue({
            ok: true,
            data: { userId: 'user-1', phase: 'connecting' }
        })
        desktopApiMock.agent.disconnectWechat.mockResolvedValue({
            ok: true,
            data: { userId: 'user-1', phase: 'disconnected' }
        })
        desktopApiMock.agent.getConversation.mockResolvedValue({ ok: true, data: null })
        desktopApiMock.agent.onEvent.mockImplementation(
            (listener: (event: StreamEvent) => void) => {
                streamListener = listener
                return vi.fn()
            }
        )
        desktopApiMock.agent.onWechatStatus.mockImplementation(
            (listener: (status: WechatConnectionStatus) => void) => {
                wechatStatusListener = listener
                return vi.fn()
            }
        )
    })

    it('重复进入页面不重复订阅且离开后仍持续接收输出', async () => {
        const store = useAgentStore()
        await store.initialize()
        await store.initialize()
        expect(desktopApiMock.agent.onEvent).toHaveBeenCalledTimes(1)
        expect(store.localTools.map((tool) => tool.name)).toEqual(['readLocalMemory'])

        store.deepThink = true
        await store.sendMessage('继续分析')
        expect(desktopApiMock.agent.chat).toHaveBeenCalledWith(null, '继续分析', true)
        expect(store.isAwaitingResponse).toBe(true)
        streamListener?.({
            type: 'message',
            message: {
                id: 'assistant-1',
                role: 'assistant',
                content: '持',
                streaming: true,
                thinking: '正在分析问题',
                thinking_duration_ms: 1_234
            }
        })
        expect(store.isAwaitingResponse).toBe(false)
        expect(store.messages.at(-1)?.thinking).toBe('正在分析问题')
        expect(store.messages.at(-1)?.thinkingDurationMs).toBe(1_234)
        streamListener?.({ type: 'chunk', id: 'assistant-1', content: '续输出' })

        expect(store.messages.at(-1)?.content).toBe('持续输出')
        expect(store.isProcessing).toBe(true)

        streamListener?.({ type: 'chunk', id: 'assistant-1', content: '中' })
        streamListener?.({ type: 'done', conversationId: 'conversation-1' })

        expect(store.messages.at(-1)?.content).toBe('持续输出中')
        expect(store.currentConversationId).toBe('conversation-1')
        expect(store.isProcessing).toBe(false)
        expect(store.isAwaitingResponse).toBe(false)
    })

    it('对话流失败时展示可检索的排查编号', async () => {
        const store = useAgentStore()
        await store.initialize()
        await store.sendMessage('分析异常')

        streamListener?.({
            type: 'error',
            error: '模型服务不可用',
            traceId: 'agent-test-trace'
        })

        expect(store.messages.at(-1)?.content).toBe('模型服务不可用（排查编号：agent-test-trace）')
        expect(store.isProcessing).toBe(false)
        expect(store.isAwaitingResponse).toBe(false)
    })

    it('微信连接后自动进入专属会话并显示微信双向消息', async () => {
        desktopApiMock.agent.getConversation.mockResolvedValue({
            ok: true,
            data: {
                id: 'wechat-conversation',
                user_id: 'user-1',
                title: '微信会话',
                message_count: 0,
                model: 'deepseek-v4-flash',
                created_at: '2026-07-15T00:00:00.000Z',
                updated_at: '2026-07-15T00:00:00.000Z',
                messages: [],
                next_cursor: null
            }
        })
        const store = useAgentStore()
        await store.initialize()

        wechatStatusListener?.({
            userId: 'user-1',
            phase: 'connected',
            conversationId: 'wechat-conversation',
            accountId: 'wechat-account'
        })
        await vi.waitFor(() => expect(store.currentConversationId).toBe('wechat-conversation'))

        streamListener?.({
            type: 'message',
            source: 'wechat',
            conversationId: 'wechat-conversation',
            message: { id: 'wechat-user-1', role: 'user', content: '查询本月支出' }
        })
        streamListener?.({
            type: 'message',
            source: 'wechat',
            conversationId: 'wechat-conversation',
            message: {
                id: 'wechat-assistant-1',
                role: 'assistant',
                content: '本月',
                streaming: true
            }
        })
        streamListener?.({
            type: 'chunk',
            source: 'wechat',
            conversationId: 'wechat-conversation',
            id: 'wechat-assistant-1',
            content: '支出如下'
        })
        streamListener?.({
            type: 'done',
            source: 'wechat',
            conversationId: 'wechat-conversation'
        })

        expect(store.messages.map((message) => [message.role, message.content])).toEqual([
            ['user', '查询本月支出'],
            ['assistant', '本月支出如下']
        ])
        expect(store.isProcessing).toBe(false)
    })

    it('重置用户数据时清空微信状态', async () => {
        const store = useAgentStore()
        await store.initialize()
        wechatStatusListener?.({
            userId: 'user-1',
            phase: 'connected',
            conversationId: 'wechat-conversation'
        })

        store.reset()

        expect(store.wechatStatus).toBeNull()
    })

    it('对话 IPC 启动异常时立即解除输入锁定', async () => {
        desktopApiMock.agent.chat.mockRejectedValueOnce(new Error('IPC 通道断开'))
        const store = useAgentStore()
        await store.initialize()

        await store.sendMessage('重试消息')

        expect(store.messages.at(-1)?.content).toBe('❌ 发送失败，请重试')
        expect(store.isProcessing).toBe(false)
        expect(store.isAwaitingResponse).toBe(false)
    })

    it('回答进行中消息进入队列并在完成后自动发送', async () => {
        const store = useAgentStore()
        await store.initialize()
        await store.sendMessage('第一条消息')
        const queuedId = store.enqueueMessage('队列消息')

        expect(queuedId).not.toBeNull()
        expect(store.queuedMessages.map((message) => message.content)).toEqual(['队列消息'])

        streamListener?.({ type: 'done', conversationId: 'conversation-queue' })
        await vi.waitFor(() => expect(desktopApiMock.agent.chat).toHaveBeenCalledTimes(2))

        expect(desktopApiMock.agent.chat.mock.calls[1]).toEqual([
            'conversation-queue',
            '队列消息',
            false
        ])
        expect(store.queuedMessages).toHaveLength(0)
        expect(store.isProcessing).toBe(true)
    })

    it('引导消息打断当前回答并优先发送且普通队列消息可以删除', async () => {
        const store = useAgentStore()
        await store.initialize()
        await store.sendMessage('正在回答的消息')
        streamListener?.({
            type: 'thinking',
            content: '',
            conversationId: 'conversation-guide'
        })
        const normalId = store.enqueueMessage('普通队列消息')!
        const guidedId = store.enqueueMessage('优先引导消息')!

        expect(await store.guideQueuedMessage(guidedId)).toBe(true)
        expect(desktopApiMock.agent.cancelChat).toHaveBeenCalledTimes(1)
        expect(store.isStopping).toBe(true)

        streamListener?.({ type: 'error', error: AGENT_CHAT_CANCELLED_MESSAGE })
        await vi.waitFor(() => expect(desktopApiMock.agent.chat).toHaveBeenCalledTimes(2))

        expect(desktopApiMock.agent.chat.mock.calls[1]).toEqual([
            'conversation-guide',
            '优先引导消息',
            false
        ])
        expect(store.messages.some((message) => message.content.includes('对话已取消'))).toBe(false)
        expect(store.queuedMessages.map((message) => message.content)).toEqual(['普通队列消息'])
        expect(store.removeQueuedMessage(normalId)).toBe(true)
        expect(store.queuedMessages).toHaveLength(0)
    })

    it('会话和消息分页向 IPC 传递可克隆的普通游标', async () => {
        desktopApiMock.agent.listConversations
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [],
                    next_cursor: {
                        updated_at: '2026-07-13T10:00:00.000Z',
                        id: 'conversation-2'
                    }
                }
            })
            .mockImplementationOnce(async (cursor: { updated_at: string; id: string }) => {
                structuredClone(cursor)
                return { ok: true, data: { items: [], next_cursor: null } }
            })
        desktopApiMock.agent.getConversation
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    id: 'conversation-1',
                    user_id: 'user-1',
                    title: '测试会话',
                    message_count: 2,
                    model: 'deepseek-v4-flash',
                    created_at: '2026-07-13T09:00:00.000Z',
                    updated_at: '2026-07-13T10:00:00.000Z',
                    messages: [
                        {
                            id: 'assistant-history-1',
                            conversation_id: 'conversation-1',
                            role: 'assistant',
                            content: '历史回答',
                            thinking: '历史分析过程',
                            thinking_duration_ms: 2_345,
                            created_at: '2026-07-13T09:45:00.000Z'
                        }
                    ],
                    next_cursor: {
                        created_at: '2026-07-13T09:30:00.000Z',
                        id: 'message-2'
                    }
                }
            })
            .mockImplementationOnce(
                async (_id: string, cursor: { created_at: string; id: string }) => {
                    structuredClone(cursor)
                    return {
                        ok: true,
                        data: {
                            id: 'conversation-1',
                            user_id: 'user-1',
                            title: '测试会话',
                            message_count: 2,
                            model: 'deepseek-v4-flash',
                            created_at: '2026-07-13T09:00:00.000Z',
                            updated_at: '2026-07-13T10:00:00.000Z',
                            messages: [],
                            next_cursor: null
                        }
                    }
                }
            )

        const store = useAgentStore()
        await store.initialize()
        await store.loadMoreConversations()
        await store.loadConversation('conversation-1')
        await store.loadOlderMessages()

        expect(desktopApiMock.agent.listConversations.mock.calls[1][0]).toEqual({
            updated_at: '2026-07-13T10:00:00.000Z',
            id: 'conversation-2'
        })
        expect(desktopApiMock.agent.getConversation.mock.calls[1][1]).toEqual({
            created_at: '2026-07-13T09:30:00.000Z',
            id: 'message-2'
        })
        expect(store.messages[0]).toMatchObject({
            thinking: '历史分析过程',
            thinkingDurationMs: 2_345
        })
        expect(store.loadingMoreConversations).toBe(false)
        expect(store.isLoadingMessages).toBe(false)
    })
})
