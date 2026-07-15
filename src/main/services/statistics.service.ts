/**
 * 统计概览服务
 * 月度统计、预算进度、分类占比——纯 SQL 聚合
 * @author xiangwei
 */

import { eq, and, sql } from 'drizzle-orm'
import type { MonthlyStatistics, AnnualStatistics } from '@shared/types'
import { db, transactions, accounts, categories } from '../database/drizzle'
import { getMonthBudgets, getYearBudgets } from './budget.service'

/**
 * 获取年度统计
 */
export async function getAnnualStatistics(userId: string, year: number): Promise<AnnualStatistics> {
    const yearStr = String(year) + '-%'

    // 总收入
    const [incomeRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'income'),
                eq(transactions.is_deleted, 0),
                sql`${transactions.date} LIKE ${yearStr}`
            )
        )

    // 总支出
    const [expenseRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`${transactions.date} LIKE ${yearStr}`
            )
        )

    // 账户总余额
    const [balanceRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(balance_cents), 0)` })
        .from(accounts)
        .where(eq(accounts.user_id, userId))

    const totalIncomeCents = incomeRow?.s ?? 0
    const totalExpenseCents = expenseRow?.s ?? 0

    // 支出分类占比
    const expenseCatRows = await db
        .select({
            category_id: transactions.category_id,
            category_name: sql<string>`COALESCE(${categories.name}, '其他')`,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`${transactions.date} LIKE ${yearStr}`
            )
        )
        .groupBy(transactions.category_id)
        .orderBy(sql`amount_cents DESC`)

    // 收入分类占比
    const incomeCatRows = await db
        .select({
            category_id: transactions.category_id,
            category_name: sql<string>`COALESCE(${categories.name}, '其他')`,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'income'),
                eq(transactions.is_deleted, 0),
                sql`${transactions.date} LIKE ${yearStr}`
            )
        )
        .groupBy(transactions.category_id)
        .orderBy(sql`amount_cents DESC`)

    // 月度支出趋势
    const monthlyRows = await db
        .select({
            month: sql<number>`CAST(strftime('%m', ${transactions.date}) AS INTEGER)`,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`${transactions.date} LIKE ${yearStr}`
            )
        )
        .groupBy(sql`strftime('%m', ${transactions.date})`)
        .orderBy(sql`1 ASC`)

    // 年度预算
    const budgets = await getYearBudgets(userId, year)

    return {
        year,
        total_income_cents: totalIncomeCents,
        total_expense_cents: totalExpenseCents,
        balance_cents: totalIncomeCents - totalExpenseCents,
        total_balance_cents: balanceRow?.s ?? 0,
        expense_categories: expenseCatRows.map((c) => ({
            ...c,
            percentage:
                totalExpenseCents > 0 ? Math.round((c.amount_cents / totalExpenseCents) * 100) : 0
        })),
        income_categories: incomeCatRows.map((c) => ({
            ...c,
            percentage:
                totalIncomeCents > 0 ? Math.round((c.amount_cents / totalIncomeCents) * 100) : 0
        })),
        monthly_expense: monthlyRows.map((r) => ({
            month: r.month,
            amount_cents: r.amount_cents
        })),
        budgets
    }
}
export async function getMonthlyStatistics(
    userId: string,
    year: number,
    month: number
): Promise<MonthlyStatistics> {
    const monthStr = `${String(year)}-${String(month).padStart(2, '0')}`

    // 总收入
    const [incomeRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'income'),
                eq(transactions.is_deleted, 0),
                sql`strftime('%Y-%m', ${transactions.date}) = ${monthStr}`
            )
        )

    // 总支出
    const [expenseRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`strftime('%Y-%m', ${transactions.date}) = ${monthStr}`
            )
        )

    // 账户总余额
    const [balanceRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(balance_cents), 0)` })
        .from(accounts)
        .where(eq(accounts.user_id, userId))

    const totalIncomeCents = incomeRow?.s ?? 0
    const totalExpenseCents = expenseRow?.s ?? 0

    // 支出分类占比
    const expenseCatRows = await db
        .select({
            category_id: transactions.category_id,
            category_name: sql<string>`COALESCE(${categories.name}, '其他')`,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`strftime('%Y-%m', ${transactions.date}) = ${monthStr}`
            )
        )
        .groupBy(transactions.category_id)
        .orderBy(sql`amount_cents DESC`)

    // 收入分类占比
    const incomeCatRows = await db
        .select({
            category_id: transactions.category_id,
            category_name: sql<string>`COALESCE(${categories.name}, '其他')`,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'income'),
                eq(transactions.is_deleted, 0),
                sql`strftime('%Y-%m', ${transactions.date}) = ${monthStr}`
            )
        )
        .groupBy(transactions.category_id)
        .orderBy(sql`amount_cents DESC`)

    // 每日支出
    const dailyRows = await db
        .select({
            date: transactions.date,
            amount_cents: sql<number>`SUM(${transactions.amount_cents})`
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                sql`strftime('%Y-%m', ${transactions.date}) = ${monthStr}`
            )
        )
        .groupBy(transactions.date)
        .orderBy(sql`date ASC`)

    // 计算百分比
    const expenseCategoriesWithPct = expenseCatRows.map((c) => ({
        category_id: c.category_id,
        category_name: c.category_name,
        amount_cents: c.amount_cents,
        percentage:
            totalExpenseCents > 0 ? Math.round((c.amount_cents / totalExpenseCents) * 100) : 0
    }))

    const incomeCategoriesWithPct = incomeCatRows.map((c) => ({
        category_id: c.category_id,
        category_name: c.category_name,
        amount_cents: c.amount_cents,
        percentage: totalIncomeCents > 0 ? Math.round((c.amount_cents / totalIncomeCents) * 100) : 0
    }))

    // 预算进度
    const budgets = await getMonthBudgets(userId, year, month)

    return {
        year,
        month,
        total_income_cents: totalIncomeCents,
        total_expense_cents: totalExpenseCents,
        balance_cents: totalIncomeCents - totalExpenseCents,
        total_balance_cents: balanceRow?.s ?? 0,
        expense_categories: expenseCategoriesWithPct,
        income_categories: incomeCategoriesWithPct,
        daily_expense: dailyRows,
        budgets
    }
}
