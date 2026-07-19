/**
 * 任务规划工具 - 批量创建任务清单
 * 多步骤任务执行前一次性创建全部任务
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentAgentContext } from '../../agent-run-context'
import {
    clearAgentTasks,
    createAgentTasks,
    listAgentTasks
} from '../../../services/agent-task.service'

export const createAgentTasksTool = tool({
    description: '创建任务清单。每次开始执行新步骤前必须先调用本工具清理旧任务并创建新任务清单。',
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

        // 检查是否有未完成的任务
        const existingTasks = await listAgentTasks(ctx.conversationId, ctx.userId)
        const uncompletedTasks = existingTasks.filter((t) => t.status !== 'completed')

        // 先清理所有旧任务
        if (existingTasks.length > 0) {
            await clearAgentTasks(ctx.conversationId, ctx.userId)
        }

        // 创建新任务
        const created = await createAgentTasks(ctx.conversationId, ctx.userId, input.tasks)

        // 发射 task_update 事件，只保留未完成的（新创建的都是未完成，保持一致）
        const allTasks = await listAgentTasks(ctx.conversationId, ctx.userId)
        const pendingTasks = allTasks.filter((t) => t.status !== 'completed')
        await ctx.emit({
            type: 'task_update',
            tasks: pendingTasks,
            conversationId: ctx.conversationId
        })

        // 构建未完成提示（如果有）
        const remainingTitles = uncompletedTasks.map((t) => t.title)
        const uncompletedNote =
            remainingTitles.length > 0
                ? `注意：上一轮还有 ${remainingTitles.length} 个未完成任务（${remainingTitles.join('、')}），已被旧清单清理。如果仍需完成，请将它们包含在这次的新清单中。`
                : ''

        const formatted = `${uncompletedNote ? uncompletedNote + '\n\n' : ''}✅ 已创建 ${created.length} 个任务：\n${created
            .map((t, i) => `${i + 1}. ${t.title}`)
            .join('\n')}`

        return {
            success: true,
            created_count: created.length,
            tasks: created,
            has_uncompleted_from_last_round: remainingTitles.length > 0 ? remainingTitles : [],
            formatted
        }
    }
})
