<template>
    <div class="bb-tool-result">
        <template v-if="tools?.length">
            <div
                v-for="(tool, index) in tools"
                :key="`${tool.toolName}-${index}`"
                class="bb-tool-result__section"
            >
                <span class="bb-tool-result__label">{{ tool.toolName || '工具结果' }}</span>
                <pre class="bb-tool-result__code">{{ tool.content }}</pre>
            </div>
        </template>
        <template v-else>
            <div v-if="toolArgs" class="bb-tool-result__section">
                <span class="bb-tool-result__label">参数</span>
                <pre class="bb-tool-result__code">{{ toolArgs }}</pre>
            </div>
            <div class="bb-tool-result__section">
                <span class="bb-tool-result__label">结果</span>
                <pre class="bb-tool-result__code">{{ content }}</pre>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * 工具调用结果详情
 * 仅在用户主动展开工具消息时挂载，避免默认创建大文本 DOM。
 *
 * @author xiangwei
 */

defineProps<{
    content: string
    toolArgs?: string
    tools?: Array<{ toolName?: string; content: string }>
}>()
</script>

<style scoped>
.bb-tool-result {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 12px 12px;
}

.bb-tool-result__section {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
}

.bb-tool-result__label {
    color: var(--bb-text-tertiary);
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
    letter-spacing: 0;
    text-transform: uppercase;
}

.bb-tool-result__code {
    max-height: 200px;
    margin: 0;
    overflow: auto;
    padding: 8px 10px;
    border-radius: 4px;
    background: var(--bb-bg-page);
    color: var(--bb-text-secondary);
    font-family: var(--bb-font-mono);
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    user-select: text;
    white-space: pre-wrap;
}
</style>
