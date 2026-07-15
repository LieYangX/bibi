<template>
    <div class="bb-alert" :class="'bb-alert--' + type">
        <div class="bb-alert-body">
            <div class="bb-alert-title">{{ title }}</div>
            <div v-if="$slots.default || content" class="bb-alert-content">
                <slot>{{ content }}</slot>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; type?: 'info' | 'success' | 'warning'; content?: string }>()
</script>

<style scoped>
.bb-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid;
}
.bb-alert--info {
    background: rgba(217, 164, 4, 0.06);
    border-color: rgba(217, 164, 4, 0.15);
}
.bb-alert--success {
    background: rgba(16, 185, 129, 0.06);
    border-color: rgba(16, 185, 129, 0.15);
}
.bb-alert--warning {
    background: rgba(245, 158, 11, 0.06);
    border-color: rgba(245, 158, 11, 0.15);
}
.bb-alert-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--bb-text-primary);
}
.bb-alert-content {
    margin-top: 4px;
    font-size: 13px;
    color: var(--bb-text-secondary);
}
</style>
