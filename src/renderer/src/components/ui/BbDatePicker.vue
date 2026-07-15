<template>
    <div
        ref="wrapRef"
        class="bb-datepicker"
        :class="{ 'bb-datepicker--sm': size === 'sm' }"
        :style="wrapStyle"
    >
        <div class="bb-datepicker-trigger" @click="toggle">
            <Calendar :size="14" class="bb-datepicker-icon" />
            <span v-if="displayText" class="bb-datepicker-text">{{ displayText }}</span>
            <span v-else class="bb-datepicker-ph">{{ placeholder || '选择日期' }}</span>
            <ChevronDown :size="14" class="bb-datepicker-arrow" :class="{ rotated: open }" />
        </div>
        <teleport to="body">
            <transition name="bb-pop">
                <div
                    v-if="open"
                    ref="dropdownRef"
                    class="bb-datepicker-dropdown"
                    :style="dropStyle"
                >
                    <!-- 月份导航 -->
                    <div class="bb-dp-nav">
                        <button class="bb-dp-nav-btn" title="上个月" @click="prevMonth">
                            <ChevronLeft :size="16" />
                        </button>
                        <span class="bb-dp-nav-label">{{ year }}年{{ month + 1 }}月</span>
                        <button class="bb-dp-nav-btn" title="下个月" @click="nextMonth">
                            <ChevronRight :size="16" />
                        </button>
                    </div>
                    <!-- 星期头 -->
                    <div class="bb-dp-weekdays">
                        <span v-for="d in weekDays" :key="d" class="bb-dp-weekday">{{ d }}</span>
                    </div>
                    <!-- 日期网格 -->
                    <div class="bb-dp-grid">
                        <button
                            v-for="(day, i) in dayGrid"
                            :key="i"
                            class="bb-dp-day"
                            :class="{
                                'bb-dp-day--empty': !day,
                                'bb-dp-day--today': day && isToday(year, month, day),
                                'bb-dp-day--selected': day && isSelected(year, month, day),
                                'bb-dp-day--other': day && !isCurrentMonth(day, i)
                            }"
                            :disabled="!day"
                            @click="day && selectDate(year, month, day)"
                        >
                            {{ day || '' }}
                        </button>
                    </div>
                    <!-- 底部快捷操作 -->
                    <div class="bb-dp-footer">
                        <button class="bb-dp-footer-btn" @click="selectToday">回到今天</button>
                        <button
                            v-if="modelValue"
                            class="bb-dp-footer-btn bb-dp-footer-btn--clear"
                            @click="handleClear"
                        >
                            清空
                        </button>
                    </div>
                </div>
            </transition>
        </teleport>
    </div>
</template>

<script setup lang="ts">
/**
 * 自定义日期选择器
 * 纯白日历浮层，支持月份切换、今天快捷选择
 * v-model 绑定 YYYY-MM-DD 字符串
 * @author xiangwei
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{
    modelValue?: string
    placeholder?: string
    width?: string
    size?: 'default' | 'sm'
}>()
const emit = defineEmits<{
    'update:modelValue': [v: string]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()
const dropStyle = ref<Record<string, string>>({})

const wrapStyle = computed(() => {
    const style: Record<string, string> = {}
    if (props.width) style.width = props.width
    return style
})

// 解析 v-model 日期，默认为今天
const today = new Date()
const currentDate = computed(() => {
    if (!props.modelValue) return today
    const d = new Date(props.modelValue + 'T00:00:00')
    return isNaN(d.getTime()) ? today : d
})

const year = ref(currentDate.value.getFullYear())
const month = ref(currentDate.value.getMonth())

// 当外部 v-model 变化时同步导航月份
watch(currentDate, (d) => {
    year.value = d.getFullYear()
    month.value = d.getMonth()
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const displayText = computed(() => {
    if (!props.modelValue) return ''
    const d = new Date(props.modelValue + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

/** 当前月份的天数网格（含前后补齐空位） */
const dayGrid = computed<(number | null)[]>(() => {
    const firstDay = new Date(year.value, month.value, 1).getDay() // 0=周日
    const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
    const grid: (number | null)[] = []
    // 月初空白补齐
    for (let i = 0; i < firstDay; i++) grid.push(null)
    for (let d = 1; d <= daysInMonth; d++) grid.push(d)
    // 补齐到 6 行（42 格）
    while (grid.length < 42) grid.push(null)
    return grid
})

function isToday(y: number, m: number, d: number): boolean {
    const t = new Date()
    return y === t.getFullYear() && m === t.getMonth() && d === t.getDate()
}

function isSelected(y: number, m: number, d: number): boolean {
    if (!props.modelValue) return false
    const sel = new Date(props.modelValue + 'T00:00:00')
    return y === sel.getFullYear() && m === sel.getMonth() && d === sel.getDate()
}

function isCurrentMonth(_day: number, index: number): boolean {
    const firstDay = new Date(year.value, month.value, 1).getDay()
    const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
    const dayOfMonth = index - firstDay + 1
    return dayOfMonth >= 1 && dayOfMonth <= daysInMonth
}

