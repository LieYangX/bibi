<template>
    <div class="bb-tabs">
        <div class="bb-tabs-nav" role="tablist">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="bb-tab"
                :class="{ active: activeKey === tab.key }"
                @click="select(tab.key)"
            >
                {{ tab.title }}
            </button>
        </div>
        <div class="bb-tabs-content">
            <slot :active-key="activeKey" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, provide, type Ref } from 'vue'

const props = defineProps<{ activeKey?: string }>()
const emit = defineEmits<{ 'update:activeKey': [v: string] }>()

const tabs = ref<{ key: string; title: string }[]>([])
const activeKey = ref(props.activeKey || '')

provide('bb-tabs', { tabs, activeKey } as {
    tabs: Ref<{ key: string; title: string }[]>
    activeKey: Ref<string>
})

function select(key: string): void {
    activeKey.value = key
    emit('update:activeKey', key)
}
</script>

<style scoped>
.bb-tabs-nav {
    display: flex;
    gap: 2px;
    margin-bottom: 24px;
    background: var(--bb-bg-input);
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    padding: 3px;
}
.bb-tab {
    flex: 1;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
    outline: none;
    text-align: center;
}
.bb-tab.active {
    background: var(--bb-bg-elevated);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-sm);
}
.bb-tabs-content {
    min-height: 100px;
}
</style>
