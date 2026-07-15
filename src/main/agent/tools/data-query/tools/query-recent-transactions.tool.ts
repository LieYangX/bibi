/**
 * 最近流水查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { listTransactions } from '../../../../services/transaction.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const queryRecentTransactionsTool = tool({
    description: '查询最近 N 笔流水，可按类型过滤、按金额排序',
    inputSchema: z.object({
        limit: z.number().optional().describe('返回笔数，默认 5，最大 20'),
        type: z.enum(['expense', 'income', 'transfer', 'all']).optional().describe('筛选类型'),
        sort_by_amount: z.boolean().optional().describe('是否按金额排序（大额优先）')
    }),
    execute: async (args) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const limit = Math.min(args.limit ?? 5, 20)
        const data = await listTransactions(userId, {
            type: args.type as 'expense' | 'income' | 'transfer' | 'all' | undefined,
            page: 1,
            page_size: limit,
            sort_field: args.sort_by_amount ? 'amount_cents' : 'date',
            sort_order: 'desc'
        })

        const items = data.items.map((t) => ({
            date: t.date,
            type: t.type,
            amount: (t.amount_cents / 100).toFixed(2),
            category: t.category_name,
            note: t.note,
            account: t.account_name
        }))

        let formatted = `最近 ${items.length} 笔流水：\n\n`
        for (const item of items) {
            const typeLabel =
                { expense: '支出', income: '收入', transfer: '转账', adjustment: '调账' }[
                    item.type as string
                ] || item.type
            formatted += `[${item.date}] ${typeLabel} ¥${item.amount}`
            if (item.category) formatted += ` | ${item.category}`
            if (item.note) formatted += ` | ${item.note}`
            formatted += '\n'
        }

        return { items, formatted }
    }
})
