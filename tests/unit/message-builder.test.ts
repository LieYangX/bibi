import { describe, expect, it } from 'vitest'
import { buildMessages } from '../../src/main/agent/context/message-builder'

describe('Agent 消息构建', () => {
    it('无摘要时按用户轮次裁剪历史', () => {
        const messages = buildMessages({
            history: [
                { role: 'user', content: '问题1' },
                { role: 'assistant', content: '回答1' },
                { role: 'user', content: '问题2' },
                { role: 'assistant', content: '回答2' },
                { role: 'user', content: '问题3' },
                { role: 'assistant', content: '回答3' }
            ],
            userMessage: '新问题',
            maxUserTurns: 3
        })

        expect(messages).toEqual([
            { role: 'user', content: '问题2' },
            { role: 'assistant', content: '回答2' },
            { role: 'user', content: '问题3' },
            { role: 'assistant', content: '回答3' },
            { role: 'user', content: '新问题' }
        ])
    })

    it('有摘要时将其作为系统消息置于历史之前', () => {
        const messages = buildMessages({
            history: [
                { role: 'user', content: '问题2' },
                { role: 'assistant', content: '回答2' },
                { role: 'user', content: '问题3' },
                { role: 'assistant', content: '回答3' }
            ],
            userMessage: '新问题',
            maxUserTurns: 3,
            summary: '用户曾询问本月支出和预算情况。'
        })

        expect(messages).toEqual([
            {
                role: 'user',
                content:
                    '以下是对早前对话的简要摘要，作为上下文参考：\n用户曾询问本月支出和预算情况。'
            },
            { role: 'user', content: '问题2' },
            { role: 'assistant', content: '回答2' },
            { role: 'user', content: '问题3' },
            { role: 'assistant', content: '回答3' },
            { role: 'user', content: '新问题' }
        ])
    })
})
