/**
 * 消息窗口构建
 * 按记忆阈值裁剪最近对话，生成模型消息序列
 *
 * @author xiangwei
 */

import { pruneMessages, type ModelMessage } from 'ai'

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
    summary?: string | null
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

    const summaryMessage: ModelMessage | null = options.summary
        ? {
              role: 'user',
              content: `以下是对早前对话的简要摘要，作为上下文参考：\n${options.summary}`
          }
        : null

    const messages: ModelMessage[] = [
        ...(summaryMessage ? [summaryMessage] : []),
        ...historyMessages,
        {
            role: 'user',
            content: options.userMessage
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
