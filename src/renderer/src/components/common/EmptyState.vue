<template>
    <div class="bb-empty">
        <component :is="icon" v-if="icon" :size="40" />
        <span>{{ text }}</span>
        <span v-if="hint" class="bb-empty-hint">{{ hint }}</span>
    </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

/**
 * 统一空状态占位组件
 * @author xiangwei
 */
defineProps<{
    icon?: Component
    text: string
    hint?: string
}>()
</script>

<style scoped>
.bb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 48px 0;
    color: var(--bb-text-tertiary);
    font-size: 14px;
}
.bb-empty-hint {
    font-size: 12px;
    color: var(--bb-text-disabled);
}
</style>
