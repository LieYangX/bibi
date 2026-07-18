/**
 * 流水管理服务
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { alias } from 'drizzle-orm/sqlite-core'
import { and, asc, count, desc, eq, gt, like, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { Workbook } from 'exceljs'
import type {
    BatchDeleteTransactionsResult,
    CreateTransactionDTO,
    ExportTransactionsResult,
    Transaction,
    TransactionFilter,
    TransactionListResult,
    TransactionType,
    UpdateTransactionDTO
} from '@shared/types'
import {
    accounts,
    categories,
    db,
    getNativeDatabase,
    subCategories,
    transactions
} from '../database/drizzle'
import { recomputeAccountBalance } from './account-balance.service'

/**
 * 校验流水关联对象均属于当前用户
 *
 * @param data 流水数据
 * @param userId 用户 ID
 * @param database SQLite 数据库连接
 * @author xiangwei
 */
function validateRelations(
    data: CreateTransactionDTO,
    userId: string,
    database: ReturnType<typeof getNativeDatabase>
): void {
    const accountIds = [data.account_id]
    if (data.type === 'transfer') {
        if (!data.target_account_id) {
            throw new Error('请选择转入账户')
        }
        if (data.account_id === data.target_account_id) {
            throw new Error('转账账户不能相同')
        }
        accountIds.push(data.target_account_id)
    }

    const findAccount = database.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
    for (const accountId of new Set(accountIds)) {
        if (!findAccount.get(accountId, userId)) {
            throw new Error('账户不存在或不属于当前用户')
        }
    }

    if (data.sub_category_id && !data.category_id) {
        throw new Error('选择二级分类时必须选择一级分类')
    }

    if (data.category_id) {
        const category = database
            .prepare('SELECT id, type FROM categories WHERE id = ? AND user_id = ?')
            .get(data.category_id, userId) as { id: string; type: string } | undefined
        if (!category) {
            throw new Error('分类不存在或不属于当前用户')
        }
        if ((data.type === 'expense' || data.type === 'income') && category.type !== data.type) {
            throw new Error('分类类型与流水类型不匹配')
        }
    }

    if (data.sub_category_id) {
        const subCategory = database
            .prepare(
                `SELECT sub_categories.category_id AS categoryId
                 FROM sub_categories
                 INNER JOIN categories ON sub_categories.category_id = categories.id
                 WHERE sub_categories.id = ? AND categories.user_id = ?`
            )
            .get(data.sub_category_id, userId) as { categoryId: string } | undefined
        if (!subCategory) {
            throw new Error('二级分类不存在或不属于当前用户')
        }
        if (subCategory.categoryId !== data.category_id) {
            throw new Error('二级分类与一级分类不匹配')
        }
    }
}

/**
 * 校验流水基础字段
 *
 * @param data 流水数据
 * @author xiangwei
 */
function validateTransaction(data: CreateTransactionDTO): void {
    if (!Number.isInteger(data.amount_cents) || data.amount_cents <= 0) {
        throw new Error('金额必须是大于 0 的整数分值')
    }
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date)
    if (!dateParts) {
        throw new Error('日期格式必须为 YYYY-MM-DD')
    }
    const year = Number(dateParts[1])
    const month = Number(dateParts[2])
    const day = Number(dateParts[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error('日期不存在')
    }

    // 校验时间格式（可选，格式 HH:mm）
    if (data.time) {
        const timeParts = /^(\d{2}):(\d{2})$/.exec(data.time)
        if (!timeParts) {
            throw new Error('时间格式必须为 HH:mm')
        }
        const hour = Number(timeParts[1])
        const minute = Number(timeParts[2])
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new Error('时间不存在')
        }
    }
}

/**
 * 创建流水
 *
 * @param data 流水数据
 * @param userId 用户 ID
 * @returns 新流水
 * @author xiangwei
 */
