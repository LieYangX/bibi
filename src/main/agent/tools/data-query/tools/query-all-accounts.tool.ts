/**
 * 账户列表查询工具 - 返回所有账户的名称和类型
 * 专为记账流程设计，帮助 AI 在记账前确认可用账户
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { listAccounts } from '../../../../services/account.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const queryAllAccountsTool = tool({
    description: '查询所有账户的名称和类型列表，用于记账前确认可用账户',
    inputSchema: z.object({}),
    execute: async () => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')
        const rows = await listAccounts(userId)

        const items = rows.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            balance_cents: a.balance_cents
        }))

        let formatted = '## 可用账户\n\n'
        for (const item of items) {
            const typeMap: Record<string, string> = {
                cash: '现金',
                debit: '储蓄卡',
                credit: '信用卡',
                digital: '电子钱包',
                investment: '投资'
            }
            const balanceYuan = (item.balance_cents / 100).toFixed(2)
            formatted += `- ${item.name}（${typeMap[item.type] || item.type}）余额 ¥${balanceYuan}\n`
        }

        return { items, formatted }
    }
})
