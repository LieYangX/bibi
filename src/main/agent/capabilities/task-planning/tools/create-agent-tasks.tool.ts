/**
 * 任务规划工具 - 批量创建任务清单
 * 多步骤任务执行前一次性创建全部任务
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentAgentContext } from '../../../agent-run-context'
import { createAgentTasks, listAgentTasks } from '../../../../services/agent-task.service'

export const createAgentTasksTool = tool({
    description: '批量创建任务清单（多步骤任务规划，3 步及以上任务必须先调用此工具）',
    inputSchema: z.object({
        tasks: z
            .array(
                z.object({
                    title: z.string().min(1).max(200).describe('任务标题，祈使句，≤20 字'),
                    sort_order: z.number().int().optional().describe('排序序号，默认按数组顺序')
                })
            )
            .min(1)
            .max(20)
            .describe('任务数组，按执行顺序排列')
    }),
    execute: async (input) => {
        const ctx = getCurrentAgentContext()
        if (!ctx) throw new Error('Agent 上下文未初始化')

        const created = await createAgentTasks(ctx.conversationId, ctx.userId, input.tasks)

        // 发射 task_update 事件，前端实时更新任务进度面板
        const allTasks = await listAgentTasks(ctx.conversationId, ctx.userId)
        await ctx.emit({ type: 'task_update', tasks: allTasks, conversationId: ctx.conversationId })

        return {
            success: true,
            created_count: created.length,
            tasks: created,
            formatted: `✅ 已创建 ${created.length} 个任务：\n${created
                .map((t, i) => `${i + 1}. ${t.title}`)
                .join('\n')}`
        }
    }
})
