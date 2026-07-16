/**
 * 趋势分析工具
 * 分析指定时间范围内的支出变化趋势
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { and, eq, sql, gte, lte } from 'drizzle-orm'
import { db, transactions } from '../../../../database/drizzle'
import { getCurrentUserId } from '../../../../services/session.service'

export const analyzeTrendTool = tool({
    description: '分析指定时间范围内的支出趋势，支持按日/周/月粒度',
    inputSchema: z.object({
        start_date: z.string().describe('开始日期 YYYY-MM-DD'),
        end_date: z.string().describe('结束日期 YYYY-MM-DD'),
        granularity: z.enum(['daily', 'weekly', 'monthly']).describe('趋势粒度')
    }),
    execute: async ({ start_date, end_date, granularity }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        let groupExpr: ReturnType<typeof sql>
        let orderExpr: ReturnType<typeof sql>
        let label: string

        switch (granularity) {
            case 'daily':
                groupExpr = sql`${transactions.date}`
                orderExpr = sql`${transactions.date} ASC`
                label = '日'
                break
            case 'weekly':
                groupExpr = sql`strftime('%Y-%W', ${transactions.date})`
                orderExpr = sql`1 ASC`
                label = '周'
                break
            case 'monthly':
                groupExpr = sql`strftime('%Y-%m', ${transactions.date})`
                orderExpr = sql`1 ASC`
                label = '月'
                break
        }

        const rows = await db
            .select({
                period: sql<string>`${groupExpr}`,
                amount_cents: sql<number>`SUM(${transactions.amount_cents})`,
                count: sql<number>`COUNT(*)`
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.user_id, userId),
                    eq(transactions.type, 'expense'),
                    eq(transactions.is_deleted, 0),
                    gte(transactions.date, start_date),
                    lte(transactions.date, end_date)
                )
            )
            .groupBy(groupExpr)
            .orderBy(orderExpr)

        const items = rows.map((r) => ({
            period: r.period,
            amount: (r.amount_cents / 100).toFixed(2),
            count: r.count
        }))

        const total = rows.reduce((s, r) => s + r.amount_cents, 0)
        const avg = rows.length > 0 ? total / rows.length : 0
        const maxItem = rows.reduce(
            (max, r) => (r.amount_cents > (max?.amount_cents ?? 0) ? r : max),
            rows[0]
        )

        let formatted = `## 支出趋势分析\n\n`
        formatted += `时间范围: ${start_date} ~ ${end_date}\n`
        formatted += `粒度: 每${label}\n`
        formatted += `总支出: ¥${(total / 100).toFixed(2)}\n`
        formatted += `平均每${label}: ¥${(avg / 100).toFixed(2)}\n`
        if (maxItem) {
            formatted += `最高${label}: ${maxItem.period} ¥${(maxItem.amount_cents / 100).toFixed(2)}\n\n`
        }
        formatted += `### 趋势明细\n`
        for (const item of items) {
            formatted += `- ${item.period}: ¥${item.amount}（${item.count}笔）\n`
        }

        return {
            granularity,
            total: (total / 100).toFixed(2),
            averagePerPeriod: (avg / 100).toFixed(2),
            items,
            formatted
        }
    }
})
