/**
 * 待办管理工具 - 创建用户待办
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import { createTodo } from '../../../../services/todo.service'

export const createUserTodoTool = tool({
    description: '帮用户创建一条待办事项，包含标题、内容（可选）、截止日期和时间',
    inputSchema: z.object({
        title: z.string().min(1).max(200).describe('待办标题（必填）'),
        note: z.string().max(500).optional().describe('待办内容（可选，用户未提及时不传）'),
        due_date: z
            .string()
            .optional()
            .describe('截止日期，格式 YYYY-MM-DD（可选，用户未提及时不传）'),
        due_time: z.string().optional().describe('截止时间，格式 HH:mm（可选，用户未提及时不传）')
    }),
    execute: async (input) => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        // 未提供截止日期/时间时默认取当前本地时间
        const now = new Date()
        const pad = (n: number): string => String(n).padStart(2, '0')
        const dueDate =
            input.due_date ??
            `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        const dueTime = input.due_time ?? `${pad(now.getHours())}:${pad(now.getMinutes())}`

        const todo = await createTodo(
            {
                title: input.title,
                note: input.note ?? null,
                due_date: dueDate,
                due_time: dueTime
            },
            userId
        )
        const dueStr = todo.due_date
            ? `（截止 ${todo.due_date}${todo.due_time ? ` ${todo.due_time}` : ''}）`
            : ''
        return {
            success: true,
            id: todo.id,
            formatted: `✅ 已创建待办：${todo.title}${dueStr}`
        }
    }
})
