import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import { createAccount } from '../../src/main/services/account.service'
import { createCategory, createSubCategory } from '../../src/main/services/category.service'
import {
    createTransaction,
    deleteTransactions,
    deleteTransaction,
    listTransactions,
    updateTransaction
} from '../../src/main/services/transaction.service'
import { createUser } from '../../src/main/services/user.service'

describe('核心记账事务', () => {
    beforeAll(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterAll(() => closeDatabaseConnection())

    it('创建、修改和删除流水时原子维护账户余额', async () => {
        const user = await createUser('测试用户')
        const account = await createAccount(
            {
                name: '现金',
                type: 'cash',
                initial_balance_cents: 10_000,
                is_default: true
            },
            user.id
        )
        const transaction = await createTransaction(
            {
                type: 'expense',
                account_id: account.id,
                amount_cents: 1_500,
                date: '2026-07-11'
            },
            user.id
        )
        expect(readBalance(account.id)).toBe(8_500)

        await updateTransaction(transaction.id, { type: 'income', amount_cents: 2_000 }, user.id)
        expect(readBalance(account.id)).toBe(12_000)

        await deleteTransaction(transaction.id, user.id)
        expect(readBalance(account.id)).toBe(10_000)
    })

    it('拒绝引用其他用户的账户', async () => {
        const firstUser = await createUser('甲用户')
        const secondUser = await createUser('乙用户')
        const secondAccount = await createAccount(
            { name: '乙账户', type: 'bank', initial_balance_cents: 0 },
            secondUser.id
        )

        await expect(
            createTransaction(
                {
                    type: 'expense',
                    account_id: secondAccount.id,
                    amount_cents: 100,
                    date: '2026-07-11'
                },
                firstUser.id
            )
        ).rejects.toThrow('账户不存在或不属于当前用户')
        expect(readBalance(secondAccount.id)).toBe(0)
    })

    it('并发迁移同一流水时清理全部旧账户余额', async () => {
        const user = await createUser('并发更新用户')
        const sourceAccount = await createAccount(
            { name: '原账户', type: 'cash', initial_balance_cents: 10_000 },
            user.id
        )
        const firstTarget = await createAccount(
            { name: '第一目标账户', type: 'bank', initial_balance_cents: 20_000 },
            user.id
        )
        const secondTarget = await createAccount(
            { name: '第二目标账户', type: 'bank', initial_balance_cents: 30_000 },
            user.id
        )
        const transaction = await createTransaction(
            {
                type: 'expense',
                account_id: sourceAccount.id,
                amount_cents: 1_000,
                date: '2026-07-11'
            },
            user.id
        )

        await Promise.all([
            updateTransaction(transaction.id, { account_id: firstTarget.id }, user.id),
            updateTransaction(transaction.id, { account_id: secondTarget.id }, user.id)
        ])

        expect(readBalance(sourceAccount.id)).toBe(10_000)
        expect(readBalance(firstTarget.id)).toBe(20_000)
        expect(readBalance(secondTarget.id)).toBe(29_000)
    })

    it('更新与删除交错时按最新流水账户重算余额', async () => {
        const user = await createUser('并发删除用户')
        const sourceAccount = await createAccount(
            { name: '删除前账户', type: 'cash', initial_balance_cents: 10_000 },
            user.id
        )
        const targetAccount = await createAccount(
            { name: '删除时账户', type: 'bank', initial_balance_cents: 20_000 },
            user.id
        )
        const transaction = await createTransaction(
            {
                type: 'expense',
                account_id: sourceAccount.id,
                amount_cents: 1_000,
                date: '2026-07-11'
            },
            user.id
        )

        const updatePromise = updateTransaction(
            transaction.id,
            { account_id: targetAccount.id },
            user.id
        )
        await Promise.resolve()
        await Promise.resolve()
        const deletePromise = deleteTransaction(transaction.id, user.id)
        await Promise.all([updatePromise, deletePromise])

        expect(readBalance(sourceAccount.id)).toBe(10_000)
        expect(readBalance(targetAccount.id)).toBe(20_000)
    })

    it('拒绝脱离一级分类或父子不匹配的二级分类', async () => {
        const user = await createUser('分类校验用户')
        const account = await createAccount(
            { name: '分类测试账户', type: 'cash', initial_balance_cents: 0 },
            user.id
        )
        const firstCategory = await createCategory({ name: '第一分类', type: 'expense' }, user.id)
        const secondCategory = await createCategory({ name: '第二分类', type: 'expense' }, user.id)
        const subCategory = await createSubCategory(
            { category_id: firstCategory.id, name: '二级分类' },
            user.id
        )
        const baseTransaction = {
            type: 'expense' as const,
            account_id: account.id,
            amount_cents: 100,
            date: '2026-07-11'
        }

        await expect(
            createTransaction({ ...baseTransaction, sub_category_id: subCategory.id }, user.id)
        ).rejects.toThrow('选择二级分类时必须选择一级分类')
        await expect(
            createTransaction(
                {
                    ...baseTransaction,
                    category_id: secondCategory.id,
                    sub_category_id: subCategory.id
                },
                user.id
            )
        ).rejects.toThrow('二级分类与一级分类不匹配')
    })

    it('使用稳定游标滚动分页并事务化批量删除', async () => {
        const user = await createUser('滚动分页用户')
        const account = await createAccount(
            { name: '滚动分页账户', type: 'cash', initial_balance_cents: 10_000 },
            user.id
        )
        const first = await createTransaction(
            {
                type: 'expense',
                account_id: account.id,
                amount_cents: 100,
                date: '2026-07-13'
            },
            user.id
        )
        const second = await createTransaction(
            {
                type: 'expense',
                account_id: account.id,
                amount_cents: 200,
                date: '2026-07-13'
            },
            user.id
        )
        const third = await createTransaction(
            {
                type: 'income',
                account_id: account.id,
                amount_cents: 500,
                date: '2026-07-12'
            },
            user.id
        )

        const firstPage = await listTransactions(user.id, { page_size: 2 })
        expect(firstPage.items).toHaveLength(2)
        expect(firstPage.has_more).toBe(true)
        expect(firstPage.next_cursor).not.toBeNull()
        const secondPage = await listTransactions(user.id, {
            page_size: 2,
            cursor: firstPage.next_cursor ?? undefined
        })
        expect(secondPage.items).toHaveLength(1)
        expect(secondPage.has_more).toBe(false)
        expect(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id))).toEqual(
            new Set([first.id, second.id, third.id])
        )

        await expect(deleteTransactions([first.id, 'missing-id'], user.id)).rejects.toThrow(
            '部分流水不存在或不属于当前用户'
        )
        expect(readBalance(account.id)).toBe(10_200)

        const result = await deleteTransactions([first.id, second.id], user.id)
        expect(result.deleted_count).toBe(2)
        expect(readBalance(account.id)).toBe(10_500)
    })
})

function readBalance(accountId: string): number {
    const row = getNativeDatabase()
        .prepare('SELECT balance_cents FROM accounts WHERE id = ?')
        .get(accountId) as { balance_cents: number }
    return row.balance_cents
}
