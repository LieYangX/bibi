/**
 * 任务规划工具 - 清空当前会话任务
 * 仅在需要重新规划时调用
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentAgentContext } from '../../agent-run-context'
import { clearAgentTasks } from '../../../services/agent-task.service'

export const clearAgentTasksTool = tool({
    description: '清空当前会话的全部任务（仅在需要重新规划时调用）',
    inputSchema: z.object({}),
    execute: async () => {
        const ctx = getCurrentAgentContext()
        if (!ctx) throw new Error('Agent 上下文未初始化')

        await clearAgentTasks(ctx.conversationId, ctx.userId)

        // 发射 task_update 事件（空列表）
        await ctx.emit({ type: 'task_update', tasks: [], conversationId: ctx.conversationId })

        return {
            success: true,
            formatted: '已清空任务清单'
        }
    }
})
