/**
 * 预算执行进度查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getMonthBudgets } from '../../../../services/budget.service'
import { getCurrentUserId } from '../../../../services/session.service'
import type { BudgetWithProgress } from '@shared/types'

export const queryBudgetProgressTool = tool({
    description: '查询指定月份的预算执行进度',
    inputSchema: z.object({
        year: z.number().describe('年份，如 2026'),
        month: z.number().min(1).max(12).describe('月份，1-12')
    }),
    execute: async ({ year, month }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const budgets = await getMonthBudgets(userId, year, month)
        return formatBudgetResult(budgets)
    }
})

function formatBudgetResult(budgets: BudgetWithProgress[]): Record<string, unknown> {
    const items = budgets.map((b) => ({
        category: b.category_name || '总预算',
        budget: (b.amount_cents / 100).toFixed(2),
        used: (b.used_cents / 100).toFixed(2),
        remaining: ((b.amount_cents - b.used_cents) / 100).toFixed(2),
        progress: b.progress_pct
    }))

    let formatted = '## 预算执行进度\n\n'
    for (const item of items) {
        const bar =
            '█'.repeat(Math.min(Math.floor(item.progress / 10), 10)) +
            '░'.repeat(Math.max(10 - Math.min(Math.floor(item.progress / 10), 10), 0))
        formatted += `${item.category}: ¥${item.used} / ¥${item.budget}\n`
        formatted += `${bar} ${item.progress}%\n`
        formatted += `剩余: ¥${item.remaining}\n\n`
    }

    return { items, formatted }
}
