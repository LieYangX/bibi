/**
 * 账户余额查询工具
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { db, accounts } from '../../../../database/drizzle'
import { getCurrentUserId } from '../../../../services/session.service'
import { eq } from 'drizzle-orm'

export const queryAccountBalanceTool = tool({
    description: '查询所有账户的余额信息',
    inputSchema: z.object({}),
    execute: async () => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const rows = await db
            .select({
                id: accounts.id,
                name: accounts.name,
                type: accounts.type,
                balance_cents: accounts.balance_cents,
                is_hidden: accounts.is_hidden
            })
            .from(accounts)
            .where(eq(accounts.user_id, userId))
            .orderBy(accounts.sort_order)

        const items = rows
            .filter((r) => !r.is_hidden)
            .map((r) => ({
                name: r.name,
                type: r.type,
                balance: (r.balance_cents / 100).toFixed(2)
            }))

        const totalBalance = items.reduce((sum, item) => sum + parseFloat(item.balance), 0)

        let formatted = '## 账户余额\n\n'
        for (const item of items) {
            formatted += `- ${item.name}（${item.type}）: ¥${item.balance}\n`
        }
        formatted += `\n**总余额**: ¥${totalBalance.toFixed(2)}`

        return { items, totalBalance: totalBalance.toFixed(2), formatted }
    }
})
