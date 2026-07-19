/**
 * 时间段对比工具
 * 对比两个时间段的收支数据
 *
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import { queryPeriodSummary } from '../../../services/transaction-analytics.service'

export const comparePeriodsTool = tool({
    description:
        '对比两个时间段的收支数据，返回支出和收入的变化情况。适合“这个月和上个月比怎么样”类请求。',
    inputSchema: z.object({
        period1Start: z.string().describe('第一段开始日期 YYYY-MM-DD'),
        period1End: z.string().describe('第一段结束日期 YYYY-MM-DD'),
        period2Start: z.string().describe('第二段开始日期 YYYY-MM-DD'),
        period2End: z.string().describe('第二段结束日期 YYYY-MM-DD')
    }),
    execute: async ({ period1Start, period1End, period2Start, period2End }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        const [p1Data, p2Data] = await Promise.all([
            queryPeriodSummary({ userId, startDate: period1Start, endDate: period1End }),
            queryPeriodSummary({ userId, startDate: period2Start, endDate: period2End })
        ])

        const expenseDiff = p2Data.expense - p1Data.expense
        const expensePct = p1Data.expense !== 0 ? (expenseDiff / p1Data.expense) * 100 : 0
        const incomeDiff = p2Data.income - p1Data.income
        const incomePct = p1Data.income !== 0 ? (incomeDiff / p1Data.income) * 100 : 0

        let formatted = `## 时间段对比\n\n`
        formatted += `### ${period1Start}~${period1End} → ${period2Start}~${period2End}\n\n`
        formatted += `**支出**: ¥${(p1Data.expense / 100).toFixed(2)} → ¥${(p2Data.expense / 100).toFixed(2)}`
        formatted += ` (${expenseDiff >= 0 ? '+' : ''}${(expenseDiff / 100).toFixed(2)}, ${expensePct >= 0 ? '+' : ''}${expensePct.toFixed(1)}%)\n`
        formatted += `**收入**: ¥${(p1Data.income / 100).toFixed(2)} → ¥${(p2Data.income / 100).toFixed(2)}`
        formatted += ` (${incomeDiff >= 0 ? '+' : ''}${(incomeDiff / 100).toFixed(2)}, ${incomePct >= 0 ? '+' : ''}${incomePct.toFixed(1)}%)\n`

        return {
            period1: {
                start: period1Start,
                end: period1End,
                expense: p1Data.expense / 100,
                income: p1Data.income / 100
            },
            period2: {
                start: period2Start,
                end: period2End,
                expense: p2Data.expense / 100,
                income: p2Data.income / 100
            },
            changes: {
                expenseDiff: expenseDiff / 100,
                expensePct: Math.round(expensePct * 10) / 10,
                incomeDiff: incomeDiff / 100,
                incomePct: Math.round(incomePct * 10) / 10
            },
            formatted
        }
    }
})
