/**
 * 删除账单工具 - 软删除流水
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { deleteTransaction } from '../../../../services/transaction.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const deleteTransactionTool = tool({
    description:
        '删除（软删除）一笔流水记录。注意：调用前必须先向用户展示流水详情并获得用户明确确认',
    inputSchema: z.object({
        transaction_id: z.string().describe('要删除的流水 ID')
    }),
    execute: async (input) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        try {
            await deleteTransaction(input.transaction_id, userId)
            return {
                success: true,
                formatted: '✅ 已成功删除该笔流水'
            }
        } catch (error) {
            return {
                error: `删除失败：${error instanceof Error ? error.message : '未知错误'}`
            }
        }
    }
})
