/**
 * 对话历史运行摘要
 * 当会话超过设定轮次时，将较早的对话内容后台压缩为摘要，保留最近若干轮原文。
 *
 * @author xiangwei
 */

import { generateText } from 'ai'
import type { LlmModel } from '../llm-gateway'
import { logger } from '../../utils/logger'
import * as conversationStore from './conversation-store'

/** 运行摘要参数 */
interface ConversationSummaryOptions {
    conversationId: string
    userId: string
    /** 保留为原文的最近用户轮次数 */
    recentUserTurnsToKeep: number
    model: LlmModel
    maxOutputTokens: number
}

const CONVERSATION_SUMMARY_SYSTEM_PROMPT = `你负责维护对话的运行摘要。将较早的对话内容压缩为简洁、客观的摘要，保留对后续对话有用的关键信息。

要求：
1. 摘要使用中文，客观第三人称。
2. 保留用户的财务行为（如记账、查询、修改）、重要金额、日期和结论。
3. 保留未完成任务、待确认事项和用户的偏好表达。
4. 删除闲聊、重复问候、客套话和工具调用细节。
5. 如果已有旧摘要，将其与新内容合并为一份更新后的完整摘要。
6. 输出纯文本摘要，不要输出代码围栏、标题或解释。`

const summaryQueues = new Map<string, Promise<void>>()

/**
 * 达到阈值时串行为当前会话生成或更新运行摘要
 *
 * @param options 摘要参数
 * @returns 本次是否完成了摘要
 * @author xiangwei
 */
export async function summarizeConversationIfNeeded(
    options: ConversationSummaryOptions
): Promise<boolean> {
    const key = `${options.userId}:${options.conversationId}`
    const previous = summaryQueues.get(key) ?? Promise.resolve()
    let summarized = false
    const task = previous
        .catch(() => undefined)
        .then(async () => {
            summarized = await runConversationSummary(options)
        })
    summaryQueues.set(key, task)

    try {
        await task
        return summarized
    } finally {
        if (summaryQueues.get(key) === task) {
            summaryQueues.delete(key)
        }
    }
}

/**
 * 执行单轮摘要生成
 *
 * @param options 摘要参数
 * @returns 是否完成摘要
 * @author xiangwei
 */
async function runConversationSummary(options: ConversationSummaryOptions): Promise<boolean> {
    const totalUserMessages = await conversationStore.countConversationUserMessages(
        options.conversationId,
        options.userId
    )

    // 触发阈值：总轮次超过保留轮次的两倍时才需要摘要
    const triggerTurns = options.recentUserTurnsToKeep * 2
    if (totalUserMessages <= triggerTurns) return false

    const [currentSummary, messagesToSummarize] = await Promise.all([
        conversationStore.getConversationSummary(options.conversationId, options.userId),
        conversationStore.restoreMessagesExcludingRecentTurns(
            options.conversationId,
            options.userId,
            options.recentUserTurnsToKeep
        )
    ])

    if (messagesToSummarize.length === 0) return false

    const transcript = messagesToSummarize
        .map((message) => `${message.role === 'user' ? '用户' : '小笔'}：${message.content}`)
        .join('\n\n')
    const prompt = currentSummary
        ? `## 旧摘要\n${currentSummary}\n\n## 待合并的早前对话\n${transcript}`
        : `## 待摘要的早前对话\n${transcript}`

    const result = await generateText({
        model: options.model,
        system: CONVERSATION_SUMMARY_SYSTEM_PROMPT,
        prompt,
        temperature: 0.2,
        maxOutputTokens: Math.min(Math.max(options.maxOutputTokens, 512), 2_048)
    })
    const latestSummary = normalizeGeneratedText(result.text)
    if (!latestSummary) throw new Error('对话摘要生成结果为空')

    await conversationStore.updateConversationSummary(
        options.conversationId,
        options.userId,
        latestSummary
    )
    logger.info('AgentMemory', '对话运行摘要更新完成', {
        conversationId: options.conversationId,
        totalUserMessages,
        recentUserTurnsToKeep: options.recentUserTurnsToKeep,
        summarizedMessageCount: messagesToSummarize.length,
        summaryLength: latestSummary.length
    })
    return true
}

/**
 * 清理模型可能附带的 Markdown 代码围栏
 *
 * @param content 模型输出
 * @returns 可直接保存的文本
 * @author xiangwei
 */
function normalizeGeneratedText(content: string): string {
    const trimmed = content.trim()
    const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)
    return (fenced?.[1] ?? trimmed).trim()
}
