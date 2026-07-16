/**
 * 精确计算工具 - evaluate
 * 使用 mathjs 引擎执行数学表达式求值，保证计算精确
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { create, all } from 'mathjs'

// 创建安全的 mathjs 实例
const math = create(all)

export const evaluateTool = tool({
    description:
        '执行数学表达式计算。支持 + - * / ( ) % ^ 运算。如 "1500 + 3200"、"(5230 - 3800) / 5230 * 100"',
    inputSchema: z.object({
        expression: z.string().describe('要计算的数学表达式')
    }),
    execute: async ({ expression }) => {
        try {
            const result = math.evaluate(expression)
            const numResult = typeof result === 'number' ? result : Number(result)
            return {
                expression,
                result: numResult,
                formatted: `${expression} = ${numResult}`
            }
        } catch (error) {
            return {
                error: `计算错误: ${error instanceof Error ? error.message : '未知错误'}`,
                expression
            }
        }
    }
})
