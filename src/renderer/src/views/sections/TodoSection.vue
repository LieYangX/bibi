<template>
    <div class="todo-section">
        <!-- 顶部操作条：筛选 tabs + 添加按钮 -->
        <div class="todo-topbar">
            <div class="bb-pill-group todo-filters">
                <button
                    v-for="f in filters"
                    :key="f.value"
                    class="bb-pill"
                    :class="{ active: currentFilterKey === f.value }"
                    @click="switchFilter(f.value)"
                >
                    {{ f.label }}
                </button>
            </div>
            <button class="bb-btn bb-btn-primary todo-add-btn" @click="openAddModal">
                <Plus :size="14" />
                添加待办
            </button>
        </div>

        <!-- 加载态 -->
        <div v-if="todoStore.loading && !todoStore.loaded" class="todo-status">正在加载待办…</div>
        <!-- 错误态 -->
        <div v-else-if="todoStore.error && !todoStore.loaded" class="todo-status is-error">
            <span>{{ todoStore.error }}</span>
            <button class="bb-btn bb-btn-sm" @click="reload">重试</button>
        </div>
        <!-- 待办列表 -->
        <div v-else-if="sortedTodos.length" class="todo-list">
            <div
                v-for="todo in sortedTodos"
                :key="todo.id"
                class="todo-item"
                :class="{ 'is-completed': todo.status === 'completed' }"
            >
                <!-- 自定义圆形复选框 -->
                <button
                    class="todo-check"
                    :class="{ checked: todo.status === 'completed' }"
                    :title="todo.status === 'completed' ? '标记为未完成' : '标记为已完成'"
                    @click="handleToggle(todo.id)"
                >
                    <Check v-if="todo.status === 'completed'" :size="14" />
                </button>

                <!-- 标题、内容与截止时间 -->
                <div class="todo-content">
                    <span class="todo-title">{{ todo.title }}</span>
                    <span v-if="todo.note" class="todo-note">{{ todo.note }}</span>
                    <span
                        v-if="todo.due_date"
                        class="bb-tag todo-due"
                        :class="{ 'is-overdue': isOverdue(todo) }"
                    >
                        <Calendar :size="11" />{{ formatDueDateTime(todo) }}
                    </span>
                </div>

                <!-- 操作按钮（悬停显示） -->
                <div class="todo-actions">
                    <button
                        class="bb-btn bb-btn-text todo-action-btn"
                        title="编辑"
                        @click="startEdit(todo)"
                    >
                        <Pencil :size="13" />
                    </button>
                    <BbPopconfirm content="确定删除这条待办吗？" @ok="handleDelete(todo.id)">
                        <template #reference>
                            <button
                                class="bb-btn bb-btn-text todo-action-btn todo-action-btn--del"
                                title="删除"
                            >
                                <Trash2 :size="13" />
                            </button>
                        </template>
                    </BbPopconfirm>
                </div>
            </div>
        </div>
        <!-- 空状态 -->
        <EmptyState v-else :icon="ClipboardList" text="还没有待办" hint="添加第一个吧" />

        <!-- 添加待办弹窗 -->
        <BbModal
            :visible="addModal.visible"
            title="添加待办"
            width="480px"
            @update:visible="addModal.visible = $event"
        >
            <div class="todo-edit-form">
                <div class="todo-edit-field">
                    <label class="todo-edit-label">标题</label>
                    <input
                        v-model="addModal.title"
                        class="bb-input"
                        placeholder="待办标题"
                        :maxlength="200"
                        @keydown.enter="handleCreate"
                    />
                </div>
                <div class="todo-edit-field">
                    <label class="todo-edit-label">内容（可选）</label>
                    <textarea
                        v-model="addModal.note"
                        class="bb-input todo-textarea"
                        placeholder="补充说明（可选）"
                        :maxlength="500"
                        rows="3"
                    />
                </div>
                <div class="todo-edit-row">
                    <div class="todo-edit-field todo-edit-field--half">
                        <label class="todo-edit-label">截止日期（可选）</label>
                        <BbDatePicker v-model="addModal.dueDate" placeholder="选择日期" />
                    </div>
                    <div class="todo-edit-field todo-edit-field--half">
                        <label class="todo-edit-label">截止时间（可选）</label>
                        <BbTimePicker v-model="addModal.dueTime" placeholder="选择时间" />
                    </div>
                </div>
            </div>
            <template #footer>
                <button class="bb-btn" @click="addModal.visible = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="!addModal.title.trim()"
                    @click="handleCreate"
                >
                    添加
                </button>
            </template>
        </BbModal>

        <!-- 编辑弹窗 -->
        <BbModal
            :visible="editModal.visible"
            title="编辑待办"
            width="480px"
            @update:visible="editModal.visible = $event"
        >
            <div class="todo-edit-form">
                <div class="todo-edit-field">
                    <label class="todo-edit-label">标题</label>
                    <input
                        v-model="editModal.title"
                        class="bb-input"
                        placeholder="待办标题"
                        :maxlength="200"
                    />
                </div>
                <div class="todo-edit-field">
                    <label class="todo-edit-label">内容（可选）</label>
                    <textarea
                        v-model="editModal.note"
                        class="bb-input todo-textarea"
                        placeholder="补充说明（可选）"
                        :maxlength="500"
                        rows="3"
                    />
                </div>
                <div class="todo-edit-row">
                    <div class="todo-edit-field todo-edit-field--half">
                        <label class="todo-edit-label">截止日期（可选）</label>
                        <BbDatePicker v-model="editModal.dueDate" placeholder="选择日期" />
                    </div>
                    <div class="todo-edit-field todo-edit-field--half">
                        <label class="todo-edit-label">截止时间（可选）</label>
                        <BbTimePicker v-model="editModal.dueTime" placeholder="选择时间" />
                    </div>
                </div>
            </div>
            <template #footer>
                <button class="bb-btn" @click="editModal.visible = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="!editModal.title.trim()"
                    @click="saveEdit"
                >
                    保存
                </button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 待办区段
 * 弹窗式添加/编辑，支持标题、内容、截止日期与时间
 * 所有操作经 todoStore 并依赖其写后重拉
 * @author xiangwei
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTodoStore } from '../../stores/todo.store'
import { BbDatePicker, BbModal, BbPopconfirm, BbTimePicker, Message } from '../../components/ui'
import EmptyState from '../../components/common/EmptyState.vue'
import { onRefresh } from '../../composables/useRefreshBus'
import { Check, Pencil, Trash2, Calendar, ClipboardList, Plus } from '@lucide/vue'
import type { Todo, TodoListFilter } from '@shared/types'

