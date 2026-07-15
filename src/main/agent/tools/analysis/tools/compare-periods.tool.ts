/**
 * 时间段对比工具
 * 对比两个时间段的收支数据
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { and, eq, sql, gte, lte } from 'drizzle-orm'
import { db, transactions } from '../../../../database/drizzle'
import { getCurrentUserId } from '../../../../services/session.service'

export const comparePeriodsTool = tool({
    description: '对比两个时间段的收支数据，返回各分类的变化情况',
    inputSchema: z.object({
        period1Start: z.string().describe('第一段开始日期 YYYY-MM-DD'),
        period1End: z.string().describe('第一段结束日期 YYYY-MM-DD'),
        period2Start: z.string().describe('第二段开始日期 YYYY-MM-DD'),
        period2End: z.string().describe('第二段结束日期 YYYY-MM-DD')
    }),
    execute: async ({ period1Start, period1End, period2Start, period2End }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const [p1Data, p2Data] = await Promise.all([
            getPeriodData(userId, period1Start, period1End),
            getPeriodData(userId, period2Start, period2End)
        ])

        const p1Expense = p1Data.expense
        const p2Expense = p2Data.expense
        const p1Income = p1Data.income
        const p2Income = p2Data.income

        const expenseDiff = p2Expense - p1Expense
        const expensePct = p1Expense !== 0 ? (expenseDiff / p1Expense) * 100 : 0
        const incomeDiff = p2Income - p1Income
        const incomePct = p1Income !== 0 ? (incomeDiff / p1Income) * 100 : 0

        let formatted = `## 时间段对比\n\n`
        formatted += `### ${period1Start}~${period1End} → ${period2Start}~${period2End}\n\n`
        formatted += `**支出**: ¥${(p1Expense / 100).toFixed(2)} → ¥${(p2Expense / 100).toFixed(2)}`
        formatted += ` (${expenseDiff >= 0 ? '+' : ''}${(expenseDiff / 100).toFixed(2)}, ${expensePct >= 0 ? '+' : ''}${expensePct.toFixed(1)}%)\n`
        formatted += `**收入**: ¥${(p1Income / 100).toFixed(2)} → ¥${(p2Income / 100).toFixed(2)}`
        formatted += ` (${incomeDiff >= 0 ? '+' : ''}${(incomeDiff / 100).toFixed(2)}, ${incomePct >= 0 ? '+' : ''}${incomePct.toFixed(1)}%)\n`

        return {
            period1: {
                start: period1Start,
                end: period1End,
                expense: p1Expense / 100,
                income: p1Income / 100
            },
            period2: {
                start: period2Start,
                end: period2End,
                expense: p2Expense / 100,
                income: p2Income / 100
            },
            changes: {
                expenseDiff: expenseDiff / 100,
                expensePct: Math.round(expensePct * 10) / 10,
                incomeDiff: incomeDiff / 100,
                incomePct: Math.round(incomePct * 10) / 10
            },
            formatted
        }
    }
})

async function getPeriodData(
    userId: string,
    start: string,
    end: string
): Promise<{ expense: number; income: number }> {
    const [expenseRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'expense'),
                eq(transactions.is_deleted, 0),
                gte(transactions.date, start),
                lte(transactions.date, end)
            )
        )

    const [incomeRow] = await db
        .select({ s: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(transactions)
        .where(
            and(
                eq(transactions.user_id, userId),
                eq(transactions.type, 'income'),
                eq(transactions.is_deleted, 0),
                gte(transactions.date, start),
                lte(transactions.date, end)
            )
        )

    return { expense: expenseRow?.s ?? 0, income: incomeRow?.s ?? 0 }
}
