<template>
    <div
        ref="wrapRef"
        class="bb-select"
        :class="{ 'bb-select--sm': size === 'sm', 'bb-select--disabled': disabled }"
        :style="wrapStyle"
    >
        <div class="bb-select-trigger" @click="toggle">
            <span v-if="selectedLabel" class="bb-select-text">{{ selectedLabel }}</span>
            <span v-else class="bb-select-ph">{{ placeholder || '请选择' }}</span>
            <ChevronDown
                :size="size === 'sm' ? 13 : 14"
                class="bb-select-arrow"
                :class="{ rotated: open }"
            />
        </div>
        <teleport to="body">
            <transition name="bb-pop">
                <div v-if="open" class="bb-select-dropdown" :style="dropStyle">
                    <div v-if="!options.length" class="bb-select-empty">暂无选项</div>
                    <button
                        v-for="opt in options"
                        :key="String(opt.value)"
                        class="bb-select-item"
                        :class="{ active: modelValue === opt.value, disabled: opt.disabled }"
                        :disabled="opt.disabled"
                        @click="select(opt)"
                    >
                        {{ opt.label }}
                    </button>
                </div>
            </transition>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown } from '@lucide/vue'

export interface BbSelectOption {
    value: string | number
    label: string
    disabled?: boolean
}

const props = defineProps<{
    modelValue?: string | number
    options: BbSelectOption[]
    placeholder?: string
    disabled?: boolean
    size?: 'default' | 'sm'
    width?: string
}>()

const emit = defineEmits<{
    'update:modelValue': [v: string | number]
    change: [v: string | number]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement>()
const dropStyle = ref<Record<string, string>>({})

const wrapStyle = computed(() => {
    const style: Record<string, string> = {}
    if (props.width) style.width = props.width
    return style
})

const selectedLabel = computed(() => {
    const opt = props.options.find((o) => o.value === props.modelValue)
    return opt?.label || ''
})

function select(opt: BbSelectOption): void {
    if (opt.disabled) return
    open.value = false
    if (opt.value !== props.modelValue) {
        emit('update:modelValue', opt.value)
        emit('change', opt.value)
    }
}

function toggle(): void {
    if (props.disabled) return
    open.value = !open.value
    if (open.value) updatePos()
}

function updatePos(): void {
    if (!wrapRef.value) return
    const rect = wrapRef.value.getBoundingClientRect()
    dropStyle.value = {
        position: 'fixed',
        top: rect.bottom + 4 + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        zIndex: '2000'
    }
}

function handleClick(e: MouseEvent): void {
    if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
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
.bb-select {
    position: relative;
    display: inline-block;
    min-width: 120px;
    width: 100%;
}
.bb-select--sm {
    min-width: 80px;
}
.bb-select--disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.bb-select-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
    color: var(--bb-text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
    min-height: 38px;
}
.bb-select--sm .bb-select-trigger {
    padding: 5px 10px;
    font-size: 13px;
    min-height: 32px;
}
.bb-select--disabled .bb-select-trigger {
    cursor: not-allowed;
}
.bb-select-trigger:hover {
    border-color: var(--bb-accent);
}
.bb-select-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.bb-select-ph {
    flex: 1;
    color: var(--bb-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.bb-select-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
    transition: transform 0.2s;
}
.bb-select-arrow.rotated {
    transform: rotate(180deg);
}

.bb-select-dropdown {
    display: flex;
    flex-direction: column;
    max-height: 240px;
    overflow-y: auto;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    padding: 4px;
}
.bb-select-item {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-primary);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
}
.bb-select-item:hover:not(.disabled):not(.active) {
    background: var(--bb-bg-hover);
}
.bb-select-item.active {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-medium);
}
.bb-select-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.bb-select-empty {
    padding: 20px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--bb-text-tertiary);
}

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
