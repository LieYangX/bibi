import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { StreamEvent } from '../../src/shared/types'

let streamListener: ((event: StreamEvent) => void) | null = null

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
        chat: vi.fn()
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
        desktopApiMock.agent.getConversation.mockResolvedValue({ ok: true, data: null })
        desktopApiMock.agent.onEvent.mockImplementation(
            (listener: (event: StreamEvent) => void) => {
                streamListener = listener
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

        await store.sendMessage('继续分析')
        streamListener?.({
            type: 'message',
            message: {
                id: 'assistant-1',
                role: 'assistant',
                content: '',
                streaming: true
            }
        })
        streamListener?.({ type: 'chunk', id: 'assistant-1', content: '持续输出' })
        streamListener?.({ type: 'done', conversationId: 'conversation-1' })

        expect(store.messages.at(-1)?.content).toBe('持续输出')
        expect(store.currentConversationId).toBe('conversation-1')
        expect(store.isProcessing).toBe(false)
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
                    messages: [],
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
        expect(store.loadingMoreConversations).toBe(false)
        expect(store.isLoadingMessages).toBe(false)
    })
})
