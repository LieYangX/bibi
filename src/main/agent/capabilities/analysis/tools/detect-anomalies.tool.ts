/**
 * 异常检测工具
 * 检测指定时间段内的大额异常支出
 *
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import {
    queryExpenseStats,
    queryAnomalyExpenses
} from '../../../services/transaction-analytics.service'

export const detectAnomaliesTool = tool({
    description:
        '检测指定时间段内的异常大额支出（超过平均值 N 倍）。适合“最近有没有花得特别多的”类请求。',
    inputSchema: z.object({
        start_date: z.string().describe('开始日期 YYYY-MM-DD'),
        end_date: z.string().describe('结束日期 YYYY-MM-DD'),
        threshold: z.number().optional().describe('超过平均值的倍数，默认 3')
    }),
    execute: async ({ start_date, end_date, threshold = 3 }) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        const stats = await queryExpenseStats({
            userId,
            startDate: start_date,
            endDate: end_date
        })

        if (stats.count === 0) {
            return {
                message: '该时间段内没有支出记录',
                anomalies: [],
                formatted: '没有支出数据可分析'
            }
        }

        const avgAmount = stats.avg
        const thresholdAmount = avgAmount * threshold

        const anomalies = await queryAnomalyExpenses(
            { userId, startDate: start_date, endDate: end_date },
            thresholdAmount
        )

        const items = anomalies.map((a) => ({
            date: a.date,
            amount: (a.amount_cents / 100).toFixed(2),
            category: a.category_name || '未分类',
            note: a.note
        }))

        let formatted = `## 异常支出检测\n\n`
        formatted += `统计区间: ${start_date} ~ ${end_date}\n`
        formatted += `平均单笔支出: ¥${(avgAmount / 100).toFixed(2)}\n`
        formatted += `异常阈值（${threshold}倍）: ¥${(thresholdAmount / 100).toFixed(2)}\n\n`

        if (items.length === 0) {
            formatted += `未发现异常支出\n`
        } else {
            formatted += `发现 ${items.length} 笔异常支出：\n\n`
            for (const item of items) {
                formatted += `- ${item.date} ¥${item.amount}`
                if (item.category) formatted += ` | ${item.category}`
                if (item.note) formatted += ` | ${item.note}`
                formatted += '\n'
            }
        }

        return {
            avgAmount: (avgAmount / 100).toFixed(2),
            threshold: threshold,
            thresholdAmount: (thresholdAmount / 100).toFixed(2),
            anomalies: items,
            formatted
        }
    }
})
