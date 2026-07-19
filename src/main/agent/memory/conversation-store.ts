/**
 * 会话持久化存储
 * 将对话保存到 SQLite，支持历史查询和恢复
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { eq, and, desc, sql, or, lt, inArray } from 'drizzle-orm'
import { db, agentConversations, agentMessages } from '../../database/drizzle'
import type {
    AgentMessageCursor,
    ConversationCursor,
    ConversationDetail,
    ConversationListPage
} from '@shared/types'

const CONVERSATION_LIST_LIMIT = 50
const MESSAGE_PAGE_SIZE = 50
let lastMessageCreatedAt = 0

/**
 * 生成单调递增的消息时间，保证同一毫秒内的消息顺序稳定
 *
 * @returns ISO 时间字符串
 * @author xiangwei
 */
function createMessageTimestamp(): string {
    const timestamp = Math.max(Date.now(), lastMessageCreatedAt + 1)
    lastMessageCreatedAt = timestamp
    return new Date(timestamp).toISOString()
}

/**
 * 创建新会话
 *
 * @param userId 用户 ID
 * @param title 会话标题（可由 LLM 自动生成）
 * @param model 模型名称
 * @param source 会话来源，默认 desktop
 * @returns 会话 ID
 * @author xiangwei
 */
export async function createConversation(
    userId: string,
    title?: string,
    model?: string,
    source: 'desktop' | 'wechat' = 'desktop'
): Promise<string> {
    const id = randomUUID()
    await db.insert(agentConversations).values({
        id,
        user_id: userId,
        title: title || '新对话',
        message_count: 0,
        model: model ?? null,
        source
    })
    return id
}

/**
 * 判断会话是否属于指定用户
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns 是否属于指定用户
 * @author xiangwei
 */
export async function conversationBelongsToUser(
    conversationId: string,
    userId: string
): Promise<boolean> {
    const [conversation] = await db
        .select({ id: agentConversations.id })
        .from(agentConversations)
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .limit(1)
    return Boolean(conversation)
}

/**
 * 获取会话来源
 *
 * @param conversationId 会话 ID
 * @returns 会话来源，会话不存在时返回 null
 * @author xiangwei
 */
export async function getConversationSource(
    conversationId: string,
    userId: string
): Promise<'desktop' | 'wechat' | null> {
    const [conversation] = await db
        .select({ source: agentConversations.source })
        .from(agentConversations)
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .limit(1)
    return conversation?.source ?? null
}

/**
 * 保存消息到会话
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param role 角色
 * @param content 消息内容
 * @param extras 附加信息（可选）
 * @author xiangwei
 */
export async function saveMessage(
    conversationId: string,
    userId: string,
    role: string,
    content: string,
    extras?: {
        tool_calls?: string
        tool_results?: string
        finish_reason?: string
        skill_used?: string
        tool_used?: string
        thinking?: string
        thinking_duration_ms?: number
        token_count?: number
    }
): Promise<void> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }

    const id = randomUUID()
    const createdAt = createMessageTimestamp()
    await db.insert(agentMessages).values({
        id,
        conversation_id: conversationId,
        role,
        content,
        tool_calls: extras?.tool_calls ?? null,
        tool_results: extras?.tool_results ?? null,
        finish_reason: extras?.finish_reason ?? null,
        skill_used: extras?.skill_used ?? null,
        tool_used: extras?.tool_used ?? null,
        thinking: extras?.thinking ?? null,
        thinking_duration_ms: extras?.thinking_duration_ms ?? null,
        token_count: extras?.token_count ?? null,
        created_at: createdAt
    })

    // 更新会话消息计数和最后更新时间
    await db
        .update(agentConversations)
        .set({
            message_count: sql`message_count + 1`,
            updated_at: createdAt
        })
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
}

/**
 * 获取用户的会话列表
 *
 * @param userId 用户 ID
 * @param cursor 向后加载会话的游标
 * @returns 一页会话摘要
 * @author xiangwei
 */
