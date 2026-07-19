/**
 * 待办服务集成测试
 * 覆盖创建、查询、更新、切换状态、软删除与用户隔离
 * @author xiangwei
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import {
    createTodo,
    deleteTodo,
    listTodos,
    toggleTodo,
    updateTodo
} from '../../src/main/services/todo.service'
import { createUser } from '../../src/main/services/user.service'

describe('待办管理', () => {
    beforeAll(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterAll(() => closeDatabaseConnection())

    it('完成创建、查询、更新、切换、软删除全流程', async () => {
        const user = await createUser('待办用户')

        // 创建
        const todo = await createTodo({ title: '交水电费', due_date: '2026-07-20' }, user.id)
        expect(todo).toMatchObject({
            user_id: user.id,
            title: '交水电费',
            status: 'pending',
            due_date: '2026-07-20',
            completed_at: null,
            is_deleted: 0
        })

        // 查询
        const list = await listTodos(user.id, {})
        expect(list).toHaveLength(1)
        expect(list[0].id).toBe(todo.id)

        // 更新标题
        const updated = await updateTodo(todo.id, { title: '交水电费（7月）' }, user.id)
        expect(updated?.title).toBe('交水电费（7月）')
        expect(updated?.due_date).toBe('2026-07-20')

        // 切换为已完成
        const toggled = await toggleTodo(todo.id, user.id)
        expect(toggled.status).toBe('completed')
        expect(toggled.completed_at).not.toBeNull()

        // 再次切换回 pending
        const toggledBack = await toggleTodo(todo.id, user.id)
        expect(toggledBack.status).toBe('pending')
        expect(toggledBack.completed_at).toBeNull()

        // 软删除后不出现在列表
        await deleteTodo(todo.id, user.id)
        const afterDelete = await listTodos(user.id, {})
        expect(afterDelete).toHaveLength(0)
    })

    it('按状态、日期范围与关键字过滤待办', async () => {
        const user = await createUser('过滤用户')

        await createTodo({ title: '任务1', due_date: '2026-07-15' }, user.id)
        await createTodo({ title: '任务2', due_date: '2026-07-20' }, user.id)
        await createTodo({ title: '任务3' }, user.id)

        // 状态过滤
        const pending = await listTodos(user.id, { status: 'pending' })
        expect(pending).toHaveLength(3)

        // 日期范围过滤
        const byDate = await listTodos(user.id, { due_start: '2026-07-15', due_end: '2026-07-15' })
        expect(byDate).toHaveLength(1)
        expect(byDate[0].title).toBe('任务1')

        // 起始日期过滤（包含 due_date >= 2026-07-15 的，无 due_date 的不返回）
        const fromStart = await listTodos(user.id, { due_start: '2026-07-15' })
        expect(fromStart).toHaveLength(2)

        // 关键字过滤
        const keyword = await listTodos(user.id, { keyword: '任务2' })
        expect(keyword).toHaveLength(1)
        expect(keyword[0].title).toBe('任务2')
    })

    it('用户隔离：不能查询或操作其他用户的待办', async () => {
        const userA = await createUser('用户A')
        const userB = await createUser('用户B')

        const todo = await createTodo({ title: 'A的任务' }, userA.id)

        // B 查不到 A 的待办
        const listB = await listTodos(userB.id, {})
        expect(listB).toHaveLength(0)

        // B 更新 A 的待办返回 null
        const updated = await updateTodo(todo.id, { title: '被B改了' }, userB.id)
        expect(updated).toBeNull()

        // A 的待办标题未变
        const listA = await listTodos(userA.id, {})
        expect(listA[0].title).toBe('A的任务')

        // B 切换 A 的待办抛错
        await expect(toggleTodo(todo.id, userB.id)).rejects.toThrow('待办不存在')
    })

    it('切换不存在的待办抛错', async () => {
        const user = await createUser('错误用户')
        await expect(toggleTodo('nonexistent-id', user.id)).rejects.toThrow('待办不存在')
    })

    it('软删除后可重新创建同标题待办', async () => {
        const user = await createUser('软删用户')
        const t1 = await createTodo({ title: '重复任务' }, user.id)
        await deleteTodo(t1.id, user.id)
        const t2 = await createTodo({ title: '重复任务' }, user.id)
        const list = await listTodos(user.id, {})
        expect(list).toHaveLength(1)
        expect(list[0].id).toBe(t2.id)
    })
})
