/**
 * 记账工具 - 创建流水
 * 接收自然语言描述的记账信息，解析并写入数据库
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { listAccounts } from '../../../../services/account.service'
import { listCategories } from '../../../../services/category.service'
import { createTransaction } from '../../../../services/transaction.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const createTransactionTool = tool({
    description: '记录一笔流水（支出/收入/转账/调账），支持按账户名称和分类名称自动匹配',
    inputSchema: z.object({
        type: z
            .enum(['expense', 'income', 'transfer', 'adjustment'])
            .describe('流水类型：expense=支出, income=收入, transfer=转账, adjustment=调账'),
        account_name: z.string().describe('账户名称，如"微信"、"支付宝"、"现金"'),
        target_account_name: z.string().optional().describe('转入账户名称（仅转账时需要）'),
        category_name: z
            .string()
            .optional()
            .describe('一级分类名称，如"餐饮"、"交通"（支出/收入时需要）'),
        sub_category_name: z
            .string()
            .optional()
            .describe('二级分类名称，如"午餐"、"打车"（如有二级分类时填写）'),
        amount_cents: z.number().int().positive().describe('金额（单位：分），如 3500 表示 35 元'),
        date: z.string().describe('日期，格式 YYYY-MM-DD'),
        note: z.string().optional().describe('备注说明')
    }),
    execute: async (input) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        // 解析账户名称 → ID
        const accounts = await listAccounts(userId)
        const account = accounts.find((a) => a.name === input.account_name)
        if (!account) {
            const available = accounts.map((a) => `"${a.name}"`).join('、')
            return {
                error: `未找到账户"${input.account_name}"，可用账户：${available}`
            }
        }

        // 解析转入账户（转账时）
        let targetAccountId: string | undefined
        if (input.type === 'transfer') {
            if (!input.target_account_name) {
                return { error: '转账类型需要填写目标账户名称（target_account_name）' }
            }
            const targetAccount = accounts.find((a) => a.name === input.target_account_name)
            if (!targetAccount) {
                const available = accounts.map((a) => `"${a.name}"`).join('、')
                return {
                    error: `未找到转入账户"${input.target_account_name}"，可用账户：${available}`
                }
            }
            targetAccountId = targetAccount.id
        }

        // 解析分类名称 → ID
        let categoryId: string | undefined
        let subCategoryId: string | undefined
        if (input.type === 'expense' || input.type === 'income') {
            const categories = await listCategories(userId, input.type)
            const matchedCategory = categories.find((c) => c.name === input.category_name)
            if (!matchedCategory && input.category_name) {
                const available = categories.map((c) => `"${c.name}"`).join('、')
                return {
                    error: `未找到${input.type === 'expense' ? '支出' : '收入'}分类"${input.category_name}"，可用分类：${available}`
                }
            }
            if (matchedCategory) {
                categoryId = matchedCategory.id

                // 解析二级分类
                if (input.sub_category_name) {
                    const matchedSub = matchedCategory.sub_categories.find(
                        (s) => s.name === input.sub_category_name
                    )
                    if (!matchedSub) {
                        const available = matchedCategory.sub_categories
                            .map((s) => `"${s.name}"`)
                            .join('、')
                        return {
                            error: `分类"${input.category_name}"下未找到二级分类"${input.sub_category_name}"，可用二级分类：${available}`
                        }
                    }
                    subCategoryId = matchedSub.id
                }
            }
        }

        try {
            const transaction = await createTransaction(
                {
                    type: input.type,
                    account_id: account.id,
                    target_account_id: targetAccountId,
                    category_id: categoryId ?? null,
                    sub_category_id: subCategoryId ?? null,
                    amount_cents: input.amount_cents,
                    date: input.date,
                    note: input.note ?? null
                },
                userId
            )

            const amountYuan = (transaction.amount_cents / 100).toFixed(2)
            const typeMap: Record<string, string> = {
                expense: '支出',
                income: '收入',
                transfer: '转账',
                adjustment: '调账'
            }

            return {
                success: true,
                id: transaction.id,
                type: typeMap[transaction.type] || transaction.type,
                account: input.account_name,
                amount: `¥${amountYuan}`,
                date: transaction.date,
                note: transaction.note,
                formatted: `✅ 已记录${typeMap[transaction.type] || transaction.type}：${input.account_name} ¥${amountYuan}（${transaction.date}）${transaction.note ? ` - ${transaction.note}` : ''}`
            }
        } catch (error) {
            return {
                error: `记账失败：${error instanceof Error ? error.message : '未知错误'}`
            }
        }
    }
})
