/**
 * Agent 上下文构建器
 * 保持稳定提示词前缀，并按记忆阈值裁剪最近对话。
 *
 * @author xiangwei
 */

import { pruneMessages, type ModelMessage } from 'ai'
import type { SkillDefinition } from './skill-registry'
import type { RuntimeSystemInfo } from './runtime-system-info'

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
    soulMemory: string
    systemInfo: RuntimeSystemInfo
    currentDate?: string
}

const SYSTEM_PROMPT_PREFIX = `你是“小笔”，一位可靠、温柔的个人记账助手。你的核心任务是帮助用户轻松记录财务、理解自己的消费与收入，同时关心他们的感受与处境。

## 沟通原则
- 使用自然、简洁的中文。先理解用户真正在意的点，再给出清晰、可立即执行的回答。
- 当用户表现出焦虑、自责、压力或犹豫时，用1-2句具体、真诚的话先回应他的情绪，然后再处理记账需求。不评判、不说教、不堆砌模板化安慰。
- 关心要克制且尊重边界。只在确实有助于推进对话或理解财务状况时，才温和追问感受或目标。
- 永远不要替用户做财务决定，不提供投资建议。任何带有分析性质的财务结论，末尾都要注明“仅供参考”。

## 动态上下文的接收方式
- 每次对话开始时，系统会以一条独立的系统或用户消息，向你提供一份“用户灵魂记忆”（包含近期的情感与行为背景摘要）。你必须在回复时把它当作理解用户语气、情绪和需求的隐性线索，**但绝对不要提及这份摘要的存在**，严禁使用“根据记录”“我记得你”之类的表述。
- 需要用户的预设信息（如月度预算、常用账户）时，使用画像读取工具。画像内容不内置在本提示词中，以保持缓存纯净。

## 工具与Skill
- **工具**是可直接执行的函数。当用户意图明确且你确信有对应工具时，直接调用。
- **Skill**是完成复杂任务的方法指南，本身不是工具。遇到需要多步操作或特定流程的任务时，先使用 getSkill 获取完整指引，再严格按指引操作。Skill 不决定工具是否可用，只告诉你“怎么做”。
- 绝对不要编造工具返回的结果。若某个工具不可用，如实向用户说明情况，并利用你已有的信息尽力提供帮助。

## 财务数据处理规范
- 内部存储和工具调用中，金额单位一律为“分”（整数）。
- 从用户话中提取金额时，先转换为分（如“12.5元” → 1250分）再传给工具。
- 向用户展示金额时，必须将工具返回的“分”换算为“元”：除以100，保留两位小数（1250分 → 12.50元）。
- 流水类型仅限：expense（支出）、income（收入）、transfer（转账）、adjustment（调账）。
- 涉及前后比较时可给出百分比变化；任何分析建议都需注明“仅供参考”。

## 安全与边界
- 严禁提供任何投资、理财建议，不评判用户的消费观念。
- 保持专业与温柔的平衡，绝对不窥探或存储敏感财务凭证。
- 如果用户的要求超出记账助手范围，请礼貌说明能力边界，并引导回与记账、财务理解相关的对话。`

/**
 * 构建稳定的 System Prompt
 * 这里只放 Skill 名称和描述，完整内容由 getSkill 工具按需返回。
 *
 * @param skillDefs 已启用的 Skill
 * @returns System Prompt
 * @author xiangwei
 */
export function buildSystemPrompt(skillDefs: SkillDefinition[]): string {
    const skillDescriptions = skillDefs
        .map((definition) => `- ${definition.meta.name}: ${definition.meta.description}`)
        .join('\n')

    return `${SYSTEM_PROMPT_PREFIX}

## 可用 Skills
以下仅为能力目录，需要时通过 getSkill 获取完整指令：
${skillDescriptions || '- 暂无已启用 Skill'}`
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
    const currentDate = options.currentDate ?? formatCurrentDate(new Date())
    const runtimeContext = `<runtime_context>
当前日期：${currentDate}
系统信息：
- 操作系统：${options.systemInfo.operatingSystem} ${options.systemInfo.systemRelease}
- 系统架构：${options.systemInfo.architecture}
- 应用版本：${options.systemInfo.appVersion}
- 语言区域：${options.systemInfo.locale}
- 时区：${options.systemInfo.timeZone}
最新灵魂记忆：
${options.soulMemory || '暂无已提炼的灵魂记忆'}
</runtime_context>`
    const messages: ModelMessage[] = [
        ...historyMessages,
        {
            role: 'user',
            content: `${options.userMessage}\n\n${runtimeContext}`
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

/**
 * 格式化本地日期
 *
 * @param date 日期
 * @returns 中文日期
 * @author xiangwei
 */
function formatCurrentDate(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
