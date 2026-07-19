/**
 * 任务规划工具 - 查询当前会话任务进度
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentAgentContext } from '../../agent-run-context'
import { listAgentTasks } from '../../../services/agent-task.service'

export const queryAgentTasksTool = tool({
    description: '查询当前会话的任务清单进度',
    inputSchema: z.object({}),
    execute: async () => {
        const ctx = getCurrentAgentContext()
        if (!ctx) throw new Error('Agent 上下文未初始化')

        const tasks = await listAgentTasks(ctx.conversationId, ctx.userId)
        const completed = tasks.filter((t) => t.status === 'completed').length

        return {
            success: true,
            total: tasks.length,
            completed,
            pending: tasks.length - completed,
            tasks,
            formatted:
                tasks.length === 0
                    ? '当前会话无任务清单'
                    : `任务进度 ${completed}/${tasks.length}：\n${tasks
                          .map(
                              (t, i) =>
                                  `${i + 1}. ${t.status === 'completed' ? '✅' : '⏳'} ${t.title}`
                          )
                          .join('\n')}`
        }
    }
})