export async function createTransaction(
    data: CreateTransactionDTO,
    userId: string
): Promise<Transaction> {
    validateTransaction(data)

    const now = new Date().toISOString()
    const id = randomUUID()
    const targetAccountId = data.type === 'transfer' ? data.target_account_id : null
    const categoryId = data.type === 'transfer' ? null : data.category_id || null
    const subCategoryId = data.type === 'transfer' ? null : data.sub_category_id || null

    const database = getNativeDatabase()
    const writeTransaction = database.transaction(() => {
        validateRelations(data, userId, database)

        database
            .prepare(
                `INSERT INTO transactions (
                    id, user_id, type, account_id, target_account_id, category_id,
                    sub_category_id, amount_cents, date, time, note, created_at, updated_at
                ) VALUES (
                    @id, @userId, @type, @accountId, @targetAccountId, @categoryId,
                    @subCategoryId, @amountCents, @date, @time, @note, @now, @now
                )`
            )
            .run({
                id,
                userId,
                type: data.type,
                accountId: data.account_id,
                targetAccountId,
                categoryId,
                subCategoryId,
                amountCents: data.amount_cents,
                date: data.date,
                time: data.time ?? null,
                note: data.note || null,
                now
            })
        recomputeAccountBalance(data.account_id, userId)
        if (targetAccountId) recomputeAccountBalance(targetAccountId, userId)

        const transaction = database
            .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
            .get(id, userId) as Transaction | undefined
        if (!transaction) throw new Error('流水创建后未能读取')
        return transaction
    })
    return writeTransaction()
}

/**
 * 更新流水
 *
 * @param id 流水 ID
 * @param data 更新数据
 * @param userId 用户 ID
 * @returns 更新后的流水
 * @author xiangwei
 */
export async function updateTransaction(
    id: string,
    data: UpdateTransactionDTO,
    userId: string
): Promise<Transaction> {
    const database = getNativeDatabase()
    const writeTransaction = database.transaction(() => {
        const oldTransaction = database
            .prepare(
                `SELECT * FROM transactions
                 WHERE id = ? AND user_id = ? AND is_deleted = 0`
            )
            .get(id, userId) as Transaction | undefined
        if (!oldTransaction) {
            throw new Error('流水不存在')
        }

        const type = (data.type ?? oldTransaction.type) as TransactionType
        const nextData: CreateTransactionDTO = {
            type,
            account_id: data.account_id ?? oldTransaction.account_id,
            target_account_id:
                data.target_account_id === undefined
                    ? oldTransaction.target_account_id
                    : data.target_account_id,
            category_id:
                data.category_id === undefined ? oldTransaction.category_id : data.category_id,
            sub_category_id:
                data.sub_category_id === undefined
                    ? oldTransaction.sub_category_id
                    : data.sub_category_id,
            amount_cents: data.amount_cents ?? oldTransaction.amount_cents,
            date: data.date ?? oldTransaction.date,
            time: data.time === undefined ? oldTransaction.time : data.time,
            note: data.note === undefined ? oldTransaction.note : data.note
        }
        validateTransaction(nextData)
        validateRelations(nextData, userId, database)

        const targetAccountId = type === 'transfer' ? nextData.target_account_id : null
        const categoryId = type === 'transfer' ? null : nextData.category_id || null
        const subCategoryId = type === 'transfer' ? null : nextData.sub_category_id || null
        const affectedAccountIds = new Set<string>([oldTransaction.account_id, nextData.account_id])
        if (oldTransaction.target_account_id) {
            affectedAccountIds.add(oldTransaction.target_account_id)
        }
        if (targetAccountId) affectedAccountIds.add(targetAccountId)

        database
            .prepare(
                `UPDATE transactions
                 SET type = @type,
                     account_id = @accountId,
                     target_account_id = @targetAccountId,
                     category_id = @categoryId,
                     sub_category_id = @subCategoryId,
                     amount_cents = @amountCents,
                     date = @date,
                     time = @time,
                     note = @note,
                     updated_at = @updatedAt
                 WHERE id = @id AND user_id = @userId`
            )
            .run({
                id,
                userId,
                type,
                accountId: nextData.account_id,
                targetAccountId,
                categoryId,
                subCategoryId,
                amountCents: nextData.amount_cents,
                date: nextData.date,
                time: nextData.time ?? null,
                note: nextData.note || null,
                updatedAt: new Date().toISOString()
            })
        for (const accountId of affectedAccountIds) {
            recomputeAccountBalance(accountId, userId)
        }

        const transaction = database
            .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
            .get(id, userId) as Transaction | undefined
        if (!transaction) throw new Error('流水更新后未能读取')
        return transaction
    })
    return writeTransaction()
}

