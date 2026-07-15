/**
 * 单位换算工具 - convert_cents_to_yuan
 * 将数据库中的"分"值转换为"元"
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'

export const convertCentsToYuanTool = tool({
    description: '将数据库中的"分"值转换为"元"（1元 = 100分），返回带 ¥ 符号的格式化字符串',
    inputSchema: z.object({
        cents: z.number().describe('分值，如 523000 表示 523000 分')
    }),
    execute: async ({ cents }) => {
        const yuan = cents / 100
        return {
            cents,
            yuan,
            formatted: `¥${yuan.toFixed(2)}`
        }
    }
})
