/**
 * 待办相关类型定义
 * 极简纯任务清单，与记账解耦
 * @author xiangwei
 */

export type TodoStatus = 'pending' | 'completed'

export interface Todo {
    id: string
    user_id: string
    title: string
    note: string | null
    status: TodoStatus
    due_date: string | null
    due_time: string | null
    completed_at: string | null
    sort_order: number
    is_deleted: number
    created_at: string
    updated_at: string
}

export interface CreateTodoDTO {
    title: string
    note?: string | null
    due_date?: string | null
    due_time?: string | null
}

export interface UpdateTodoDTO {
    title?: string
    note?: string | null
    due_date?: string | null
    due_time?: string | null
}

export interface TodoListFilter {
    status?: TodoStatus
    due_start?: string
    due_end?: string
    keyword?: string
}