/**
 * 软删除流水
 *
 * @param id 流水 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function deleteTransaction(id: string, userId: string): Promise<void> {
    const database = getNativeDatabase()
    const writeTransaction = database.transaction(() => {
        const transaction = database
            .prepare(
                `SELECT account_id, target_account_id
                 FROM transactions
                 WHERE id = ? AND user_id = ? AND is_deleted = 0`
            )
            .get(id, userId) as { account_id: string; target_account_id: string | null } | undefined
        if (!transaction) {
            throw new Error('流水不存在')
        }

        const affectedAccountIds = new Set<string>([transaction.account_id])
        if (transaction.target_account_id) {
            affectedAccountIds.add(transaction.target_account_id)
        }

        database
            .prepare(
                `UPDATE transactions
                 SET is_deleted = 1, updated_at = ?
                 WHERE id = ? AND user_id = ? AND is_deleted = 0`
            )
            .run(new Date().toISOString(), id, userId)

        for (const accountId of affectedAccountIds) {
            recomputeAccountBalance(accountId, userId)
        }
    })
    writeTransaction()
}

/**
 * 在单个事务中批量软删除流水
 *
 * @param ids 流水 ID 列表
 * @param userId 用户 ID
 * @returns 实际删除数量
 * @author xiangwei
 */
export async function deleteTransactions(
    ids: string[],
    userId: string
): Promise<BatchDeleteTransactionsResult> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return { deleted_count: 0 }

    const database = getNativeDatabase()
    const placeholders = uniqueIds.map(() => '?').join(', ')
    const writeTransaction = database.transaction(() => {
        const rows = database
            .prepare(
                `SELECT id, account_id, target_account_id
                 FROM transactions
                 WHERE user_id = ? AND is_deleted = 0 AND id IN (${placeholders})`
            )
            .all(userId, ...uniqueIds) as Array<{
            id: string
            account_id: string
            target_account_id: string | null
        }>
        if (rows.length !== uniqueIds.length) {
            throw new Error('部分流水不存在或不属于当前用户')
        }

        const affectedAccountIds = new Set<string>()
        for (const row of rows) {
            affectedAccountIds.add(row.account_id)
            if (row.target_account_id) affectedAccountIds.add(row.target_account_id)
        }

        const result = database
            .prepare(
                `UPDATE transactions
                 SET is_deleted = 1, updated_at = ?
                 WHERE user_id = ? AND is_deleted = 0 AND id IN (${placeholders})`
            )
            .run(new Date().toISOString(), userId, ...uniqueIds)

        for (const accountId of affectedAccountIds) {
            recomputeAccountBalance(accountId, userId)
        }
        return { deleted_count: result.changes }
    })
    return writeTransaction()
}

/**
 * 查询流水列表
 *
 * @param userId 用户 ID
 * @param filter 筛选条件
 * @returns 分页流水列表
 * @author xiangwei
 */
