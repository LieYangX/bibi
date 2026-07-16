/**
 * 分类汇总查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { and, eq, sql, gte, lte } from 'drizzle-orm'
import { db, transactions, categories } from '../../../../database/drizzle'
import { getCurrentUserId } from '../../../../services/session.service'

export const queryCategorySummaryTool = tool({
    description: '查询指定时间段内各分类的收支汇总和占比',
    inputSchema: z.object({
        start_date: z.string().describe('开始日期，格式 YYYY-MM-DD'),
        end_date: z.string().describe('结束日期，格式 YYYY-MM-DD'),
        type: z.enum(['expense', 'income']).describe('收支类型')
    }),
    execute: async ({ start_date, end_date, type }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const rows = await db
            .select({
                category_id: transactions.category_id,
                category_name: sql<string>`COALESCE(${categories.name}, '未分类')`,
                amount_cents: sql<number>`SUM(${transactions.amount_cents})`,
                count: sql<number>`COUNT(*)`
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.category_id, categories.id))
            .where(
                and(
                    eq(transactions.user_id, userId),
                    eq(transactions.type, type),
                    eq(transactions.is_deleted, 0),
                    gte(transactions.date, start_date),
                    lte(transactions.date, end_date)
                )
            )
            .groupBy(transactions.category_id)
            .orderBy(sql`amount_cents DESC`)

        const total = rows.reduce((sum, r) => sum + r.amount_cents, 0)
        const items = rows.map((r) => ({
            category: r.category_name,
            amount: (r.amount_cents / 100).toFixed(2),
            percentage: total > 0 ? Math.round((r.amount_cents / total) * 100) : 0,
            count: r.count
        }))

        let formatted = `## ${start_date} 至 ${end_date} ${type === 'expense' ? '支出' : '收入'}分类\n\n`
        formatted += `**合计**: ¥${(total / 100).toFixed(2)}\n\n`
        for (const item of items) {
            formatted += `- ${item.category}: ¥${item.amount} (${item.percentage}%, ${item.count}笔)\n`
        }

        return { total: (total / 100).toFixed(2), items, formatted }
    }
})
