/**
 * 智能体任务清单服务集成测试
 * 覆盖批量创建、查询、状态更新、清空、会话隔离与边界校验
 * @author xiangwei
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import * as conversationStore from '../../src/main/agent/memory/conversation-store'
import {
    clearAgentTasks,
    createAgentTasks,
    listAgentTasks,
    updateAgentTaskStatus
} from '../../src/main/services/agent-task.service'
import { createUser } from '../../src/main/services/user.service'

describe('智能体任务清单', () => {
    beforeAll(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterAll(() => closeDatabaseConnection())

    it('完成批量创建、查询、状态更新、清空全流程', async () => {
        const user = await createUser('任务用户')
        const convId = await conversationStore.createConversation(user.id, undefined, 'test-model')

        // 批量创建
        const created = await createAgentTasks(convId, user.id, [
            { title: '查询流水' },
            { title: '汇总分类', sort_order: 5 },
            { title: '生成报告' }
        ])
        expect(created).toHaveLength(3)
        expect(created[0].status).toBe('pending')
        expect(created[0].sort_order).toBe(0)
        expect(created[1].sort_order).toBe(5)

        // 查询
        const list = await listAgentTasks(convId, user.id)
        expect(list).toHaveLength(3)

        // 更新状态
        const updated = await updateAgentTaskStatus(created[0].id, 'completed', user.id, convId)
        expect(updated.status).toBe('completed')

        // 查询确认状态变更
        const afterUpdate = await listAgentTasks(convId, user.id)
        expect(afterUpdate[0].status).toBe('completed')
        expect(afterUpdate[1].status).toBe('pending')

        // 清空
        await clearAgentTasks(convId, user.id)
        const afterClear = await listAgentTasks(convId, user.id)
        expect(afterClear).toHaveLength(0)
    })

    it('会话隔离：不能操作其他用户会话的任务', async () => {
        const userA = await createUser('用户A')
        const userB = await createUser('用户B')
        const convA = await conversationStore.createConversation(userA.id, undefined, 'test-model')

        // A 创建任务
        await createAgentTasks(convA, userA.id, [{ title: 'A的任务' }])

        // B 不能查询 A 的会话任务
        await expect(listAgentTasks(convA, userB.id)).rejects.toThrow('会话不存在或不属于当前用户')

        // B 不能在 A 的会话创建任务
        await expect(createAgentTasks(convA, userB.id, [{ title: 'B的注入' }])).rejects.toThrow(
            '会话不存在或不属于当前用户'
        )
    })

    it('空列表和超过上限抛错', async () => {
        const user = await createUser('边界用户')
        const convId = await conversationStore.createConversation(user.id, undefined, 'test-model')

        await expect(createAgentTasks(convId, user.id, [])).rejects.toThrow('不能为空')

        const tooMany = Array.from({ length: 21 }, (_, i) => ({ title: `任务${i}` }))
        await expect(createAgentTasks(convId, user.id, tooMany)).rejects.toThrow('最多创建')
    })

    it('更新不存在的任务抛错', async () => {
        const user = await createUser('错误用户')
        const convId = await conversationStore.createConversation(user.id, undefined, 'test-model')

        await expect(
            updateAgentTaskStatus('nonexistent-id', 'completed', user.id, convId)
        ).rejects.toThrow('任务不存在')
    })

    it('会话删除时 cascade 清理任务', async () => {
        const user = await createUser('级联用户')
        const convId = await conversationStore.createConversation(user.id, undefined, 'test-model')

        await createAgentTasks(convId, user.id, [{ title: '任务1' }, { title: '任务2' }])
        expect(await listAgentTasks(convId, user.id)).toHaveLength(2)

        // 删除会话应级联清理任务
        await conversationStore.deleteConversation(convId, user.id)

        // 重新创建会话查询任务（旧会话已删，任务应被级联清理）
        const newConvId = await conversationStore.createConversation(
            user.id,
            undefined,
            'test-model'
        )
        const tasks = await listAgentTasks(newConvId, user.id)
        expect(tasks).toHaveLength(0)
    })
})
