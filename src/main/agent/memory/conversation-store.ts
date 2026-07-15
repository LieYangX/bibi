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
 * @returns 会话 ID
 * @author xiangwei
 */
export async function createConversation(
    userId: string,
    title?: string,
    model?: string
): Promise<string> {
    const id = randomUUID()
    await db.insert(agentConversations).values({
        id,
        user_id: userId,
        title: title || '新对话',
        message_count: 0,
        model: model ?? null
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
    const rows = await db
        .select({
            id: agentConversations.id,
            title: agentConversations.title,
            model: agentConversations.model,
            message_count: agentConversations.message_count,
            updated_at: agentConversations.updated_at,
            last_message: sql<string | null>`(
                SELECT content
                FROM agent_messages AS last_message
                WHERE last_message.conversation_id = ${agentConversations.id}
                ORDER BY last_message.created_at DESC, last_message.id DESC
                LIMIT 1
            )`,
            total_tokens: sql<number>`COALESCE((
                SELECT SUM(COALESCE(token_count, 0))
                FROM agent_messages AS token_message
                WHERE token_message.conversation_id = ${agentConversations.id}
            ), 0)`
        })
        .from(agentConversations)
        .where(and(...conditions))
        .orderBy(desc(agentConversations.updated_at), desc(agentConversations.id))
        .limit(CONVERSATION_LIST_LIMIT + 1)

    const hasMore = rows.length > CONVERSATION_LIST_LIMIT
    const pageRows = rows.slice(0, CONVERSATION_LIST_LIMIT)
    const items = pageRows.map((row) => ({
        id: row.id,
        title: row.title,
        message_count: row.message_count,
        last_message: row.last_message?.slice(0, 100) ?? null,
        total_tokens: Number(row.total_tokens ?? 0),
        model: row.model,
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
        thinking: message.thinking ?? undefined
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