export async function listTransactions(
    userId: string,
    filter: TransactionFilter = {}
): Promise<TransactionListResult> {
    const conditions: SQL[] = [eq(transactions.user_id, userId), eq(transactions.is_deleted, 0)]
    if (filter.start_date) conditions.push(sql`${transactions.date} >= ${filter.start_date}`)
    if (filter.end_date) conditions.push(sql`${transactions.date} <= ${filter.end_date}`)
    if (filter.type && filter.type !== 'all') {
        conditions.push(eq(transactions.type, filter.type))
    }
    if (filter.account_id) {
        conditions.push(
            sql`(${transactions.account_id} = ${filter.account_id} OR ${transactions.target_account_id} = ${filter.account_id})`
        )
    }
    if (filter.category_id) conditions.push(eq(transactions.category_id, filter.category_id))
    if (filter.keyword) conditions.push(like(transactions.note, `%${filter.keyword}%`))

    const [countRow] = await db
        .select({ value: count() })
        .from(transactions)
        .where(and(...conditions))
    const page = Math.max(1, filter.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, filter.page_size ?? 50))
    const orderColumn =
        filter.sort_field === 'amount_cents' ? transactions.amount_cents : transactions.date
    const targetAccounts = alias(accounts, 'target_accounts')
    const queryConditions = [...conditions]
    const isAscending = filter.sort_order === 'asc'
    if (filter.cursor && filter.sort_field !== 'amount_cents') {
        const cursorCondition = or(
            isAscending
                ? gt(transactions.date, filter.cursor.date)
                : lt(transactions.date, filter.cursor.date),
            and(
                eq(transactions.date, filter.cursor.date),
                isAscending
                    ? gt(transactions.id, filter.cursor.id)
                    : lt(transactions.id, filter.cursor.id)
            )
        )
        if (cursorCondition) queryConditions.push(cursorCondition)
    }

    const rows = await db
        .select({
            id: transactions.id,
            user_id: transactions.user_id,
            type: transactions.type,
            account_id: transactions.account_id,
            target_account_id: transactions.target_account_id,
            category_id: transactions.category_id,
            sub_category_id: transactions.sub_category_id,
            amount_cents: transactions.amount_cents,
            date: transactions.date,
            time: transactions.time,
            note: transactions.note,
            transfer_pair_id: transactions.transfer_pair_id,
            is_deleted: transactions.is_deleted,
            created_at: transactions.created_at,
            updated_at: transactions.updated_at,
            account_name: accounts.name,
            target_account_name: targetAccounts.name,
            category_name: categories.name,
            sub_category_name: subCategories.name,
            category_color: categories.color
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.account_id, accounts.id))
        .leftJoin(targetAccounts, eq(transactions.target_account_id, targetAccounts.id))
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .leftJoin(subCategories, eq(transactions.sub_category_id, subCategories.id))
        .where(and(...queryConditions))
        .orderBy(
            isAscending ? asc(orderColumn) : desc(orderColumn),
            isAscending ? asc(transactions.id) : desc(transactions.id)
        )
        .limit(pageSize + 1)
        .offset(filter.cursor ? 0 : (page - 1) * pageSize)

    const hasMore = rows.length > pageSize
    const items = rows.slice(0, pageSize) as Transaction[]
    const lastItem = items.at(-1)

    return {
        items,
        total: countRow?.value ?? 0,
        page,
        page_size: pageSize,
        has_more: hasMore,
        next_cursor:
            hasMore && lastItem && filter.sort_field !== 'amount_cents'
                ? { date: lastItem.date, id: lastItem.id }
                : null
    }
}

/**
 * 获取流水详情
 *
 * @param id 流水 ID
 * @param userId 用户 ID
 * @returns 流水详情
 * @author xiangwei
 */
export async function getTransactionById(id: string, userId: string): Promise<Transaction | null> {
    const targetAccounts = alias(accounts, 'target_accounts')
    const [item] = await db
        .select({
            id: transactions.id,
            user_id: transactions.user_id,
            type: transactions.type,
            account_id: transactions.account_id,
            target_account_id: transactions.target_account_id,
            category_id: transactions.category_id,
            sub_category_id: transactions.sub_category_id,
            amount_cents: transactions.amount_cents,
            date: transactions.date,
            time: transactions.time,
            note: transactions.note,
            transfer_pair_id: transactions.transfer_pair_id,
            is_deleted: transactions.is_deleted,
            created_at: transactions.created_at,
            updated_at: transactions.updated_at,
            account_name: accounts.name,
            target_account_name: targetAccounts.name,
            category_name: categories.name,
            sub_category_name: subCategories.name,
            category_color: categories.color
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.account_id, accounts.id))
        .leftJoin(targetAccounts, eq(transactions.target_account_id, targetAccounts.id))
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .leftJoin(subCategories, eq(transactions.sub_category_id, subCategories.id))
        .where(
            and(
                eq(transactions.id, id),
                eq(transactions.user_id, userId),
                eq(transactions.is_deleted, 0)
            )
        )
        .limit(1)
    return item ? (item as Transaction) : null
}

