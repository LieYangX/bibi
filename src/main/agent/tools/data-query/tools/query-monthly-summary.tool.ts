/**
 * 月度收支汇总查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getMonthlyStatistics } from '../../../../services/statistics.service'
import { getCurrentUserId } from '../../../../services/session.service'
import type { MonthlyStatistics } from '@shared/types'

export const queryMonthlySummaryTool = tool({
    description: '获取指定月份的收支汇总，包含总收入、总支出、结余、分类占比、每日趋势',
    inputSchema: z.object({
        year: z.number().describe('年份，如 2026'),
        month: z.number().min(1).max(12).describe('月份，1-12')
    }),
    execute: async ({ year, month }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const data = await getMonthlyStatistics(userId, year, month)
        return formatMonthlyResult(data)
    }
})

function formatMonthlyResult(data: MonthlyStatistics): Record<string, unknown> {
    const income = data.total_income_cents / 100
    const expense = data.total_expense_cents / 100
    const balance = data.balance_cents / 100
    const totalAssets = data.total_balance_cents / 100

    const expenseCategories = data.expense_categories.map((c) => ({
        name: c.category_name,
        amount: (c.amount_cents / 100).toFixed(2),
        percentage: c.percentage
    }))

    const incomeCategories = data.income_categories.map((c) => ({
        name: c.category_name,
        amount: (c.amount_cents / 100).toFixed(2),
        percentage: c.percentage
    }))

    const dailyExpense = data.daily_expense.map((d) => ({
        date: d.date,
        amount: (d.amount_cents / 100).toFixed(2)
    }))

    // 构建 LLM 友好文本
    let formatted = `## ${data.year}年${data.month}月收支汇总\n\n`
    formatted += `**总支出**: ¥${expense.toFixed(2)}\n`
    formatted += `**总收入**: ¥${income.toFixed(2)}\n`
    formatted += `**结余**: ¥${balance.toFixed(2)}\n`
    formatted += `**总资产**: ¥${totalAssets.toFixed(2)}\n\n`

    if (expenseCategories.length > 0) {
        formatted += `### 支出分类\n`
        for (const c of expenseCategories) {
            formatted += `- ${c.name}: ¥${c.amount} (${c.percentage}%)\n`
        }
    }

    return {
        summary: { income, expense, balance, totalAssets },
        expenseCategories,
        incomeCategories,
        dailyExpense,
        formatted
    }
}
