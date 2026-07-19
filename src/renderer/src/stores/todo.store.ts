/**
 * 待办状态管理
 * 沿用 category.store 的 loaded/loading/error + generation 防护范式
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreateTodoDTO, IpcResult, Todo, TodoListFilter, UpdateTodoDTO } from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    createStaleUserRequestResult,
    isUserRequestCurrent
} from '../app/session/user-request-generation'
import { emitRefresh } from '../composables/useRefreshBus'

export const useTodoStore = defineStore('todo', () => {
    const todos = ref<Todo[]>([])
    const loaded = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)
    let latestLoadRequestId = 0

    async function loadTodosForGeneration(
        force: boolean,
        filter: TodoListFilter,
        generation: number
    ): Promise<boolean> {
        if (!isUserRequestCurrent(generation)) return false
        if (loaded.value && !force) return true

        const requestId = ++latestLoadRequestId
        loading.value = true
        error.value = null
        const result = await desktopApi.todo.list(filter)
        if (requestId !== latestLoadRequestId || !isUserRequestCurrent(generation)) return false

        if (result.ok) {
            todos.value = result.data
            loaded.value = true
        } else {
            error.value = result.error
            loaded.value = false
        }
        loading.value = false
        return loaded.value
    }

    async function loadTodos(force = false, filter: TodoListFilter = {}): Promise<void> {
        await loadTodosForGeneration(force, filter, captureUserRequestGeneration())
    }

    async function reloadAndNotify(
        generation: number,
        filter: TodoListFilter = {}
    ): Promise<boolean> {
        if (!(await loadTodosForGeneration(true, filter, generation))) return false
        if (!isUserRequestCurrent(generation)) return false

        emitRefresh('todo')
        return true
    }

    async function createTodo(data: CreateTodoDTO, filter: TodoListFilter = {}): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.todo.create(data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation, filter)
    }

    async function updateTodo(
        id: string,
        data: UpdateTodoDTO,
        filter: TodoListFilter = {}
    ): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.todo.update(id, data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation, filter)
    }

    async function deleteTodo(id: string, filter: TodoListFilter = {}): Promise<IpcResult> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.todo.delete(id)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult()
        if (result.ok && !(await reloadAndNotify(generation, filter))) {
            return createStaleUserRequestResult()
        }
        return result
    }

    async function toggleTodo(id: string, filter: TodoListFilter = {}): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.todo.toggle(id)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation, filter)
    }

    function reset(): void {
        latestLoadRequestId++
        todos.value = []
        loaded.value = false
        loading.value = false
        error.value = null
    }

    return {
        todos,
        loaded,
        loading,
        error,
        loadTodos,
        createTodo,
        updateTodo,
        deleteTodo,
        toggleTodo,
        reset
    }
})