function prevMonth(): void {
    if (month.value === 0) {
        month.value = 11
        year.value--
    } else {
        month.value--
    }
}

function nextMonth(): void {
    if (month.value === 11) {
        month.value = 0
        year.value++
    } else {
        month.value++
    }
}

function selectDate(y: number, m: number, d: number): void {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    emit('update:modelValue', dateStr)
    open.value = false
}

function selectToday(): void {
    const t = new Date()
    selectDate(t.getFullYear(), t.getMonth(), t.getDate())
}

/** 清空已选日期 */
function handleClear(): void {
    emit('update:modelValue', '')
}

function toggle(): void {
    if (open.value) {
        open.value = false
    } else {
        openPanel()
    }
}

/** 先展开再按实际高度修正展开方向 */
function openPanel(): void {
    if (!wrapRef.value) return
    // 打开时同步导航到当前选中月份
    const d = currentDate.value
    year.value = d.getFullYear()
    month.value = d.getMonth()
    const rect = wrapRef.value.getBoundingClientRect()
    const dropWidth = 280
    let left = rect.left
    if (left + dropWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropWidth - 8
    }
    if (left < 8) left = 8
    // 第一阶段：先固定到下方让面板渲染出来
    dropStyle.value = {
        position: 'fixed',
        top: rect.bottom + 4 + 'px',
        left: left + 'px',
        width: dropWidth + 'px',
        zIndex: '2000'
    }
    open.value = true
    // 第二阶段：等面板渲染完成，测量实际高度，判断是否需要向上展开
    requestAnimationFrame(() => {
        if (!dropdownRef.value) return
        const actualHeight = dropdownRef.value.offsetHeight
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        let top: number
        if (spaceBelow >= actualHeight || spaceBelow >= spaceAbove) {
            top = rect.bottom + 4
        } else {
            top = rect.top - actualHeight - 4
        }
        dropStyle.value = {
            ...dropStyle.value,
            top: top + 'px'
        }
    })
}

function handleClick(e: MouseEvent): void {
    const target = e.target as Node
    const clickedInsideWrap = wrapRef.value?.contains(target)
    const clickedInsideDropdown = dropdownRef.value?.contains(target)
    if (!clickedInsideWrap && !clickedInsideDropdown) {
        open.value = false
    }
}

function handleKeydown(e: KeyboardEvent): void {
    if (!open.value) return
    if (e.key === 'Escape') {
        open.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
    document.removeEventListener('click', handleClick)
    document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.bb-datepicker {
    position: relative;
    width: 100%;
}
.bb-datepicker-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
    cursor: pointer;
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
    min-height: 38px;
}
.bb-datepicker--sm .bb-datepicker-trigger {
    padding: 5px 10px;
    font-size: 13px;
    min-height: 32px;
}
.bb-datepicker-trigger:hover {
    border-color: var(--bb-accent);
}
.bb-datepicker-icon {
    color: var(--bb-accent);
    flex-shrink: 0;
}
.bb-datepicker-text {
    flex: 1;
    color: var(--bb-text-primary);
}
.bb-datepicker-ph {
    flex: 1;
    color: var(--bb-text-tertiary);
}
.bb-datepicker-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
    transition: transform 0.2s;
}
.bb-datepicker-arrow.rotated {
    transform: rotate(180deg);
}

/* 下拉日历浮层 */
.bb-datepicker-dropdown {
    background: #fff;
    border: 1px solid var(--bb-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    padding: 12px;
    user-select: none;
}

/* 月份导航 */
.bb-dp-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}
.bb-dp-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
}
.bb-dp-nav-btn:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-accent-text);
}
.bb-dp-nav-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--bb-text-primary);
}

/* 星期头 */
.bb-dp-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
}
.bb-dp-weekday {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--bb-text-tertiary);
    padding: 4px 0;
}

/* 日期网格 */
.bb-dp-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
}
.bb-dp-day {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.1s ease;
}
.bb-dp-day:hover:not(:disabled) {
    background: var(--bb-bg-hover);
}
.bb-dp-day--empty {
    cursor: default;
}
.bb-dp-day--today {
    font-weight: 600;
    color: var(--bb-accent);
    border: 1px solid var(--bb-accent);
}
.bb-dp-day--selected {
    background: var(--bb-accent);
    color: #fff;
    font-weight: 600;
}
.bb-dp-day--selected:hover {
    background: var(--bb-accent-hover);
}
.bb-dp-day--other {
    color: var(--bb-text-disabled);
}

/* 底部操作 */
.bb-dp-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--bb-border);
}
.bb-dp-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    color: var(--bb-accent-text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.1s ease;
}
.bb-dp-footer-btn:hover {
    background: var(--bb-accent-light);
}
.bb-dp-footer-btn--clear {
    color: var(--bb-text-tertiary);
}
.bb-dp-footer-btn--clear:hover {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

/* 复用 BbSelect 的弹出动效 */
.bb-pop-enter-active,
.bb-pop-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}
.bb-pop-enter-from,
.bb-pop-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
