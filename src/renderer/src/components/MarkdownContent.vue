<template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="md-body" v-html="sanitized" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderSafeMarkdown } from '../utils/markdown'

const props = defineProps<{
    content: string
}>()

const sanitized = computed(() => renderSafeMarkdown(props.content))
</script>

<style scoped>
.md-body {
    line-height: 1.75;
    word-break: break-word;
}
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
    margin: 16px 0 8px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
    line-height: 1.4;
}
.md-body :deep(h1) {
    font-size: 19px;
}
.md-body :deep(h2) {
    font-size: 17px;
}
.md-body :deep(h3) {
    font-size: 15px;
}
.md-body :deep(p) {
    margin: 6px 0;
}
.md-body :deep(strong) {
    color: var(--bb-accent-text);
}
.md-body :deep(em) {
    color: var(--bb-text-secondary);
}
.md-body :deep(ul),
.md-body :deep(ol) {
    padding-left: 20px;
    margin: 6px 0;
}
.md-body :deep(li) {
    margin: 2px 0;
}
.md-body :deep(code) {
    background: var(--bb-bg-input);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: var(--bb-font-mono);
    color: var(--bb-info);
}
.md-body :deep(pre) {
    background: var(--bb-bg-page);
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    padding: 12px 14px;
    margin: 10px 0;
    overflow-x: auto;
    line-height: 1.6;
}
.md-body :deep(pre code) {
    background: none;
    padding: 0;
    font-size: 12px;
    color: var(--bb-text-primary);
}
.md-body :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 13px;
}
.md-body :deep(th),
.md-body :deep(td) {
    padding: 8px 12px;
    border: 1px solid var(--bb-border-light);
    text-align: left;
}
.md-body :deep(th) {
    background: var(--bb-bg-input);
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.md-body :deep(td) {
    color: var(--bb-text-secondary);
}
.md-body :deep(tr:nth-child(even) td) {
    background: var(--bb-bg-hover);
}
.md-body :deep(blockquote) {
    border-left: 3px solid var(--bb-accent);
    padding: 6px 14px;
    margin: 10px 0;
    background: var(--bb-accent-soft);
    border-radius: 0 var(--bb-radius-sm) var(--bb-radius-sm) 0;
    color: var(--bb-text-secondary);
    font-style: italic;
}
.md-body :deep(hr) {
    border: none;
    border-top: 1px solid var(--bb-border-light);
    margin: 16px 0;
}
.md-body :deep(a) {
    color: var(--bb-accent);
    text-decoration: underline;
}
</style>
