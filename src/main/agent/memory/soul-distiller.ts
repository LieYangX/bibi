/**
 * 灵魂记忆自动提炼
 * 达到配置阈值后，结合旧灵魂和最近对话生成最新 Markdown。
 *
 * @author xiangwei
 */

import { generateText } from 'ai'
import type { LlmModel } from '../llm-gateway'
import { logger } from '../../utils/logger'
import * as conversationStore from './conversation-store'
import { localMemoryStore } from './local-memory'

/** 灵魂提炼参数 */
interface SoulDistillationOptions {
    userId: string
    threshold: number
    model: LlmModel
    maxOutputTokens: number
}

const SOUL_DISTILLATION_SYSTEM_PROMPT = `你负责维护用户的“灵魂记忆”。灵魂只记录从长期对话中能够稳定观察到的情感倾向、表达习惯、行为模式、价值偏好、敏感边界和互动方式。

规则：
1. 合并旧灵魂与最近对话，只保留有持续价值的信息
2. 不记录姓名、联系方式、账号等基本资料，这些属于用户画像
3. 不把临时情绪或一次性事件误判为长期特征；不确定时使用“可能”“近期表现”
4. 不虚构，不复制大段原话，不记录模型自己的行为
5. 输出完整的最新 Markdown，标题固定为“# 灵魂”，不要输出代码围栏或解释`

const distillationQueues = new Map<string, Promise<void>>()

/**
 * 达到阈值时串行提炼当前用户的灵魂记忆
 *
 * @param options 提炼参数
 * @returns 本次是否完成了提炼
 * @author xiangwei
 */
export async function distillSoulIfNeeded(options: SoulDistillationOptions): Promise<boolean> {
    const previous = distillationQueues.get(options.userId) ?? Promise.resolve()
    let distilled = false
    const task = previous
        .catch(() => undefined)
        .then(async () => {
            distilled = await runSoulDistillation(options)
        })
    distillationQueues.set(options.userId, task)

    try {
        await task
        return distilled
    } finally {
        if (distillationQueues.get(options.userId) === task) {
            distillationQueues.delete(options.userId)
        }
    }
}

/**
 * 执行单次灵魂提炼
 *
 * @param options 提炼参数
 * @returns 是否完成提炼
 * @author xiangwei
 */
async function runSoulDistillation(options: SoulDistillationOptions): Promise<boolean> {
    const currentSoul = await localMemoryStore.readMemory(options.userId, 'soul')
    const userMessageCount = await conversationStore.countUserMessages(options.userId)

    if (userMessageCount < currentSoul.lastDistilledUserMessageCount) {
        if (currentSoul.content) {
            await localMemoryStore.writeMemory(options.userId, 'soul', currentSoul.content, {
                lastDistilledUserMessageCount: userMessageCount
            })
        }
        return false
    }

    const pendingMessageCount = userMessageCount - currentSoul.lastDistilledUserMessageCount
    if (pendingMessageCount < options.threshold) return false

    const recentMessages = await conversationStore.restoreRecentUserTurns(
        options.userId,
        options.threshold
    )
    const transcript = recentMessages
        .map((message) => `${message.role === 'user' ? '用户' : '小笔'}：${message.content}`)
        .join('\n\n')
    const result = await generateText({
        model: options.model,
        system: SOUL_DISTILLATION_SYSTEM_PROMPT,
        prompt: `## 旧灵魂\n${currentSoul.content || '暂无'}\n\n## 最近对话\n${transcript}`,
        temperature: 0.2,
        maxOutputTokens: Math.min(Math.max(options.maxOutputTokens, 512), 2_048)
    })
    const latestSoul = normalizeGeneratedMarkdown(result.text)
    if (!latestSoul) throw new Error('灵魂提炼结果为空')

    await localMemoryStore.writeMemory(options.userId, 'soul', latestSoul, {
        lastDistilledUserMessageCount: userMessageCount
    })
    logger.info('AgentMemory', '灵魂记忆提炼完成', {
        threshold: options.threshold,
        userMessageCount,
        pendingMessageCount,
        contentLength: latestSoul.length
    })
    return true
}

/**
 * 清理模型可能附带的 Markdown 代码围栏
 *
 * @param content 模型输出
 * @returns 可直接保存的 Markdown
 * @author xiangwei
 */
function normalizeGeneratedMarkdown(content: string): string {
    const trimmed = content.trim()
    const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)
    return (fenced?.[1] ?? trimmed).trim()
}
