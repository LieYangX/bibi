<template>
    <span class="bb-amount" :class="{ 'is-masking': isMasked }">
        <span class="bb-amount__text">
            {{ sign ? `${sign}${prefix}${displayValue}` : `${prefix}${displayValue}` }}
        </span>
        <button
            v-if="!isControlled && amountMaskEnabled"
            class="bb-amount__eye"
            type="button"
            @click.stop="toggleShow"
        >
            <Eye v-if="showReal" :size="eyeSize" />
            <EyeOff v-else :size="eyeSize" />
        </button>
    </span>
</template>

<script setup lang="ts">
/**
 * 通用金额显示组件
 * 支持全局脱敏开关与组件级小眼睛切换
 * - 未传入 masked 时：跟随全局 settingStore.amountMaskEnabled，每个实例独立切换
 * - 传入 masked 时：由外部受控，不再显示小眼睛按钮
 * @author xiangwei
 */

import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '../../stores/setting.store'
import { centsToYuan, formatYuan } from '../../utils/format'
import { Eye, EyeOff } from '@lucide/vue'

const props = withDefaults(
    defineProps<{
        /** 金额（单位：分） */
        value: number
        /** 前缀符号，默认 ¥ */
        prefix?: string
        /** 正负号：+、- 或不传 */
        sign?: string
        /** 是否使用千分位格式化 */
        useLocale?: boolean
        /** 小眼睛图标尺寸 */
        eyeSize?: number
        /** 外部受控脱敏状态：传入时由外部决定是否脱敏，组件不再显示小眼睛 */
        masked?: boolean
    }>(),
    {
        prefix: '¥',
        useLocale: false,
        eyeSize: 14,
        masked: undefined
    }
)

const settingStore = useSettingStore()
const { amountMaskEnabled } = storeToRefs(settingStore)

/** 是否由外部受控脱敏（传入 masked prop 即视为受控模式） */
const isControlled = computed(() => props.masked !== undefined)

/** 组件级临时覆盖：null 表示跟随全局设置 */
const localShowReal = ref<boolean | null>(null)

/** 全局脱敏开关变化时，重置组件级临时覆盖 */
watch(amountMaskEnabled, () => {
    localShowReal.value = null
})

/** 当前组件是否显示真实金额 */
const showReal = computed(() => {
    if (isControlled.value) return !(props.masked as boolean)
    if (localShowReal.value !== null) return localShowReal.value
    return !amountMaskEnabled.value
})

/** 脱敏后的占位文本 */
const maskedText = '****'

/** 当前是否处于脱敏显示状态 */
const isMasked = computed(() => {
    if (isControlled.value) {
        return props.masked === true
    }
    return amountMaskEnabled.value && !showReal.value
})

/** 实际显示的金额文本 */
const displayValue = computed(() => {
    if (isMasked.value) {
        return maskedText
    }
    const yuan = (props.value || 0) / 100
    return props.useLocale ? formatYuan(yuan) : centsToYuan(props.value || 0)
})

function toggleShow(): void {
    localShowReal.value = !showReal.value
}
</script>

<style scoped>
.bb-amount {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.bb-amount__eye {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    border-radius: 4px;
    transition:
        color var(--bb-duration-fast) var(--bb-ease),
        background var(--bb-duration-fast) var(--bb-ease);
    line-height: 1;
}
.bb-amount__eye:hover {
    color: var(--bb-accent);
    background: var(--bb-bg-hover);
}
.bb-amount__text {
    /* 保持金额前缀与数字在同一行，避免 ¥ 后换行 */
    white-space: nowrap;
}
.bb-amount.is-masking .bb-amount__text {
    letter-spacing: 0.05em;
}
</style>
