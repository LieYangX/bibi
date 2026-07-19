/**
 * 待办管理 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { createTodo, deleteTodo, listTodos, toggleTodo, updateTodo } from '../services/todo.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerTodoIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.todo.list,
        IPC_SCHEMAS.todo.list,
        '查询待办失败',
        (userId, _event, filter) => listTodos(userId, filter)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.todo.create,
        IPC_SCHEMAS.todo.create,
        '创建待办失败',
        (userId, _event, data) => createTodo(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.todo.update,
        IPC_SCHEMAS.todo.update,
        '更新待办失败',
        (userId, _event, id, data) => updateTodo(id, data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.todo.delete,
        IPC_SCHEMAS.todo.delete,
        '删除待办失败',
        (userId, _event, id) => deleteTodo(id, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.todo.toggle,
        IPC_SCHEMAS.todo.toggle,
        '切换待办状态失败',
        (userId, _event, id) => toggleTodo(id, userId)
    )
}
