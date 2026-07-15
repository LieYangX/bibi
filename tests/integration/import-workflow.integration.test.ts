import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import { createAccount } from '../../src/main/services/account.service'
import { createCategory } from '../../src/main/services/category.service'
import {
    applyImportDraftOperation,
    type ImportDraftData,
    type ImportDraftEntry
} from '../../src/main/services/import-draft.service'
import { loadImportMappings } from '../../src/main/services/import-mapping.service'
import { confirmImportDraft, createImportDraft } from '../../src/main/services/import.service'
import { createUser } from '../../src/main/services/user.service'

describe('导入草稿最终确认', () => {
    beforeEach(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterEach(() => closeDatabaseConnection())

    it('在一个事务中写入流水、幂等引用和稳定映射', async () => {
        const user = await createUser('草稿确认用户')
        const account = await createAccount(
            { name: '招商银行卡', type: 'bank', initial_balance_cents: 10_000 },
            user.id
        )
        const expenseCategory = await createCategory({ name: '导入购物', type: 'expense' }, user.id)
        const incomeCategory = await createCategory({ name: '导入退款', type: 'income' }, user.id)
        const draft = createDraft([
            createEntry({
                id: 'expense-row',
                type: 'expense',
                accountId: account.id,
                categoryId: expenseCategory.id,
                externalId: 'alipay-expense-1',
                sourceCategory: '日用百货',
                amountCents: 1_000
            }),
            createEntry({
                id: 'income-row',
                type: 'income',
                accountId: account.id,
                categoryId: incomeCategory.id,
                externalId: 'alipay-refund-1',
                sourceCategory: '退款',
                amountCents: 300
            })
        ])

        const result = await confirmImportDraft(user.id, draft, true)
        expect(result).toEqual({
            success_count: 2,
            skip_count: 0,
            expense_cents: 1_000,
            income_cents: 300
        })
        expect(readCount('transactions', user.id)).toBe(2)
        expect(readCount('transaction_import_refs', user.id)).toBe(2)
        expect(readCount('import_category_mappings', user.id)).toBe(2)
        expect(readCount('import_account_mappings', user.id)).toBe(2)
        expect(readBalance(account.id)).toBe(9_300)

        const repeated = await confirmImportDraft(user.id, draft, true)
        expect(repeated.success_count).toBe(0)
        expect(repeated.skip_count).toBe(2)
        expect(readCount('transactions', user.id)).toBe(2)
        expect(readBalance(account.id)).toBe(9_300)
    })

    it('任一关联对象非法时整批不写入', async () => {
        const user = await createUser('草稿回滚用户')
        const account = await createAccount(
            { name: '现金', type: 'cash', initial_balance_cents: 0 },
            user.id
        )
        const category = await createCategory({ name: '有效分类', type: 'expense' }, user.id)
        const draft = createDraft([
            createEntry({
                id: 'valid-row',
                type: 'expense',
                accountId: account.id,
                categoryId: category.id,
                externalId: 'valid-external-id',
                sourceCategory: '餐饮美食',
                amountCents: 100
            }),
            createEntry({
                id: 'invalid-row',
                type: 'expense',
                accountId: 'missing-account',
                categoryId: category.id,
                externalId: 'invalid-external-id',
                sourceCategory: '日用百货',
                amountCents: 200
            })
        ])

        await expect(confirmImportDraft(user.id, draft, false)).rejects.toThrow(
            '账户不存在或不属于当前用户'
        )
        expect(readCount('transactions', user.id)).toBe(0)
        expect(readCount('transaction_import_refs', user.id)).toBe(0)
        expect(readBalance(account.id)).toBe(0)
    })

    it('更新项校验失败时保持原明细和版本号不变', async () => {
        const user = await createUser('草稿原子更新用户')
        const account = await createAccount(
            { name: '原账户', type: 'cash', initial_balance_cents: 0 },
            user.id
        )
        const replacementAccount = await createAccount(
            { name: '替换账户', type: 'bank', initial_balance_cents: 0 },
            user.id
        )
        const category = await createCategory({ name: '原分类', type: 'expense' }, user.id)
        const baseEntry = createEntry({
            id: 'atomic-row',
            type: 'expense',
            accountId: account.id,
            categoryId: category.id,
            externalId: 'atomic-external-id',
            sourceCategory: '餐饮美食',
            amountCents: 100
        })

        const invalidAccountDraft = createDraft([cloneEntry(baseEntry)])
        const originalAccountItem = cloneEntry(invalidAccountDraft.items[0])
        expect(() =>
            applyImportDraftOperation(invalidAccountDraft, user.id, {
                kind: 'update-item',
                item_id: baseEntry.id,
                changes: { type: 'income', account_id: 'missing-account' }
            })
        ).toThrow('账户不存在或不属于当前用户')
        expect(invalidAccountDraft.items[0]).toEqual(originalAccountItem)
        expect(invalidAccountDraft.revision).toBe(0)

        const invalidCategoryDraft = createDraft([cloneEntry(baseEntry)])
        const originalCategoryItem = cloneEntry(invalidCategoryDraft.items[0])
        expect(() =>
            applyImportDraftOperation(invalidCategoryDraft, user.id, {
                kind: 'update-item',
                item_id: baseEntry.id,
                changes: {
                    account_id: replacementAccount.id,
                    category_id: 'missing-category'
                }
            })
        ).toThrow('分类不存在或不属于当前用户')
        expect(invalidCategoryDraft.items[0]).toEqual(originalCategoryItem)
        expect(invalidCategoryDraft.revision).toBe(0)
    })

    it('创建草稿时将文件内后出现的同订单号记录标记为重复', async () => {
        const user = await createUser('文件内去重用户')
        const fixtureDirectory = mkdtempSync(join(tmpdir(), 'bibi-import-workflow-'))
        const filePath = join(fixtureDirectory, 'duplicate-alipay.csv')
        const header = [
            '交易时间',
            '交易分类',
            '交易对方',
            '商品说明',
            '收/支',
            '金额',
            '收/付款方式',
            '交易状态',
            '交易订单号',
            '备注'
        ]
        const firstRow = [
            '2026-07-10 10:00:00',
            '餐饮美食',
            '示例餐厅',
            '早餐',
            '支出',
            '10.00',
            '余额宝',
            '交易成功',
            'same-external-id',
            ''
        ]
        const secondRow = [
            '2026-07-10 10:01:00',
            '餐饮美食',
            '示例餐厅',
            '加餐',
            '支出',
            '5.00',
            '余额宝',
            '交易成功',
            'same-external-id',
            ''
        ]

        try {
            writeFileSync(
                filePath,
                [header, firstRow, secondRow].map((row) => row.join(',')).join('\r\n'),
                'utf-8'
            )
            const draft = await createImportDraft(filePath, 'alipay', user.id, Date.now() + 60_000)

            expect(
                draft.items.map(({ is_duplicate, included }) => ({ is_duplicate, included }))
            ).toEqual([
                { is_duplicate: false, included: true },
                { is_duplicate: true, included: false }
            ])
        } finally {
            rmSync(fixtureDirectory, { recursive: true, force: true })
        }
    })

    it('仅记忆最终实际导入条目的分类与账户映射', async () => {
        const user = await createUser('实际导入映射用户')
        const account = await createAccount(
            { name: '实际导入账户', type: 'bank', initial_balance_cents: 0 },
            user.id
        )
        const importedCategory = await createCategory(
            { name: '实际导入分类', type: 'expense' },
            user.id
        )
        const excludedCategory = await createCategory(
            { name: '排除项分类', type: 'expense' },
            user.id
        )
        const importedEntry = createEntry({
            id: 'imported-row',
            type: 'expense',
            accountId: account.id,
            categoryId: importedCategory.id,
            externalId: 'imported-external-id',
            sourceCategory: '餐饮美食',
            amountCents: 100
        })
        importedEntry.source.account_key = '实际导入账户键'
        const excludedEntry = createEntry({
            id: 'excluded-row',
            type: 'expense',
            accountId: account.id,
            categoryId: excludedCategory.id,
            externalId: 'excluded-external-id',
            sourceCategory: '服饰装扮',
            amountCents: 200
        })
        excludedEntry.included = false
        excludedEntry.source.account_key = '排除项账户键'

        await confirmImportDraft(user.id, createDraft([importedEntry, excludedEntry]), true)

        expect(loadImportMappings(user.id, 'alipay')).toEqual({
            categoryMappings: [
                {
                    itemType: 'expense',
                    sourceCategory: '餐饮美食',
                    categoryId: importedCategory.id,
                    subCategoryId: null
                }
            ],
            accountMappings: [
                {
                    role: 'payment',
                    sourceAccountKey: '实际导入账户键',
                    accountId: account.id
                }
            ]
        })
    })
})

interface EntryInput {
    id: string
    type: 'expense' | 'income'
    accountId: string
    categoryId: string
    externalId: string
    sourceCategory: string
    amountCents: number
}

function createEntry(input: EntryInput): ImportDraftEntry {
    return {
        id: input.id,
        included: true,
        type: input.type,
        account_id: input.accountId,
        category_id: input.categoryId,
        sub_category_id: null,
        date: '2026-07-11',
        amount_cents: input.amountCents,
        note: input.id,
        source: {
            category: input.sourceCategory,
            transaction_type: input.sourceCategory,
            direction: input.type === 'expense' ? '支出' : '收入',
            account_raw: '招商银行储蓄卡',
            account_key: '招商银行储蓄卡',
            status: '交易成功',
            counterparty: '',
            product: ''
        },
        external_transaction_id: input.externalId,
        exclusion_reason: null,
        invalid_reason: null,
        is_duplicate: false,
        duplicate_reason: null
    }
}

function createDraft(items: ImportDraftEntry[]): ImportDraftData {
    return {
        draft_id: 'draft-1',
        revision: 0,
        source: 'alipay',
        file_name: 'alipay.csv',
        expires_at: Date.now() + 60_000,
        items
    }
}

function cloneEntry(item: ImportDraftEntry): ImportDraftEntry {
    return { ...item, source: { ...item.source } }
}

function readCount(table: string, userId: string): number {
    const row = getNativeDatabase()
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ?`)
        .get(userId) as { count: number }
    return row.count
}

function readBalance(accountId: string): number {
    const row = getNativeDatabase()
        .prepare('SELECT balance_cents FROM accounts WHERE id = ?')
        .get(accountId) as { balance_cents: number }
    return row.balance_cents
}