/** 筛选维度 */
type FilterKey = 'all' | 'today' | 'future' | 'completed'

const filters: { value: FilterKey; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'today', label: '今日' },
    { value: 'future', label: '以后' },
    { value: 'completed', label: '已完成' }
]

const todoStore = useTodoStore()
const currentFilterKey = ref<FilterKey>('all')

// ---- 添加弹窗状态 ----
const addModal = ref({
    visible: false,
    title: '',
    note: '',
    dueDate: '',
    dueTime: ''
})

// ---- 编辑弹窗状态 ----
const editModal = ref({
    visible: false,
    id: '',
    title: '',
    note: '',
    dueDate: '',
    dueTime: ''
})

/** 今日日期 YYYY-MM-DD */
const todayStr = computed(() => new Date().toISOString().slice(0, 10))
/** 明日日期 YYYY-MM-DD */
const tomorrowStr = computed(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))

/** 当前筛选条件，随筛选维度切换而变化 */
const currentFilter = computed<TodoListFilter>(() => {
    switch (currentFilterKey.value) {
        case 'today':
            return { due_start: todayStr.value, due_end: todayStr.value }
        case 'future':
            return { due_start: tomorrowStr.value }
        case 'completed':
            return { status: 'completed' }
        default:
            return {}
    }
})

/** 按 sort_order + created_at 升序排列 */
const sortedTodos = computed(() =>
    [...todoStore.todos].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.created_at.localeCompare(b.created_at)
    })
)

/**
 * 判断待办是否逾期
 * 仅对未完成且截止日期早于今天的待办返回 true
 * @param todo 待办对象
 * @returns 是否逾期
 * @author xiangwei
 */
function isOverdue(todo: Todo): boolean {
    if (todo.status === 'completed' || !todo.due_date) return false
    return todo.due_date < todayStr.value
}

/**
 * 格式化截止日期+时间显示
 * 当年省略年份，跨年显示完整日期；有时间则追加时间
 * @param todo 待办对象
 * @returns 格式化后的日期时间文本
 * @author xiangwei
 */
function formatDueDateTime(todo: Todo): string {
    if (!todo.due_date) return ''
    const d = new Date(todo.due_date + 'T00:00:00')
    if (isNaN(d.getTime())) return todo.due_date
    const now = new Date()
    const dateStr =
        d.getFullYear() === now.getFullYear()
            ? `${d.getMonth() + 1}月${d.getDate()}日`
            : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    return todo.due_time ? `${dateStr} ${todo.due_time}` : dateStr
}

/**
 * 切换筛选维度并重新加载
 * @param key 目标筛选维度
 * @author xiangwei
 */
function switchFilter(key: FilterKey): void {
    if (currentFilterKey.value === key) return
    currentFilterKey.value = key
    todoStore.loadTodos(true, currentFilter.value)
}

/** 重新加载当前筛选条件下的待办 */
function reload(): void {
    todoStore.loadTodos(true, currentFilter.value)
}

