/**
 * 汇总统计工具 - summarize
 * 对数值数组进行汇总统计
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'

export const summarizeTool = tool({
    description: '对一组数值进行汇总统计，返回总和、平均值、最大值、最小值、数量',
    inputSchema: z.object({
        values: z.array(z.number()).describe('数值数组，如 [1500, 3200, 500]')
    }),
    execute: async ({ values }) => {
        if (values.length === 0) {
            return { error: '数值数组为空', formatted: '没有数据可汇总' }
        }

        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length
        const max = Math.max(...values)
        const min = Math.min(...values)
        const count = values.length

        return {
            sum,
            average: avg,
            max,
            min,
            count,
            formatted: `汇总统计（共 ${count} 项）：
总和: ${sum}
平均值: ${avg}
最大值: ${max}
最小值: ${min}`
        }
    }
})
