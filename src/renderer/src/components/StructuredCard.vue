<template>
    <div class="bb-structured-card">
        <div v-if="data.title" class="bb-structured-card__title">{{ data.title }}</div>
        <div class="bb-structured-card__body">
            <div
                v-for="(field, index) in data.fields"
                :key="index"
                class="bb-structured-card__field"
            >
                <span class="bb-structured-card__label">{{ field.label }}</span>
                <span
                    class="bb-structured-card__value"
                    :class="{
                        'bb-structured-card__value--positive': field.color === 'positive',
                        'bb-structured-card__value--negative': field.color === 'negative'
                    }"
                >
                    {{ field.value }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { StructuredCardData } from '@shared/types'

defineProps<{
    data: StructuredCardData
}>()
</script>

<style scoped>
.bb-structured-card {
    margin: 8px 0;
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    overflow: hidden;
    background: var(--bb-bg-card);
}
.bb-structured-card__title {
    padding: 10px 14px 6px;
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    border-bottom: 1px solid var(--bb-border-light);
}
.bb-structured-card__body {
    display: flex;
    flex-direction: column;
    gap: 0;
}
.bb-structured-card__field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
}
.bb-structured-card__field:not(:last-child) {
    border-bottom: 1px solid var(--bb-border-light);
}
.bb-structured-card__label {
    font-size: 13px;
    color: var(--bb-text-secondary);
}
.bb-structured-card__value {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    font-variant-numeric: tabular-nums;
}
.bb-structured-card__value--positive {
    color: var(--bb-success, #16a34a);
}
.bb-structured-card__value--negative {
    color: var(--bb-danger, #e53e3e);
}
</style>
