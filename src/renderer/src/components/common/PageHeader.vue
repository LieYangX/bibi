<template>
    <div class="page-header">
        <div class="page-header__left">
            <h2 class="page-title">{{ title }}</h2>
            <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
        </div>
        <div class="page-header__right">
            <slot name="actions" />
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 统一页面标题头
 * 各视图通过 slot#actions 放置顶部操作按钮，保证布局一致
 * @author xiangwei
 */
defineProps<{
    title: string
    subtitle?: string
}>()
</script>

<style scoped>
.page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
}
.page-header__left {
    min-width: 0;
}
.page-title {
    font-size: 22px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
    letter-spacing: -0.01em;
    margin: 0;
}
.page-subtitle {
    font-size: 13px;
    color: var(--bb-text-tertiary);
    margin-top: 4px;
}
.page-header__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}
</style>
