/**
 * 对比工具 - compare_values
 * 对比两组数据，返回变化值和百分比
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'

export const compareValuesTool = tool({
    description: '对比两个数值的变化，返回差值、变化百分比和趋势描述',
    inputSchema: z.object({
        current: z.number().describe('当前值'),
        previous: z.number().describe('对比的基准值'),
        label: z.string().optional().describe('数据标签，如"支出""收入"')
    }),
    execute: async ({ current, previous, label }) => {
        const diff = current - previous
        const pctChange = previous !== 0 ? (diff / previous) * 100 : 0
        const trend = diff > 0 ? '上升' : diff < 0 ? '下降' : '持平'
        const labelText = label ? `（${label}）` : ''

        const formatted = `对比结果${labelText}：
当前值: ${current}
基准值: ${previous}
变化值: ${diff >= 0 ? '+' : ''}${diff}
变化百分比: ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%
趋势: ${trend}`

        return {
            diff,
            percentageChange: Math.round(pctChange * 100) / 100,
            trend,
            formatted
        }
    }
})