export async function listConversations(
    userId: string,
    cursor?: ConversationCursor
): Promise<ConversationListPage> {
    const conditions = [eq(agentConversations.user_id, userId)]
    if (cursor) {
        const cursorCondition = or(
            lt(agentConversations.updated_at, cursor.updated_at),
            and(
                eq(agentConversations.updated_at, cursor.updated_at),
                lt(agentConversations.id, cursor.id)
            )
        )
        if (cursorCondition) conditions.push(cursorCondition)
    }
    // 先查会话列表
    const rows = await db
        .select({
            id: agentConversations.id,
            title: agentConversations.title,
            model: agentConversations.model,
            source: agentConversations.source,
            message_count: agentConversations.message_count,
            updated_at: agentConversations.updated_at,
            last_message: sql<string | null>`(
                SELECT content
                FROM agent_messages AS last_message
                WHERE last_message.conversation_id = ${agentConversations.id}
                ORDER BY last_message.created_at DESC, last_message.id DESC
                LIMIT 1
            )`
        })
        .from(agentConversations)
        .where(and(...conditions))
        .orderBy(desc(agentConversations.updated_at), desc(agentConversations.id))
        .limit(CONVERSATION_LIST_LIMIT + 1)

    // 单独查每个会话的 token 合计（Drizzle sql 标签在关联子查询中存在问题，改用独立查询）
    const conversationIds = rows.map((r) => r.id)
    let tokenMap = new Map<string, number>()
    if (conversationIds.length > 0) {
        const tokenRows = await db
            .select({
                conversation_id: agentMessages.conversation_id,
                total: sql<number>`COALESCE(SUM(COALESCE(${agentMessages.token_count}, 0)), 0)`
            })
            .from(agentMessages)
            .where(inArray(agentMessages.conversation_id, conversationIds))
            .groupBy(agentMessages.conversation_id)
        tokenMap = new Map(tokenRows.map((r) => [r.conversation_id, Number(r.total)]))
    }

    const hasMore = rows.length > CONVERSATION_LIST_LIMIT
    const pageRows = rows.slice(0, CONVERSATION_LIST_LIMIT)
    const items = pageRows.map((row) => ({
        id: row.id,
        title: row.title,
        message_count: row.message_count,
        last_message: row.last_message?.slice(0, 100) ?? null,
        total_tokens: tokenMap.get(row.id) ?? 0,
        model: row.model,
        source: row.source,
        updated_at: row.updated_at
    }))
    const lastConversation = pageRows.at(-1)
    return {
        items,
        next_cursor:
            hasMore && lastConversation
                ? { updated_at: lastConversation.updated_at, id: lastConversation.id }
                : null
    }
}

/**
 * 获取会话详情
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param cursor 向前加载消息的游标
 * @returns 会话详情及一页消息
 * @author xiangwei
 */
export async function getConversation(
    conversationId: string,
    userId: string,
    cursor?: AgentMessageCursor
): Promise<ConversationDetail | null> {
    const [conv] = await db
        .select()
        .from(agentConversations)
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .limit(1)

    if (!conv) return null

    const messageConditions = [eq(agentMessages.conversation_id, conversationId)]
    if (cursor) {
        const cursorCondition = or(
            lt(agentMessages.created_at, cursor.created_at),
            and(eq(agentMessages.created_at, cursor.created_at), lt(agentMessages.id, cursor.id))
        )
        if (cursorCondition) messageConditions.push(cursorCondition)
    }

    const rows = await db
        .select({
            id: agentMessages.id,
            conversation_id: agentMessages.conversation_id,
            role: agentMessages.role,
            content: agentMessages.content,
            skill_used: agentMessages.skill_used,
            tool_used: agentMessages.tool_used,
            thinking: agentMessages.thinking,
            thinking_duration_ms: agentMessages.thinking_duration_ms,
            created_at: agentMessages.created_at
        })
        .from(agentMessages)
        .where(and(...messageConditions))
        .orderBy(desc(agentMessages.created_at), desc(agentMessages.id))
        .limit(MESSAGE_PAGE_SIZE + 1)

    const hasMore = rows.length > MESSAGE_PAGE_SIZE
    const pageRows = rows.slice(0, MESSAGE_PAGE_SIZE)
    const oldestMessage = pageRows.at(-1)
    const messages = pageRows.reverse().map((message) => ({
        ...message,
        role: message.role as 'user' | 'assistant' | 'system' | 'tool',
        skill_used: message.skill_used ?? undefined,
        tool_used: message.tool_used ?? undefined,
        thinking: message.thinking ?? undefined,
        thinking_duration_ms: message.thinking_duration_ms ?? undefined
    }))

    return {
        ...conv,
        messages,
        next_cursor:
            hasMore && oldestMessage
                ? { created_at: oldestMessage.created_at, id: oldestMessage.id }
                : null
    }
}

