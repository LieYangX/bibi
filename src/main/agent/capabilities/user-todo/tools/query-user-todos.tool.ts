/**
 * 待办管理工具 - 查询用户待办列表
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import { listTodos } from '../../../../services/todo.service'

export const queryUserTodosTool = tool({
    description: '查询用户的待办事项列表，支持按状态、日期范围、关键字过滤',
    inputSchema: z.object({
        status: z
            .enum(['pending', 'completed'])
            .optional()
            .describe('按状态过滤：pending=待办，completed=已完成。不传则返回全部'),
        due_start: z.string().optional().describe('截止日期起始（YYYY-MM-DD）'),
        due_end: z.string().optional().describe('截止日期结束（YYYY-MM-DD）'),
        keyword: z.string().optional().describe('标题关键字')
    }),
    execute: async (input) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        const todos = await listTodos(userId, {
            status: input.status,
            due_start: input.due_start,
            due_end: input.due_end,
            keyword: input.keyword
        })

        if (todos.length === 0) {
            return {
                success: true,
                total: 0,
                formatted: '暂无待办'
            }
        }

        const pending = todos.filter((t) => t.status === 'pending').length
        const completed = todos.length - pending

        return {
            success: true,
            total: todos.length,
            pending,
            completed,
            todos: todos.map((t) => ({
                id: t.id,
                title: t.title,
                note: t.note,
                status: t.status,
                due_date: t.due_date,
                due_time: t.due_time
            })),
            formatted: `共 ${todos.length} 条待办（${pending} 待办 / ${completed} 已完成）：\n${todos
                .map(
                    (t, i) =>
                        `${i + 1}. ${t.status === 'completed' ? '✅' : '⏳'} ${t.title}${t.due_date ? `（截止 ${t.due_date}${t.due_time ? ` ${t.due_time}` : ''}）` : ''}${t.note ? `\n   内容：${t.note}` : ''}`
                )
                .join('\n')}`
        }
    }
})
