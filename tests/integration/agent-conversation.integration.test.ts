import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import {
    countUserMessages,
    createConversation,
    getConversation,
    listConversations,
    restoreMessages,
    restoreRecentMessages,
    restoreRecentUserTurns,
    saveMessage,
    updateConversationTitle
} from '../../src/main/agent/memory/conversation-store'
import { createUser } from '../../src/main/services/user.service'
import { getCurrentUserId, runWithBoundUserId } from '../../src/main/services/session.service'

describe('智能体会话用户隔离', () => {
    beforeAll(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterAll(() => closeDatabaseConnection())

    it('拒绝使用其他用户的会话 ID 读取或写入数据', async () => {
        const owner = await createUser('会话所有者')
        const otherUser = await createUser('其他用户')
        const conversationId = await createConversation(owner.id)
        await saveMessage(conversationId, owner.id, 'user', '私密消息')

        expect(await getConversation(conversationId, otherUser.id)).toBeNull()
        await expect(restoreMessages(conversationId, otherUser.id)).rejects.toThrow(
            '会话不存在或不属于当前用户'
        )
        await expect(saveMessage(conversationId, otherUser.id, 'user', '越权写入')).rejects.toThrow(
            '会话不存在或不属于当前用户'
        )
        expect(await updateConversationTitle(conversationId, '越权改名', otherUser.id)).toBe(false)

        const conversation = await getConversation(conversationId, owner.id)
        expect(conversation?.title).toBe('新对话')
        expect(conversation?.messages.map((message) => message.content)).toEqual(['私密消息'])
    })

    it('并发工具任务始终读取各自绑定的用户 ID', async () => {
        const [firstUserId, secondUserId] = await Promise.all([
            runWithBoundUserId('bound-user-1', async () => {
                await Promise.resolve()
                return getCurrentUserId()
            }),
            runWithBoundUserId('bound-user-2', async () => {
                await Promise.resolve()
                return getCurrentUserId()
            })
        ])

        expect(firstUserId).toBe('bound-user-1')
        expect(secondUserId).toBe('bound-user-2')
    })

    it('按游标向前分页读取消息且不重不漏', async () => {
        const owner = await createUser('分页会话用户')
        const conversationId = await createConversation(owner.id)
        const database = getNativeDatabase()
        const insertMessage = database.prepare(
            `INSERT INTO agent_messages (
                id, conversation_id, role, content, created_at
            ) VALUES (?, ?, 'user', ?, ?)`
        )
        const expectedContents: string[] = []
        for (let index = 0; index < 120; index++) {
            const suffix = String(index).padStart(3, '0')
            const content = `消息 ${suffix}`
            expectedContents.push(content)
            insertMessage.run(
                `message-${suffix}`,
                conversationId,
                content,
                new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
            )
        }

        const firstPage = await getConversation(conversationId, owner.id)
        expect(firstPage?.messages).toHaveLength(50)
        expect(firstPage?.next_cursor).not.toBeNull()

        const secondPage = await getConversation(
            conversationId,
            owner.id,
            firstPage?.next_cursor ?? undefined
        )
        expect(secondPage?.messages).toHaveLength(50)
        expect(secondPage?.next_cursor).not.toBeNull()

        const thirdPage = await getConversation(
            conversationId,
            owner.id,
            secondPage?.next_cursor ?? undefined
        )
        expect(thirdPage?.messages).toHaveLength(20)
        expect(thirdPage?.next_cursor).toBeNull()

        const contents = [
            ...(thirdPage?.messages ?? []),
            ...(secondPage?.messages ?? []),
            ...(firstPage?.messages ?? [])
        ].map((message) => message.content)
        expect(contents).toEqual(expectedContents)

        const conversationPage = await listConversations(owner.id)
        expect(
            conversationPage.items.some((conversation) => conversation.id === conversationId)
        ).toBe(true)
    })

    it('按用户轮次恢复最近上下文并统计提炼消息数', async () => {
        const owner = await createUser('记忆窗口用户')
        const conversationId = await createConversation(owner.id)
        for (let index = 1; index <= 3; index++) {
            await saveMessage(conversationId, owner.id, 'user', `问题 ${index}`)
            await saveMessage(conversationId, owner.id, 'tool', `工具 ${index}`)
            await saveMessage(conversationId, owner.id, 'assistant', `回答 ${index}`)
        }

        expect(await countUserMessages(owner.id)).toBe(3)
        expect(await restoreRecentMessages(conversationId, owner.id, 2)).toEqual([
            { role: 'user', content: '问题 2' },
            { role: 'assistant', content: '回答 2' },
            { role: 'user', content: '问题 3' },
            { role: 'assistant', content: '回答 3' }
        ])
        expect(await restoreRecentUserTurns(owner.id, 1)).toEqual([
            { role: 'user', content: '问题 3' },
            { role: 'assistant', content: '回答 3' }
        ])
    })

    it('持久化并读取历史消息的思考时间', async () => {
        const owner = await createUser('思考时间用户')
        const conversationId = await createConversation(owner.id)
        await saveMessage(conversationId, owner.id, 'assistant', '分析完成', {
            thinking: '分析历史数据',
            thinking_duration_ms: 2_345
        })

        const conversation = await getConversation(conversationId, owner.id)
        expect(conversation?.messages).toHaveLength(1)
        expect(conversation?.messages[0]).toMatchObject({
            thinking: '分析历史数据',
            thinking_duration_ms: 2_345
        })
    })
})
