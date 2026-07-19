/**
 * 智能体任务清单服务
 * 管理多步骤任务执行时 Agent 自主创建的任务，与用户待办物理隔离
 * 所有操作均校验会话归属当前用户，确保隔离性
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import type { AgentTaskInfo } from '@shared/types'
import { agentConversations, agentTasks, db } from '../database/drizzle'

/** 单次批量创建任务上限 */
const MAX_TASKS_PER_BATCH = 20

/**
 * 校验会话归属当前用户
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @throws 会话不存在或不属于当前用户
 * @author xiangwei
 */
async function assertConversationBelongsToUser(
    conversationId: string,
    userId: string
): Promise<void> {
    const [conv] = await db
        .select({ id: agentConversations.id })
        .from(agentConversations)
        .where(
            and(eq(agentConversations.id, conversationId), eq(agentConversations.user_id, userId))
        )
        .limit(1)
    if (!conv) throw new Error('会话不存在或不属于当前用户')
}

/**
 * 查询指定会话的全部任务
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns 任务列表，按 sort_order + created_at 升序
 * @author xiangwei
 */
export async function listAgentTasks(
    conversationId: string,
    userId: string
): Promise<AgentTaskInfo[]> {
    await assertConversationBelongsToUser(conversationId, userId)
    const list = await db
        .select()
        .from(agentTasks)
        .where(and(eq(agentTasks.conversation_id, conversationId), eq(agentTasks.user_id, userId)))
        .orderBy(asc(agentTasks.sort_order), asc(agentTasks.created_at))
    return list.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as 'pending' | 'completed',
        sort_order: t.sort_order
    }))
}

/**
 * 批量创建任务清单
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @param tasks 任务数组（title 必填，sort_order 可选，默认按数组顺序）
 * @returns 创建后的任务列表
 * @throws 任务列表为空或超过上限
 * @author xiangwei
 */
export async function createAgentTasks(
    conversationId: string,
    userId: string,
    tasks: { title: string; sort_order?: number }[]
): Promise<AgentTaskInfo[]> {
    if (tasks.length === 0) throw new Error('任务列表不能为空')
    if (tasks.length > MAX_TASKS_PER_BATCH) {
        throw new Error(`单次最多创建 ${MAX_TASKS_PER_BATCH} 个任务`)
    }
    await assertConversationBelongsToUser(conversationId, userId)

    const now = new Date().toISOString()
    const created: AgentTaskInfo[] = []
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        const id = randomUUID()
        const sortOrder = task.sort_order ?? i
        await db.insert(agentTasks).values({
            id,
            conversation_id: conversationId,
            user_id: userId,
            title: task.title,
            status: 'pending',
            sort_order: sortOrder,
            created_at: now,
            updated_at: now
        })
        created.push({
            id,
            title: task.title,
            status: 'pending',
            sort_order: sortOrder
        })
    }
    return created
}

/**
 * 更新任务状态（pending <-> completed）
 *
 * @param taskId 任务 ID
 * @param status 新状态
 * @param userId 用户 ID
 * @param conversationId 会话 ID
 * @returns 更新后的任务
 * @throws 任务不存在
 * @author xiangwei
 */
export async function updateAgentTaskStatus(
    taskId: string,
    status: 'pending' | 'completed',
    userId: string,
    conversationId: string
): Promise<AgentTaskInfo> {
    await assertConversationBelongsToUser(conversationId, userId)
    const [existing] = await db
        .select()
        .from(agentTasks)
        .where(
            and(
                eq(agentTasks.id, taskId),
                eq(agentTasks.user_id, userId),
                eq(agentTasks.conversation_id, conversationId)
            )
        )
        .limit(1)
    if (!existing) throw new Error('任务不存在')

    const now = new Date().toISOString()
    await db.update(agentTasks).set({ status, updated_at: now }).where(eq(agentTasks.id, taskId))

    return {
        id: existing.id,
        title: existing.title,
        status,
        sort_order: existing.sort_order
    }
}

/**
 * 清空指定会话的全部任务（用于重新规划）
 *
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function clearAgentTasks(conversationId: string, userId: string): Promise<void> {
    await assertConversationBelongsToUser(conversationId, userId)
    await db
        .delete(agentTasks)
        .where(and(eq(agentTasks.conversation_id, conversationId), eq(agentTasks.user_id, userId)))
}
