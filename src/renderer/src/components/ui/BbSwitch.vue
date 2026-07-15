<template>
    <button
        class="bb-switch"
        :class="{ 'is-checked': modelValue, 'is-disabled': disabled }"
        type="button"
        role="switch"
        :aria-checked="modelValue"
        :disabled="disabled"
        @click="toggle"
    >
        <span class="bb-switch__track">
            <span class="bb-switch__thumb" />
        </span>
    </button>
</template>

<script setup lang="ts">
/**
 * 开关组件
 * @author xiangwei
 */

const props = defineProps<{
    modelValue: boolean
    disabled?: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [v: boolean]
    change: [v: boolean]
}>()

function toggle(): void {
    if (props.disabled) return
    const next = !props.modelValue
    emit('update:modelValue', next)
    emit('change', next)
}
</script>

<style scoped>
.bb-switch {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    line-height: 1;
}
.bb-switch__track {
    display: block;
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: var(--bb-border);
    position: relative;
    transition: background var(--bb-duration-fast) var(--bb-ease);
}
.bb-switch__thumb {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    position: absolute;
    top: 3px;
    left: 3px;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.bb-switch.is-checked .bb-switch__track {
    background: var(--bb-accent);
}
.bb-switch.is-checked .bb-switch__thumb {
    transform: translateX(20px);
}
.bb-switch.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
