/**
 * 待办管理服务
 * 极简纯任务清单，支持软删除与状态切换
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { and, asc, eq, gte, like, lte } from 'drizzle-orm'
import type { CreateTodoDTO, Todo, TodoListFilter, UpdateTodoDTO } from '@shared/types'
import { db, todos } from '../database/drizzle'

/**
 * 获取用户待办列表
 *
 * @param userId 用户 ID
 * @param filter 过滤条件
 * @returns 待办列表
 * @author xiangwei
 */
export async function listTodos(userId: string, filter: TodoListFilter): Promise<Todo[]> {
    const conditions = [eq(todos.user_id, userId), eq(todos.is_deleted, 0)]
    if (filter.status) conditions.push(eq(todos.status, filter.status))
    if (filter.due_start) conditions.push(gte(todos.due_date, filter.due_start))
    if (filter.due_end) conditions.push(lte(todos.due_date, filter.due_end))
    if (filter.keyword) conditions.push(like(todos.title, `%${filter.keyword}%`))

    const list = await db
        .select()
        .from(todos)
        .where(and(...conditions))
        .orderBy(asc(todos.sort_order), asc(todos.created_at))
    return list as Todo[]
}

/**
 * 创建待办
 *
 * @param data 待办数据
 * @param userId 用户 ID
 * @returns 新待办
 * @author xiangwei
 */
export async function createTodo(data: CreateTodoDTO, userId: string): Promise<Todo> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const newTodo = {
        id,
        user_id: userId,
        title: data.title,
        note: data.note ?? null,
        status: 'pending' as const,
        due_date: data.due_date ?? null,
        due_time: data.due_time ?? null,
        completed_at: null,
        sort_order: 0,
        is_deleted: 0,
        created_at: now,
        updated_at: now
    }
    await db.insert(todos).values(newTodo)
    return newTodo as Todo
}

/**
 * 更新待办
 *
 * @param id 待办 ID
 * @param data 更新数据
 * @param userId 用户 ID
 * @returns 更新后的待办
 * @author xiangwei
 */
export async function updateTodo(
    id: string,
    data: UpdateTodoDTO,
    userId: string
): Promise<Todo | null> {
    const updateValues: Partial<typeof todos.$inferInsert> = {
        updated_at: new Date().toISOString()
    }
    if (data.title !== undefined) updateValues.title = data.title
    if (data.note !== undefined) updateValues.note = data.note
    if (data.due_date !== undefined) updateValues.due_date = data.due_date
    if (data.due_time !== undefined) updateValues.due_time = data.due_time

    await db
        .update(todos)
        .set(updateValues)
        .where(and(eq(todos.id, id), eq(todos.user_id, userId), eq(todos.is_deleted, 0)))

    const [updated] = await db
        .select()
        .from(todos)
        .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
        .limit(1)
    return updated ? (updated as Todo) : null
}

/**
 * 软删除待办
 *
 * @param id 待办 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function deleteTodo(id: string, userId: string): Promise<void> {
    await db
        .update(todos)
        .set({ is_deleted: 1, updated_at: new Date().toISOString() })
        .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
}

/**
 * 切换待办状态（pending <-> completed）
 *
 * @param id 待办 ID
 * @param userId 用户 ID
 * @returns 切换后的待办
 * @author xiangwei
 */
export async function toggleTodo(id: string, userId: string): Promise<Todo> {
    const [existing] = await db
        .select()
        .from(todos)
        .where(and(eq(todos.id, id), eq(todos.user_id, userId), eq(todos.is_deleted, 0)))
        .limit(1)
    if (!existing) throw new Error('待办不存在')

    const newStatus = existing.status === 'pending' ? 'completed' : 'pending'
    const now = new Date().toISOString()
    await db
        .update(todos)
        .set({
            status: newStatus,
            completed_at: newStatus === 'completed' ? now : null,
            updated_at: now
        })
        .where(eq(todos.id, id))

    const [updated] = await db.select().from(todos).where(eq(todos.id, id)).limit(1)
    return updated as Todo
}
