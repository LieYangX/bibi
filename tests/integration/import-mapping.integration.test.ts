import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import { createAccount } from '../../src/main/services/account.service'
import { createCategory, createSubCategory } from '../../src/main/services/category.service'
import {
    findImportedExternalIds,
    insertImportReference,
    loadImportMappings,
    upsertAccountMapping,
    upsertCategoryMapping
} from '../../src/main/services/import-mapping.service'
import { createTransaction, deleteTransaction } from '../../src/main/services/transaction.service'
import { createUser } from '../../src/main/services/user.service'

describe('导入映射与幂等引用', () => {
    beforeEach(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterEach(() => closeDatabaseConnection())

    it('按用户和渠道保存并覆盖分类及账户映射', async () => {
        const user = await createUser('映射用户')
        const account = await createAccount(
            { name: '微信零钱', type: 'wechat', initial_balance_cents: 0 },
            user.id
        )
        const category = await createCategory({ name: '外卖', type: 'expense' }, user.id)
        const subCategory = await createSubCategory(
            { category_id: category.id, name: '工作餐' },
            user.id
        )

        upsertCategoryMapping(user.id, 'wechat', 'expense', '商户消费', category.id, null)
        upsertCategoryMapping(user.id, 'wechat', 'expense', '商户消费', category.id, subCategory.id)
        upsertAccountMapping(user.id, 'wechat', 'payment', '零钱', account.id)

        expect(loadImportMappings(user.id, 'wechat')).toEqual({
            categoryMappings: [
                {
                    itemType: 'expense',
                    sourceCategory: '商户消费',
                    categoryId: category.id,
                    subCategoryId: subCategory.id
                }
            ],
            accountMappings: [
                {
                    role: 'payment',
                    sourceAccountKey: '零钱',
                    accountId: account.id
                }
            ]
        })
    })

    it('按用户隔离外部交易号并在流水软删除后继续阻止重导', async () => {
        const firstUser = await createUser('第一导入用户')
        const secondUser = await createUser('第二导入用户')
        const account = await createAccount(
            { name: '支付宝', type: 'alipay', initial_balance_cents: 0 },
            firstUser.id
        )
        const transaction = await createTransaction(
            {
                type: 'expense',
                account_id: account.id,
                amount_cents: 100,
                date: '2026-07-11'
            },
            firstUser.id
        )

        insertImportReference(transaction.id, firstUser.id, 'alipay', 'external-1')
        expect(findImportedExternalIds(firstUser.id, 'alipay', ['external-1'])).toEqual(
            new Set(['external-1'])
        )
        expect(findImportedExternalIds(secondUser.id, 'alipay', ['external-1'])).toEqual(new Set())

        await deleteTransaction(transaction.id, firstUser.id)
        expect(findImportedExternalIds(firstUser.id, 'alipay', ['external-1'])).toEqual(
            new Set(['external-1'])
        )
        expect(() =>
            insertImportReference(transaction.id, firstUser.id, 'alipay', 'external-1')
        ).toThrow()
    })
})
