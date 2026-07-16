/**
 * 流水查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { listTransactions } from '../../../../services/transaction.service'
import { getCurrentUserId } from '../../../../services/session.service'
import type { TransactionListResult } from '@shared/types'

export const queryTransactionsTool = tool({
    description: '查询流水记录，支持多条件筛选（日期范围、类型、分类、关键词）',
    inputSchema: z.object({
        start_date: z.string().optional().describe('开始日期，格式 YYYY-MM-DD'),
        end_date: z.string().optional().describe('结束日期，格式 YYYY-MM-DD'),
        type: z.enum(['expense', 'income', 'transfer', 'all']).optional().describe('流水类型'),
        category_id: z.string().optional().describe('分类 ID'),
        keyword: z.string().optional().describe('备注关键词'),
        page: z.number().optional().describe('页码，从 1 开始'),
        page_size: z.number().optional().describe('每页条数，最大 50')
    }),
    execute: async (args) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const filter = {
            ...args,
            type: args.type as 'expense' | 'income' | 'transfer' | 'all' | undefined,
            sort_field: 'date' as const,
            sort_order: 'desc' as const
        }
        const data = await listTransactions(userId, filter)
        return formatTransactionResult(data)
    }
})

function formatTransactionResult(data: TransactionListResult): Record<string, unknown> {
    const items = data.items.map((t) => ({
        id: t.id,
        type: t.type,
        account: t.account_name,
        targetAccount: t.target_account_name,
        category: t.category_name,
        subCategory: t.sub_category_name,
        amount: (t.amount_cents / 100).toFixed(2),
        date: t.date,
        note: t.note
    }))

    let formatted = `共 ${data.total} 条记录，第 ${data.page}/${Math.ceil(data.total / data.page_size)} 页\n\n`
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

    return { total: data.total, items, formatted }
}
