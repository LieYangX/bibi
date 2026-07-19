import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { summarizeConversationIfNeeded } from '../../src/main/agent/memory/conversation-summarizer'
import * as conversationStore from '../../src/main/agent/memory/conversation-store'

vi.mock('ai', () => ({
    generateText: vi.fn()
}))

vi.mock('../../src/main/agent/memory/conversation-store', () => ({
    countConversationUserMessages: vi.fn(),
    getConversationSummary: vi.fn(),
    restoreMessagesExcludingRecentTurns: vi.fn(),
    updateConversationSummary: vi.fn()
}))

describe('对话运行摘要', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('轮次未超过阈值时不生成摘要', async () => {
        vi.mocked(conversationStore.countConversationUserMessages).mockResolvedValue(5)

        const result = await summarizeConversationIfNeeded({
            conversationId: 'conv-1',
            userId: 'user-1',
            recentUserTurnsToKeep: 3,
            model: {} as never,
            maxOutputTokens: 1024
        })

        expect(result).toBe(false)
        expect(generateText).not.toHaveBeenCalled()
    })

    it('轮次超过阈值时合并旧摘要并保存新摘要', async () => {
        vi.mocked(conversationStore.countConversationUserMessages).mockResolvedValue(7)
        vi.mocked(conversationStore.getConversationSummary).mockResolvedValue('旧摘要内容')
        vi.mocked(conversationStore.restoreMessagesExcludingRecentTurns).mockResolvedValue([
            { role: 'user', content: '问题 1' },
            { role: 'assistant', content: '回答 1' }
        ])
        vi.mocked(generateText).mockResolvedValue({ text: '新摘要内容' } as never)
        vi.mocked(conversationStore.updateConversationSummary).mockResolvedValue(true)

        const result = await summarizeConversationIfNeeded({
            conversationId: 'conv-1',
            userId: 'user-1',
            recentUserTurnsToKeep: 3,
            model: {} as never,
            maxOutputTokens: 1024
        })

        expect(result).toBe(true)
        expect(generateText).toHaveBeenCalledTimes(1)
        const prompt = vi.mocked(generateText).mock.calls[0][0].prompt as string
        expect(prompt).toContain('旧摘要内容')
        expect(prompt).toContain('用户：问题 1')
        expect(prompt).toContain('小笔：回答 1')
        expect(conversationStore.updateConversationSummary).toHaveBeenCalledWith(
            'conv-1',
            'user-1',
            '新摘要内容'
        )
    })

    it('生成结果为空时抛出异常', async () => {
        vi.mocked(conversationStore.countConversationUserMessages).mockResolvedValue(7)
        vi.mocked(conversationStore.getConversationSummary).mockResolvedValue(null)
        vi.mocked(conversationStore.restoreMessagesExcludingRecentTurns).mockResolvedValue([
            { role: 'user', content: '问题 1' }
        ])
        vi.mocked(generateText).mockResolvedValue({ text: '' } as never)

        await expect(
            summarizeConversationIfNeeded({
                conversationId: 'conv-1',
                userId: 'user-1',
                recentUserTurnsToKeep: 3,
                model: {} as never,
                maxOutputTokens: 1024
            })
        ).rejects.toThrow('对话摘要生成结果为空')
    })
})