/**
 * 删除会话及所有消息
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID（用于权限校验）
 * @returns 是否成功
 * @author xiangwei
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const [conv] = await db
        .select({ id: agentConversations.id })
        .from(agentConversations)
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .limit(1)

    if (!conv) return false

    // 级联删除消息（外键 ON DELETE CASCADE）
    await db.delete(agentConversations).where(eq(agentConversations.id, conversationId))
    return true
}

/**
 * 将持久化的消息恢复为 CoreMessage 数组
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns CoreMessage 数组
 * @author xiangwei
 */
export async function restoreMessages(
    conversationId: string,
    userId: string
): Promise<Array<{ role: string; content: string }>> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }

    const rows = await db
        .select({
            role: agentMessages.role,
            content: agentMessages.content
        })
        .from(agentMessages)
        .where(eq(agentMessages.conversation_id, conversationId))
        .orderBy(agentMessages.created_at)

    return rows.map((row) => ({
        role: row.role,
        content: row.content
    }))
}

/**
 * 读取单个会话最近的用户轮次
 * 只返回 user 和 assistant 消息，供模型滑动窗口使用。
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param userTurnLimit 最多保留的用户轮次数
 * @returns 按时间正序排列的消息
 * @author xiangwei
 */
export async function restoreRecentMessages(
    conversationId: string,
    userId: string,
    userTurnLimit: number
): Promise<Array<{ role: string; content: string }>> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    if (userTurnLimit <= 0) return []

    const rows = await db
        .select({
            role: agentMessages.role,
            content: agentMessages.content
        })
        .from(agentMessages)
        .where(
            and(
                eq(agentMessages.conversation_id, conversationId),
                inArray(agentMessages.role, ['user', 'assistant'])
            )
        )
        .orderBy(desc(agentMessages.created_at), desc(agentMessages.id))
        .limit(userTurnLimit * 2)

    return trimToRecentUserTurns(rows.reverse(), userTurnLimit)
}

/**
 * 统计指定用户累计发送的消息数
 *
 * @param userId 用户 ID
 * @returns 用户消息总数
 * @author xiangwei
 */
export async function countUserMessages(userId: string): Promise<number> {
    const [row] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(agentMessages)
        .innerJoin(agentConversations, eq(agentMessages.conversation_id, agentConversations.id))
        .where(and(eq(agentConversations.user_id, userId), eq(agentMessages.role, 'user')))
    return Number(row?.count ?? 0)
}

/**
 * 跨会话读取指定用户最近的若干轮对话
 * 用于定期提炼全局灵魂记忆。
 *
 * @param userId 用户 ID
 * @param userTurnLimit 最多保留的用户轮次数
 * @returns 按时间正序排列的消息
 * @author xiangwei
 */
