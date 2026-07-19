/**
 * 交易数据查询服务
 * 为 data-query 和 analysis 工具提供统一的交易查询能力，避免查询逻辑重复。
 *
 * @author xiangwei
 */

import { and, eq, sql, gte, lte, type SQL } from 'drizzle-orm'
import { db, transactions, categories } from '../../database/drizzle'

/** 交易类型过滤条件 */
export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment'

/** 日期范围查询参数 */
export interface DateRangeQuery {
    userId: string
    startDate: string
    endDate: string
    type?: TransactionType
}

/** 聚合粒度 */
export type TrendGranularity = 'daily' | 'weekly' | 'monthly'

/**
 * 构建基础查询过滤条件
 * 统一应用用户隔离、软删除过滤和日期范围过滤。
 *
 * @param params 查询参数
 * @returns Drizzle 查询条件
 * @author xiangwei
 */
export function buildTransactionFilter(
    params: DateRangeQuery & { type?: TransactionType }
): SQL<unknown> {
    const conditions: SQL<unknown>[] = [
        eq(transactions.user_id, params.userId),
        eq(transactions.is_deleted, 0),
        gte(transactions.date, params.startDate),
        lte(transactions.date, params.endDate)
    ]
    if (params.type) {
        conditions.push(eq(transactions.type, params.type))
    }
    return and(...conditions) as SQL<unknown>
}

/**
 * 查询指定日期范围内某类交易的总金额
 *
 * @param params 查询参数
 * @returns 金额（单位：分）
 * @author xiangwei
 */
export async function queryTransactionSum(
    params: DateRangeQuery & { type?: TransactionType }
): Promise<number> {
    const [row] = await db
        .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
        .from(transactions)
        .where(buildTransactionFilter(params))
    return row?.s ?? 0
}

/**
 * 查询指定日期范围内支出趋势
 *
 * @param params 查询参数
 * @param granularity 聚合粒度
 * @returns 按周期聚合的支出数据
 * @author xiangwei
 */
export async function queryExpenseTrend(
    params: DateRangeQuery,
    granularity: TrendGranularity
): Promise<Array<{ period: string; amount_cents: number; count: number }>> {
    let groupExpr: SQL<string>
    let orderExpr: SQL<unknown>

    switch (granularity) {
        case 'daily':
            groupExpr = sql<string>`${transactions.date}`
            orderExpr = sql`${transactions.date} ASC`
            break
        case 'weekly':
            groupExpr = sql<string>`strftime('%Y-%W', ${transactions.date})`
            orderExpr = sql`1 ASC`
            break
        case 'monthly':
            groupExpr = sql<string>`strftime('%Y-%m', ${transactions.date})`
            orderExpr = sql`1 ASC`
            break
    }

    const rows = await db
        .select({
            period: groupExpr,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`,
            count: sql<number>`COUNT(*)`
        })
        .from(transactions)
        .where(buildTransactionFilter({ ...params, type: 'expense' }))
        .groupBy(groupExpr)
        .orderBy(orderExpr)

    return rows
}

/**
 * 查询指定日期范围内支出统计信息
 *
 * @param params 查询参数
 * @returns 平均、最大、数量统计
 * @author xiangwei
 */
export async function queryExpenseStats(
    params: DateRangeQuery
): Promise<{ avg: number; max: number; count: number }> {
    const [row] = await db
        .select({
            avg: sql<number>`AVG(${transactions.amount_cents})`,
            max: sql<number>`MAX(${transactions.amount_cents})`,
            count: sql<number>`COUNT(*)`
        })
        .from(transactions)
        .where(buildTransactionFilter({ ...params, type: 'expense' }))

    return {
        avg: row?.avg ?? 0,
        max: row?.max ?? 0,
        count: row?.count ?? 0
    }
}

/**
 * 查询超过指定阈值的异常支出
 *
 * @param params 查询参数
 * @param thresholdAmount 阈值金额（单位：分）
 * @returns 异常交易列表
 * @author xiangwei
 */
export async function queryAnomalyExpenses(
    params: DateRangeQuery,
    thresholdAmount: number
): Promise<
    Array<{
        id: string
        date: string
        amount_cents: number
        note: string | null
        category_name: string | null
    }>
> {
    return db
        .select({
            id: transactions.id,
            date: transactions.date,
            amount_cents: transactions.amount_cents,
            note: transactions.note,
            category_name: categories.name
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
            and(
                buildTransactionFilter({ ...params, type: 'expense' }),
                sql`${transactions.amount_cents} > ${thresholdAmount}`
            )
        )
        .orderBy(sql`${transactions.amount_cents} DESC`)
}

/**
 * 查询指定日期范围内的支出和收入汇总
 *
 * @param params 查询参数
 * @returns 支出和收入总额（单位：分）
 * @author xiangwei
 */
export async function queryPeriodSummary(
    params: DateRangeQuery
): Promise<{ expense: number; income: number }> {
    const [expenseRow, incomeRow] = await Promise.all([
        db
            .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
            .from(transactions)
            .where(buildTransactionFilter({ ...params, type: 'expense' }))
            .then((rows) => rows[0]),
        db
            .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
            .from(transactions)
            .where(buildTransactionFilter({ ...params, type: 'income' }))
            .then((rows) => rows[0])
    ])

    return {
        expense: expenseRow?.s ?? 0,
        income: incomeRow?.s ?? 0
    }
}
