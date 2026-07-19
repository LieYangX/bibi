/**
 * 任务规划工具 - 更新任务状态
 * 完成一步后立即调用，标记为 completed
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentAgentContext } from '../../../agent-run-context'
import { listAgentTasks, updateAgentTaskStatus } from '../../../../services/agent-task.service'

export const updateAgentTaskStatusTool = tool({
    description: '更新任务状态为已完成或待办（完成一步后立即调用）',
    inputSchema: z.object({
        task_id: z.string().describe('任务 ID（来自 createAgentTasks 返回）'),
        status: z
            .enum(['pending', 'completed'])
            .describe('新状态：completed=已完成，pending=重置为待办')
    }),
    execute: async (input) => {
        const ctx = getCurrentAgentContext()
        if (!ctx) throw new Error('Agent 上下文未初始化')

        const updated = await updateAgentTaskStatus(
            input.task_id,
            input.status,
            ctx.userId,
            ctx.conversationId
        )

        // 发射 task_update 事件
        const allTasks = await listAgentTasks(ctx.conversationId, ctx.userId)
        await ctx.emit({ type: 'task_update', tasks: allTasks, conversationId: ctx.conversationId })

        return {
            success: true,
            task: updated,
            formatted:
                input.status === 'completed'
                    ? `✅ 已完成：${updated.title}`
                    : `↩️ 已重置：${updated.title}`
        }
    }
})
