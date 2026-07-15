/**
 * 预算管理服务
 * @author xiangwei
 */

import { eq, and, sql } from 'drizzle-orm'
import type { Budget, BudgetWithProgress, SetBudgetDTO } from '@shared/types'
import { db, budgets, transactions, categories, getNativeDatabase } from '../database/drizzle'
import { randomUUID } from 'crypto'

/**
 * 设置预算（同一用户同一月同一分类只能有一条）
 */
export async function setBudget(data: SetBudgetDTO, userId: string): Promise<Budget> {
    if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
        throw new Error('预算年份无效')
    }
    if (!Number.isInteger(data.month) || data.month < 0 || data.month > 12) {
        throw new Error('预算月份无效')
    }
    if (!Number.isInteger(data.amount_cents) || data.amount_cents <= 0) {
        throw new Error('预算金额必须是大于 0 的整数分值')
    }

    const now = new Date().toISOString()
    const categoryId = data.category_id || null

    if (categoryId) {
        const [category] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.user_id, userId),
                    eq(categories.type, 'expense')
                )
            )
            .limit(1)
        if (!category) {
            throw new Error('预算分类不存在或不属于当前用户')
        }
    }

    const id = randomUUID()
    const database = getNativeDatabase()
    const replaceBudget = database.transaction(() => {
        if (categoryId) {
            database
                .prepare(
                    `DELETE FROM budgets
                     WHERE user_id = ? AND year = ? AND month = ? AND category_id = ?`
                )
                .run(userId, data.year, data.month, categoryId)
        } else {
            database
                .prepare(
                    `DELETE FROM budgets
                     WHERE user_id = ? AND year = ? AND month = ? AND category_id IS NULL`
                )
                .run(userId, data.year, data.month)
        }
        database
            .prepare(
                `INSERT INTO budgets (
                    id, user_id, category_id, year, month, amount_cents, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(id, userId, categoryId, data.year, data.month, data.amount_cents, now, now)
        return database.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget
    })
    return replaceBudget()
}

/**
 * 获取某月预算列表（含已用金额）
 */
export async function getMonthBudgets(
    userId: string,
    year: number,
    month: number
): Promise<BudgetWithProgress[]> {
    const list = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.user_id, userId), eq(budgets.year, year), eq(budgets.month, month)))

    const result: BudgetWithProgress[] = []
    for (const b of list) {
        // 计算该分类当月已用金额
        let usedCents = 0

        if (b.category_id) {
            const [row] = await db
                .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.user_id, userId),
                        eq(transactions.category_id, b.category_id),
                        eq(transactions.type, 'expense'),
                        sql`strftime('%Y', ${transactions.date}) = ${String(year)}`,
                        sql`strftime('%m', ${transactions.date}) = ${String(month).padStart(2, '0')}`,
                        eq(transactions.is_deleted, 0)
                    )
                )
            usedCents = row?.s ?? 0
        } else {
            const [row] = await db
                .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.user_id, userId),
                        eq(transactions.type, 'expense'),
                        sql`strftime('%Y', ${transactions.date}) = ${String(year)}`,
                        sql`strftime('%m', ${transactions.date}) = ${String(month).padStart(2, '0')}`,
                        eq(transactions.is_deleted, 0)
                    )
                )
            usedCents = row?.s ?? 0
        }

        // 获取分类名称
        let categoryName: string | undefined
        if (b.category_id) {
            const [cat] = await db
                .select({ name: categories.name })
                .from(categories)
                .where(eq(categories.id, b.category_id))
                .limit(1)
            categoryName = cat?.name
        }

        const progressPct = b.amount_cents > 0 ? Math.round((usedCents / b.amount_cents) * 100) : 0

        result.push({
            ...b,
            used_cents: usedCents,
            progress_pct: progressPct,
            category_name: categoryName
        })
    }

    return result
}

/**
 * 获取年度预算列表（month=0）
 */
export async function getYearBudgets(userId: string, year: number): Promise<BudgetWithProgress[]> {
    const list = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.user_id, userId), eq(budgets.year, year), eq(budgets.month, 0)))

    const result: BudgetWithProgress[] = []
    for (const b of list) {
        // 计算该分类全年已用金额
        let usedCents = 0

        if (b.category_id) {
            const [row] = await db
                .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.user_id, userId),
                        eq(transactions.category_id, b.category_id),
                        eq(transactions.type, 'expense'),
                        sql`strftime('%Y', ${transactions.date}) = ${String(year)}`,
                        eq(transactions.is_deleted, 0)
                    )
                )
            usedCents = row?.s ?? 0
        } else {
            const [row] = await db
                .select({ s: sql<number>`COALESCE(SUM(${transactions.amount_cents}), 0)` })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.user_id, userId),
                        eq(transactions.type, 'expense'),
                        sql`strftime('%Y', ${transactions.date}) = ${String(year)}`,
                        eq(transactions.is_deleted, 0)
                    )
                )
            usedCents = row?.s ?? 0
        }

        let categoryName: string | undefined
        if (b.category_id) {
            const [cat] = await db
                .select({ name: categories.name })
                .from(categories)
                .where(eq(categories.id, b.category_id))
                .limit(1)
            categoryName = cat?.name
        }

        const progressPct = b.amount_cents > 0 ? Math.round((usedCents / b.amount_cents) * 100) : 0

        result.push({
            ...b,
            used_cents: usedCents,
            progress_pct: progressPct,
            category_name: categoryName
        })
    }

    return result
}

/**
 * 删除预算
 */
export async function deleteBudget(id: string, userId: string): Promise<void> {
    const [budget] = await db
        .select({ id: budgets.id })
        .from(budgets)
        .where(and(eq(budgets.id, id), eq(budgets.user_id, userId)))
        .limit(1)
    if (!budget) {
        throw new Error('预算不存在')
    }
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.user_id, userId)))
}