export async function restoreRecentUserTurns(
    userId: string,
    userTurnLimit: number
): Promise<Array<{ role: string; content: string }>> {
    if (userTurnLimit <= 0) return []

    const rows = await db
        .select({
            role: agentMessages.role,
            content: agentMessages.content
        })
        .from(agentMessages)
        .innerJoin(agentConversations, eq(agentMessages.conversation_id, agentConversations.id))
        .where(
            and(
                eq(agentConversations.user_id, userId),
                inArray(agentMessages.role, ['user', 'assistant'])
            )
        )
        .orderBy(desc(agentMessages.created_at), desc(agentMessages.id))
        .limit(userTurnLimit * 2)

    return trimToRecentUserTurns(rows.reverse(), userTurnLimit)
}

/**
 * 精确裁剪最近的用户轮次，避免缺少助手回复时窗口超过阈值。
 *
 * @param messages 候选消息
 * @param userTurnLimit 用户轮次上限
 * @returns 裁剪后的消息
 * @author xiangwei
 */
function trimToRecentUserTurns(
    messages: Array<{ role: string; content: string }>,
    userTurnLimit: number
): Array<{ role: string; content: string }> {
    let userTurnCount = 0
    let startIndex = 0
    for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index].role !== 'user') continue
        userTurnCount++
        if (userTurnCount === userTurnLimit) {
            startIndex = index
            break
        }
    }
    return messages.slice(startIndex)
}

/**
 * 更新会话标题
 *
 * @param conversationId 会话 ID
 * @param title 新标题
 * @param userId 用户 ID
 * @returns 是否成功更新
 * @author xiangwei
 */
export async function updateConversationTitle(
    conversationId: string,
    title: string,
    userId: string
): Promise<boolean> {
    const result = await db
        .update(agentConversations)
        .set({ title, updated_at: sql`(datetime('now', 'localtime'))` })
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .run()
    return result.changes > 0
}

/**
 * 统计单个会话的用户消息数
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns 用户消息总数
 * @author xiangwei
 */
export async function countConversationUserMessages(
    conversationId: string,
    userId: string
): Promise<number> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    const [row] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(agentMessages)
        .where(
            and(eq(agentMessages.conversation_id, conversationId), eq(agentMessages.role, 'user'))
        )
    return Number(row?.count ?? 0)
}

/**
 * 读取会话当前摘要
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns 摘要文本，不存在时返回 null
 * @author xiangwei
 */
export async function getConversationSummary(
    conversationId: string,
    userId: string
): Promise<string | null> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    const [row] = await db
        .select({ summary: agentConversations.summary })
        .from(agentConversations)
        .where(eq(agentConversations.id, conversationId))
        .limit(1)
    return row?.summary ?? null
}

/**
 * 更新会话运行摘要
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param summary 新的完整摘要内容
 * @returns 是否成功更新
 * @author xiangwei
 */
export async function updateConversationSummary(
    conversationId: string,
    userId: string,
    summary: string
): Promise<boolean> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    const result = await db
        .update(agentConversations)
        .set({ summary, updated_at: sql`(datetime('now', 'localtime'))` })
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .run()
    return result.changes > 0
}

/**
 * 读取除最近若干用户轮次之外的全部消息
 * 用于生成或更新对话运行摘要。
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param excludeRecentUserTurns 保留为原文的最近用户轮次数
 * @returns 按时间正序排列的消息
 * @author xiangwei
 */
export async function restoreMessagesExcludingRecentTurns(
    conversationId: string,
    userId: string,
    excludeRecentUserTurns: number
): Promise<Array<{ role: string; content: string }>> {
    if (!(await conversationBelongsToUser(conversationId, userId))) {
        throw new Error('会话不存在或不属于当前用户')
    }
    if (excludeRecentUserTurns < 0) {
        throw new Error('保留轮次数不能为负数')
    }

    const allMessages = await restoreMessages(conversationId, userId)
    const conversationMessages = allMessages.filter(
        (message) => message.role === 'user' || message.role === 'assistant'
    )
    const recentTurns = trimToRecentUserTurns(conversationMessages, excludeRecentUserTurns)
    return conversationMessages.slice(0, conversationMessages.length - recentTurns.length)
}