/**
 * 获取流水类型中文标签
 *
 * @param type 流水类型
 * @returns 中文标签
 * @author xiangwei
 */
function typeLabel(type: TransactionType): string {
    return (
        {
            expense: '支出',
            income: '收入',
            transfer: '转账',
            adjustment: '调整'
        }[type] || type
    )
}

/**
 * 导出流水为 Excel
 *
 * @param userId 用户 ID
 * @param filter 筛选条件
 * @param filePath 导出文件路径
 * @returns 导出结果
 * @author xiangwei
 */
export async function exportTransactions(
    userId: string,
    filter: TransactionFilter,
    filePath: string
): Promise<ExportTransactionsResult> {
    const conditions: SQL[] = [eq(transactions.user_id, userId), eq(transactions.is_deleted, 0)]
    if (filter.start_date) conditions.push(sql`${transactions.date} >= ${filter.start_date}`)
    if (filter.end_date) conditions.push(sql`${transactions.date} <= ${filter.end_date}`)
    if (filter.type && filter.type !== 'all') {
        conditions.push(eq(transactions.type, filter.type))
    }
    if (filter.account_id) {
        conditions.push(
            sql`(${transactions.account_id} = ${filter.account_id} OR ${transactions.target_account_id} = ${filter.account_id})`
        )
    }
    if (filter.category_id) conditions.push(eq(transactions.category_id, filter.category_id))
    if (filter.keyword) conditions.push(like(transactions.note, `%${filter.keyword}%`))

    const targetAccounts = alias(accounts, 'target_accounts')
    const rows = await db
        .select({
            id: transactions.id,
            type: transactions.type,
            account_id: transactions.account_id,
            target_account_id: transactions.target_account_id,
            category_id: transactions.category_id,
            sub_category_id: transactions.sub_category_id,
            amount_cents: transactions.amount_cents,
            date: transactions.date,
            time: transactions.time,
            note: transactions.note,
            created_at: transactions.created_at,
            account_name: accounts.name,
            target_account_name: targetAccounts.name,
            category_name: categories.name,
            sub_category_name: subCategories.name
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.account_id, accounts.id))
        .leftJoin(targetAccounts, eq(transactions.target_account_id, targetAccounts.id))
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .leftJoin(subCategories, eq(transactions.sub_category_id, subCategories.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.id))

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('流水明细')
    worksheet.columns = [
        { header: '日期', key: 'date', width: 12 },
        { header: '时间', key: 'time', width: 10 },
        { header: '类型', key: 'type', width: 10 },
        { header: '分类', key: 'category', width: 14 },
        { header: '二级分类', key: 'sub_category', width: 14 },
        { header: '账户', key: 'account', width: 14 },
        { header: '目标账户', key: 'target_account', width: 14 },
        { header: '金额（元）', key: 'amount', width: 14 },
        { header: '备注', key: 'note', width: 30 },
        { header: '创建时间', key: 'created_at', width: 20 }
    ]

    for (const item of rows) {
        worksheet.addRow({
            date: item.date,
            time: item.time ?? '',
            type: typeLabel(item.type as TransactionType),
            category: item.category_name ?? '',
            sub_category: item.sub_category_name ?? '',
            account: item.account_name ?? '',
            target_account: item.target_account_name ?? '',
            amount: (item.amount_cents / 100).toFixed(2),
            note: item.note ?? '',
            created_at: item.created_at
        })
    }

    await workbook.xlsx.writeFile(filePath)
    return { file_path: filePath, count: rows.length }
}
