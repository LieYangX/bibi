<template>
    <div ref="wrapRef" class="bb-cascader">
        <div class="bb-cascader-trigger" @click="toggle">
            <span v-if="displayText" class="bb-cascader-text">{{ displayText }}</span>
            <span v-else class="bb-cascader-ph">{{ placeholder }}</span>
            <ChevronDown :size="14" class="bb-cascader-arrow" :class="{ rotated: open }" />
        </div>
        <teleport to="body">
            <transition name="bb-pop">
                <div v-if="open" ref="dropdownRef" class="bb-cascader-dropdown" :style="dropStyle">
                    <div class="bb-cascader-col">
                        <div v-if="!options.length" class="bb-cascader-empty">暂无分类</div>
                        <button
                            v-for="cat in options"
                            :key="cat.value"
                            class="bb-cascader-item"
                            :class="{ active: selectedCat === cat.value }"
                            @click="selectCat(cat)"
                        >
                            <span>{{ cat.label }}</span>
                            <ChevronRight
                                v-if="cat.children?.length"
                                :size="14"
                                class="bb-cascader-sub-arrow"
                            />
                        </button>
                    </div>
                    <div v-if="subOptions.length" class="bb-cascader-col bb-cascader-col--sub">
                        <button
                            v-if="allowParentSelection"
                            class="bb-cascader-item bb-cascader-parent-option"
                            :class="{
                                active: modelValue?.length === 1 && modelValue[0] === selectedCat
                            }"
                            @click="selectParent"
                        >
                            <span>{{ selectedOption?.label }}</span>
                            <span class="bb-cascader-level">一级</span>
                        </button>
                        <button
                            v-for="sub in subOptions"
                            :key="sub.value"
                            class="bb-cascader-item"
                            :class="{ active: modelValue?.[1] === sub.value }"
                            @click="selectSub(sub)"
                        >
                            {{ sub.label }}
                        </button>
                    </div>
                </div>
            </transition>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'

interface CascaderChildOption {
    value: string
    label: string
}

interface CascaderOption extends CascaderChildOption {
    children?: CascaderChildOption[]
}

const props = defineProps<{
    modelValue?: string[]
    options: CascaderOption[]
    placeholder?: string
    allowParentSelection?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string[]] }>()

const open = ref(false)
const selectedCat = ref('')
const wrapRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()
const dropStyle = ref<Record<string, string>>({})

// 选项列表切换时（如支出↔收入），重置已选中的一级分类
watch(
    () => props.options,
    () => {
        selectedCat.value = ''
    }
)

const selectedOption = computed(() =>
    props.options.find((option) => option.value === selectedCat.value)
)
const subOptions = computed<CascaderChildOption[]>(() => selectedOption.value?.children || [])

const displayText = computed<string>(() => {
    if (!props.modelValue?.length) return ''
    const cat = props.options.find((o) => o.value === props.modelValue![0])
    if (!cat) return ''
    if (props.modelValue!.length > 1) {
        const sub = cat.children?.find((s) => s.value === props.modelValue![1])
        return cat.label + ' / ' + (sub?.label || '')
    }
    return cat.label
})

function selectCat(cat: CascaderOption): void {
    selectedCat.value = cat.value
    if (!cat.children?.length) {
        emit('update:modelValue', [cat.value])
        open.value = false
    }
}

function selectSub(sub: CascaderChildOption): void {
    emit('update:modelValue', [selectedCat.value, sub.value])
    open.value = false
}

function selectParent(): void {
    if (!props.allowParentSelection || !selectedCat.value) return
    emit('update:modelValue', [selectedCat.value])
    open.value = false
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
    // 第一阶段：先固定到下方让面板渲染出来
    dropStyle.value = {
        position: 'fixed',
        top: rect.bottom + 4 + 'px',
        left: Math.max(8, rect.left) + 'px',
        width: Math.max(rect.width, 240) + 'px',
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
            // 下方空间足够，或下方比上方多 → 向下展开
            top = rect.bottom + 4
        } else {
            // 上方空间更足 → 向上展开，间距恰好 4px
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

onMounted(() => {
    document.addEventListener('click', handleClick)
})
onUnmounted(() => {
    document.removeEventListener('click', handleClick)
})
</script>

<style scoped>
.bb-cascader {
    position: relative;
}
.bb-cascader-trigger {
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
.bb-cascader-trigger:hover {
    border-color: var(--bb-accent);
}
.bb-cascader-text {
    font-size: 14px;
    color: var(--bb-text-primary);
    flex: 1;
}
.bb-cascader-ph {
    font-size: 14px;
    color: var(--bb-text-tertiary);
    flex: 1;
}
.bb-cascader-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
    transition: transform 0.2s;
}
.bb-cascader-arrow.rotated {
    transform: rotate(180deg);
}

.bb-cascader-dropdown {
    display: flex;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    box-shadow: var(--bb-shadow-lg);
    overflow: hidden;
}
.bb-cascader-col {
    flex: 1 1 auto;
    min-width: 90px;
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
    white-space: nowrap;
}
.bb-cascader-col--sub {
    border-left: 1px solid var(--bb-border);
    background: var(--bb-bg-hover);
}
.bb-cascader-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-primary);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
}
.bb-cascader-item:hover {
    background: var(--bb-bg-hover);
}
.bb-cascader-item.active {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
    font-weight: 500;
}
.bb-cascader-parent-option {
    margin-bottom: 4px;
    border-bottom: 1px solid var(--bb-border);
    border-radius: 6px 6px 2px 2px;
}
.bb-cascader-level {
    flex-shrink: 0;
    color: var(--bb-text-tertiary);
    font-size: 11px;
    font-weight: var(--bb-weight-normal);
}
.bb-cascader-parent-option.active .bb-cascader-level {
    color: var(--bb-accent-text);
}
.bb-cascader-sub-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
}
.bb-cascader-empty {
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
