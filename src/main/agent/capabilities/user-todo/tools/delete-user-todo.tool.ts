/**
 * 待办管理工具 - 删除用户待办
 * 支持按 ID 精确删除或按标题关键字模糊匹配
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import { deleteTodo, listTodos } from '../../../../services/todo.service'

export const deleteUserTodoTool = tool({
    description: '删除用户的待办事项（支持按 ID 或标题关键字模糊匹配）',
    inputSchema: z.object({
        todo_id: z.string().optional().describe('待办 ID（精确删除，优先使用）'),
        title_keyword: z
            .string()
            .optional()
            .describe('标题关键字（模糊匹配删除，当不提供 ID 时使用）')
    }),
    execute: async (input) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        let targetId = input.todo_id

        // 无 ID 时按标题关键字模糊匹配
        if (!targetId && input.title_keyword) {
            const todos = await listTodos(userId, { keyword: input.title_keyword })
            if (todos.length === 0) {
                return { error: `未找到包含"${input.title_keyword}"的待办` }
            }
            if (todos.length > 1) {
                return {
                    error: `找到 ${todos.length} 条匹配的待办，请提供更精确的关键字或使用 ID`,
                    matches: todos.map((t) => ({ id: t.id, title: t.title }))
                }
            }
            targetId = todos[0].id
        }

        if (!targetId) {
            return { error: '请提供 todo_id 或 title_keyword' }
        }

        await deleteTodo(targetId, userId)
        return {
            success: true,
            formatted: '✅ 已删除待办'
        }
    }
})
