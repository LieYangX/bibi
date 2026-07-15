/**
 * 年度收支汇总查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getAnnualStatistics } from '../../../../services/statistics.service'
import { getCurrentUserId } from '../../../../services/session.service'
import type { AnnualStatistics } from '@shared/types'

export const queryYearlySummaryTool = tool({
    description: '获取指定年份的收支汇总，包含总收入、总支出、月度趋势、分类占比',
    inputSchema: z.object({
        year: z.number().describe('年份，如 2026')
    }),
    execute: async ({ year }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const data = await getAnnualStatistics(userId, year)
        return formatAnnualResult(data)
    }
})

function formatAnnualResult(data: AnnualStatistics): Record<string, unknown> {
    const income = data.total_income_cents / 100
    const expense = data.total_expense_cents / 100
    const balance = data.balance_cents / 100
    const totalAssets = data.total_balance_cents / 100

    const monthlyExpense = data.monthly_expense.map((m) => ({
        month: m.month,
        amount: (m.amount_cents / 100).toFixed(2)
    }))

    const expenseCategories = data.expense_categories.map((c) => ({
        name: c.category_name,
        amount: (c.amount_cents / 100).toFixed(2),
        percentage: c.percentage
    }))

    let formatted = `## ${data.year}年收支汇总\n\n`
    formatted += `**年总收入**: ¥${income.toFixed(2)}\n`
    formatted += `**年总支出**: ¥${expense.toFixed(2)}\n`
    formatted += `**年结余**: ¥${balance.toFixed(2)}\n`
    formatted += `**总资产**: ¥${totalAssets.toFixed(2)}\n\n`

    if (monthlyExpense.length > 0) {
        formatted += `### 月度支出趋势\n`
        for (const m of monthlyExpense) {
            formatted += `- ${m.month}月: ¥${m.amount}\n`
        }
    }

    if (expenseCategories.length > 0) {
        formatted += `\n### 年度支出分类 Top\n`
        for (const c of expenseCategories.slice(0, 5)) {
            formatted += `- ${c.name}: ¥${c.amount} (${c.percentage}%)\n`
        }
    }

    return {
        summary: { income, expense, balance, totalAssets },
        monthlyExpense,
        expenseCategories,
        formatted
    }
}
