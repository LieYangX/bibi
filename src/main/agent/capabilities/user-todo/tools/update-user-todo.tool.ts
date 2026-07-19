/**
 * 待办管理工具 - 修改用户待办
 * 支持修改标题和截止日期，按 ID 或标题关键字定位
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../../../../services/session.service'
import { listTodos, updateTodo } from '../../../../services/todo.service'

export const updateUserTodoTool = tool({
    description: '修改用户的待办事项（标题、内容、截止日期或时间）',
    inputSchema: z.object({
        todo_id: z.string().optional().describe('待办 ID（精确修改，优先使用）'),
        title_keyword: z.string().optional().describe('标题关键字（当不提供 ID 时用于定位待办）'),
        new_title: z.string().optional().describe('新标题'),
        new_note: z.string().nullable().optional().describe('新内容，传 null 清除内容'),
        new_due_date: z
            .string()
            .nullable()
            .optional()
            .describe('新截止日期（YYYY-MM-DD），传 null 清除截止日期'),
        new_due_time: z
            .string()
            .nullable()
            .optional()
            .describe('新截止时间（HH:mm），传 null 清除截止时间')
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

        const updateData: {
            title?: string
            note?: string | null
            due_date?: string | null
            due_time?: string | null
        } = {}
        if (input.new_title !== undefined) updateData.title = input.new_title
        if (input.new_note !== undefined) updateData.note = input.new_note
        if (input.new_due_date !== undefined) updateData.due_date = input.new_due_date
        if (input.new_due_time !== undefined) updateData.due_time = input.new_due_time

        if (Object.keys(updateData).length === 0) {
            return { error: '请至少提供 new_title、new_note、new_due_date 或 new_due_time' }
        }

        const updated = await updateTodo(targetId, updateData, userId)
        if (!updated) {
            return { error: '待办不存在或已删除' }
        }

        const dueStr = updated.due_date
            ? `（截止 ${updated.due_date}${updated.due_time ? ` ${updated.due_time}` : ''}）`
            : ''
        return {
            success: true,
            todo: {
                id: updated.id,
                title: updated.title,
                note: updated.note,
                due_date: updated.due_date,
                due_time: updated.due_time,
                status: updated.status
            },
            formatted: `✅ 已更新待办：${updated.title}${dueStr}`
        }
    }
})