/** 打开添加弹窗并重置表单，截止日期/时间默认取当前 */
function openAddModal(): void {
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    addModal.value = {
        visible: true,
        title: '',
        note: '',
        dueDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        dueTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`
    }
}

/** 添加待办（弹窗提交） */
async function handleCreate(): Promise<void> {
    const title = addModal.value.title.trim()
    if (!title) return
    const ok = await todoStore.createTodo(
        {
            title,
            note: addModal.value.note.trim() || null,
            due_date: addModal.value.dueDate || null,
            due_time: addModal.value.dueTime || null
        },
        currentFilter.value
    )
    if (ok) {
        Message.success('已添加')
        addModal.value.visible = false
    } else {
        Message.error('添加失败')
    }
}

/**
 * 切换待办完成状态
 * @param id 待办 ID
 * @author xiangwei
 */
async function handleToggle(id: string): Promise<void> {
    const ok = await todoStore.toggleTodo(id, currentFilter.value)
    if (!ok) Message.error('操作失败')
}

/**
 * 打开编辑弹窗并填充待办数据
 * @param todo 待编辑的待办对象
 * @author xiangwei
 */
function startEdit(todo: Todo): void {
    editModal.value = {
        visible: true,
        id: todo.id,
        title: todo.title,
        note: todo.note || '',
        dueDate: todo.due_date || '',
        dueTime: todo.due_time || ''
    }
}

/** 保存编辑并关闭弹窗 */
async function saveEdit(): Promise<void> {
    const title = editModal.value.title.trim()
    if (!title) return
    const ok = await todoStore.updateTodo(
        editModal.value.id,
        {
            title,
            note: editModal.value.note.trim() || null,
            due_date: editModal.value.dueDate || null,
            due_time: editModal.value.dueTime || null
        },
        currentFilter.value
    )
    if (ok) {
        Message.success('已更新')
        editModal.value.visible = false
    } else {
        Message.error('更新失败')
    }
}

/**
 * 删除待办（经 BbPopconfirm 二次确认后触发）
 * @param id 待办 ID
 * @author xiangwei
 */
async function handleDelete(id: string): Promise<void> {
    const r = await todoStore.deleteTodo(id, currentFilter.value)
    if (r.ok) Message.success('已删除')
    else Message.error(r.error || '删除失败')
}

let offRefresh: () => void
onMounted(() => {
    // 首屏主动拉取当前筛选条件下的待办
    todoStore.loadTodos(true, currentFilter.value)
    // 订阅 todo 刷新事件，写操作后其他页面可触发重载
    offRefresh = onRefresh('todo', () => todoStore.loadTodos(true, currentFilter.value))
})
onUnmounted(() => offRefresh?.())
</script>

<style scoped>
.todo-section {
    display: flex;
    flex-direction: column;
}

/* 顶部操作条 */
.todo-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.todo-filters {
    flex-shrink: 0;
    flex-wrap: nowrap;
}
.todo-filters .bb-pill {
    white-space: nowrap;
    flex: 0 0 auto;
}
.todo-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

/* 加载与错误状态 */
.todo-status {
    display: flex;
    min-height: 160px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--bb-text-tertiary);
    font-size: 13px;
}
.todo-status.is-error {
    color: var(--bb-danger);
}

/* 待办列表 */
.todo-list {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    overflow: hidden;
}
.todo-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bb-border);
    transition: background var(--bb-duration-fast) var(--bb-ease);
}
.todo-item:last-child {
    border-bottom: none;
}
.todo-item:hover {
    background: var(--bb-bg-hover);
}

/* 自定义圆形复选框 */
.todo-check {
    width: 20px;
    height: 20px;
    border: 2px solid var(--bb-border);
    border-radius: 50%;
    background: transparent;
    color: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    margin-top: 1px;
    transition:
        border-color var(--bb-duration-fast) var(--bb-ease),
        background var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease);
}
.todo-check:hover {
    border-color: var(--bb-accent);
}
.todo-check.checked {
    background: var(--bb-success);
    border-color: var(--bb-success);
    color: var(--bb-bg-card);
}

/* 标题、内容与截止时间 */
.todo-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.todo-title {
    font-size: 14px;
    color: var(--bb-text-primary);
    transition:
        color var(--bb-duration-fast) var(--bb-ease),
        text-decoration-color var(--bb-duration-fast) var(--bb-ease);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.is-completed .todo-title {
    text-decoration: line-through;
    color: var(--bb-text-tertiary);
}
.todo-note {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 截止日期时间标签 */
.todo-due {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
    align-self: flex-start;
}
.todo-due.is-overdue {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

/* 操作按钮 */
.todo-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
    flex-shrink: 0;
    margin-top: 1px;
}
.todo-item:hover .todo-actions {
    opacity: 1;
}
.todo-action-btn {
    padding: 2px 5px;
    color: var(--bb-text-tertiary);
}
.todo-action-btn:hover {
    color: var(--bb-accent-text);
}
.todo-action-btn--del:hover {
    color: var(--bb-danger);
}

/* 弹窗表单 */
.todo-edit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.todo-edit-row {
    display: flex;
    gap: 12px;
}
.todo-edit-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}
.todo-edit-label {
    font-size: 13px;
    color: var(--bb-text-secondary);
    font-weight: var(--bb-weight-medium);
}
.todo-textarea {
    resize: vertical;
    min-height: 60px;
    font-family: var(--bb-font-family);
}
</style>
