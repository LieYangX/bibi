<template>
    <div
        ref="wrapRef"
        class="bb-timepicker"
        :class="{ 'bb-timepicker--sm': size === 'sm' }"
        :style="wrapStyle"
    >
        <div class="bb-timepicker-trigger" @click="toggle">
            <Clock :size="14" class="bb-timepicker-icon" />
            <span v-if="modelValue" class="bb-timepicker-text">{{ modelValue }}</span>
            <span v-else class="bb-timepicker-ph">{{ placeholder || '选择时间' }}</span>
            <ChevronDown :size="14" class="bb-timepicker-arrow" :class="{ rotated: open }" />
        </div>
        <teleport to="body">
            <transition name="bb-pop">
                <div
                    v-if="open"
                    ref="dropdownRef"
                    class="bb-timepicker-dropdown"
                    :style="dropStyle"
                >
                    <div class="bb-tp-columns">
                        <!-- 小时列 -->
                        <div class="bb-tp-col">
                            <div class="bb-tp-col-header">时</div>
                            <div ref="hourListRef" class="bb-tp-col-list">
                                <button
                                    v-for="h in 24"
                                    :key="h - 1"
                                    class="bb-tp-item"
                                    :class="{ 'bb-tp-item--selected': selectedHour === h - 1 }"
                                    @click="selectHour(h - 1)"
                                >
                                    {{ String(h - 1).padStart(2, '0') }}
                                </button>
                            </div>
                        </div>
                        <!-- 分钟列 -->
                        <div class="bb-tp-col">
                            <div class="bb-tp-col-header">分</div>
                            <div ref="minuteListRef" class="bb-tp-col-list">
                                <button
                                    v-for="m in 60"
                                    :key="m - 1"
                                    class="bb-tp-item"
                                    :class="{ 'bb-tp-item--selected': selectedMinute === m - 1 }"
                                    @click="selectMinute(m - 1)"
                                >
                                    {{ String(m - 1).padStart(2, '0') }}
                                </button>
                            </div>
                        </div>
                    </div>
                    <!-- 底部快捷操作 -->
                    <div class="bb-tp-footer">
                        <button class="bb-tp-footer-btn" @click="selectNow">现在</button>
                        <button
                            v-if="modelValue"
                            class="bb-tp-footer-btn bb-tp-footer-btn--clear"
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
 * 自定义时间选择器
 * 纯白浮层，双列滚动选择小时与分钟
 * v-model 绑定 HH:mm 字符串
 * @author xiangwei
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Clock, ChevronDown } from '@lucide/vue'

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
const hourListRef = ref<HTMLElement>()
const minuteListRef = ref<HTMLElement>()
const dropStyle = ref<Record<string, string>>({})

const wrapStyle = computed(() => {
    const style: Record<string, string> = {}
    if (props.width) style.width = props.width
    return style
})

// 解析 v-model 时间
const selectedHour = computed<number | null>(() => {
    if (!props.modelValue) return null
    const parts = /^(\d{2}):(\d{2})$/.exec(props.modelValue)
    return parts ? Number(parts[1]) : null
})

const selectedMinute = computed<number | null>(() => {
    if (!props.modelValue) return null
    const parts = /^(\d{2}):(\d{2})$/.exec(props.modelValue)
    return parts ? Number(parts[2]) : null
})

function emitTime(hour: number, minute: number): void {
    emit('update:modelValue', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
}

function selectHour(hour: number): void {
    const minute = selectedMinute.value ?? 0
    emitTime(hour, minute)
}

function selectMinute(minute: number): void {
    const hour = selectedHour.value ?? 0
    emitTime(hour, minute)
}

function selectNow(): void {
    const now = new Date()
    emitTime(now.getHours(), now.getMinutes())
}

/** 清空已选时间 */
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
    const rect = wrapRef.value.getBoundingClientRect()
    const dropWidth = 168
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
        // 滚动到选中项
        nextTick(() => scrollToSelected())
    })
}

/** 滚动两个列到当前选中位置 */
function scrollToSelected(): void {
    const itemHeight = 32
    if (selectedHour.value !== null && hourListRef.value) {
        hourListRef.value.scrollTop = selectedHour.value * itemHeight
    }
    if (selectedMinute.value !== null && minuteListRef.value) {
        minuteListRef.value.scrollTop = selectedMinute.value * itemHeight
    }
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

// 面板打开时滚动到选中项
watch(open, (val) => {
    if (val) nextTick(() => scrollToSelected())
})

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
.bb-timepicker {
    position: relative;
    width: 100%;
}
.bb-timepicker-trigger {
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
.bb-timepicker--sm .bb-timepicker-trigger {
    padding: 5px 10px;
    font-size: 13px;
    min-height: 32px;
}
.bb-timepicker-trigger:hover {
    border-color: var(--bb-accent);
}
.bb-timepicker-icon {
    color: var(--bb-accent);
    flex-shrink: 0;
}
.bb-timepicker-text {
    flex: 1;
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-variant-numeric: tabular-nums;
}
.bb-timepicker-ph {
    flex: 1;
    color: var(--bb-text-tertiary);
}
.bb-timepicker-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
    transition: transform 0.2s;
}
.bb-timepicker-arrow.rotated {
    transform: rotate(180deg);
}

/* 下拉浮层 */
.bb-timepicker-dropdown {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 12px;
    box-shadow: var(--bb-shadow-lg);
    padding: 12px;
    user-select: none;
}

/* 双列布局 */
.bb-tp-columns {
    display: flex;
    gap: 8px;
}
.bb-tp-col {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.bb-tp-col-header {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--bb-text-tertiary);
    padding: 4px 0;
    border-bottom: 1px solid var(--bb-border-light);
    margin-bottom: 4px;
}
.bb-tp-col-list {
    max-height: 224px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--bb-border) transparent;
}
.bb-tp-col-list::-webkit-scrollbar {
    width: 4px;
}
.bb-tp-col-list::-webkit-scrollbar-thumb {
    background: var(--bb-border);
    border-radius: 2px;
}

/* 时间项 */
.bb-tp-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-primary);
    font-size: 13px;
    font-family: var(--bb-font-mono);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all 0.1s ease;
}
.bb-tp-item:hover {
    background: var(--bb-bg-hover);
}
.bb-tp-item--selected {
    background: var(--bb-accent);
    color: #fff;
    font-weight: 600;
}
.bb-tp-item--selected:hover {
    background: var(--bb-accent-hover);
}

/* 底部操作 */
.bb-tp-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--bb-border);
}
.bb-tp-footer-btn {
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
.bb-tp-footer-btn:hover {
    background: var(--bb-accent-light);
}
.bb-tp-footer-btn--clear {
    color: var(--bb-text-tertiary);
}
.bb-tp-footer-btn--clear:hover {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

/* 复用 BbDatePicker 的弹出动效 */
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
