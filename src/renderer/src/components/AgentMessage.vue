<template>
    <!-- 用户消息 -->
    <div v-if="message.role === 'user'" class="bb-msg bb-msg--user">
        <div
            class="bb-msg__avatar bb-msg__avatar--user"
            :style="{ backgroundColor: userStore.userColor }"
        >
            {{ userStore.userInitial }}
        </div>
        <div class="bb-msg__body">
            <div class="bb-msg__content bb-msg__content--user">{{ message.content }}</div>
        </div>
    </div>

    <!-- 工具调用消息 -->
    <div v-else-if="message.role === 'tool'" class="bb-msg bb-msg--tool">
        <div class="bb-msg__avatar bb-msg__avatar--ai">
            <img class="bb-msg__logo" src="../assets/app-icon.png" alt="笔笔" />
        </div>
        <div class="bb-msg__body">
            <div class="bb-tool-card">
                <button
                    class="bb-tool-card__toggle"
                    :aria-expanded="showTool"
                    @click="showTool = !showTool"
                >
                    <span class="bb-tool-card__name">使用{{ message.toolName || '工具' }}</span>
                    <ChevronDown
                        :size="14"
                        class="bb-tool-card__chev"
                        :class="{ open: showTool }"
                    />
                </button>
                <ToolResultDetail
                    v-if="showTool"
                    :content="message.content"
                    :tool-args="message.toolArgs"
                />
            </div>
        </div>
    </div>

    <!-- 连续工具调用分组 -->
    <div v-else-if="message.role === 'tool-group'" class="bb-msg bb-msg--tool">
        <div class="bb-msg__avatar bb-msg__avatar--ai">
            <img class="bb-msg__logo" src="../assets/app-icon.png" alt="笔笔" />
        </div>
        <div class="bb-msg__body">
            <div class="bb-tool-card">
                <button
                    class="bb-tool-card__toggle"
                    :aria-expanded="showTool"
                    @click="showTool = !showTool"
                >
                    <span class="bb-tool-card__name">使用{{ message.toolName || '工具' }}</span>
                    <span class="bb-tool-card__count">{{ message.tools?.length ?? 0 }} 个工具</span>
                    <ChevronDown
                        :size="14"
                        class="bb-tool-card__chev"
                        :class="{ open: showTool }"
                    />
                </button>
                <ToolResultDetail
                    v-if="showTool"
                    :content="message.content"
                    :tools="message.tools"
                />
            </div>
        </div>
    </div>

    <!-- AI 回复消息 -->
    <div v-else class="bb-msg bb-msg--ai">
        <div class="bb-msg__avatar bb-msg__avatar--ai">
            <img class="bb-msg__logo" src="../assets/app-icon.png" alt="笔笔" />
        </div>
        <div class="bb-msg__body">
            <!-- 深度思考内容（可折叠） -->
            <div v-if="message.thinking" class="bb-msg__thinking-block">
                <button class="bb-msg__think-head" @click="showThinking = !showThinking">
                    <BrainCircuit :size="14" />
                    <span>深度思考</span>
                    <span v-if="thinkingDurationText" class="bb-msg__think-duration">
                        {{ thinkingDurationText }}
                    </span>
                    <ChevronDown :size="13" :class="{ rotated: showThinking }" />
                </button>
                <div v-if="showThinking" class="bb-msg__think-body">{{ message.thinking }}</div>
            </div>
            <div v-if="message.content" class="bb-msg__content bb-msg__content--ai">
                <MarkdownContent :content="message.content" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { ChevronDown, BrainCircuit } from '@lucide/vue'
import { useUserStore } from '../stores/user.store'
import MarkdownContent from './MarkdownContent.vue'

const ToolResultDetail = defineAsyncComponent(() => import('./ToolResultDetail.vue'))

const props = defineProps<{
    message: {
        id: string
        role: string
        content: string
        toolName?: string
        toolArgs?: string
        isStreaming?: boolean
        thinking?: string
        thinkingDurationMs?: number
        tools?: Array<{ toolName?: string; content: string }>
    }
}>()

const userStore = useUserStore()
const showTool = ref(false)
const showThinking = ref(false)
const thinkingDurationText = computed(() =>
    formatThinkingDuration(props.message.thinkingDurationMs)
)

const SECOND_IN_MS = 1_000
const SECONDS_PER_MINUTE = 60

/**
 * 格式化模型思考耗时
 *
 * @param durationMs 思考耗时，单位为毫秒
 * @returns 紧凑的中文耗时文案
 * @author xiangwei
 */
function formatThinkingDuration(durationMs?: number): string {
    if (!durationMs || durationMs <= 0) return ''
    const seconds = durationMs / SECOND_IN_MS
    if (seconds < 1) return '用时 < 1 秒'
    if (seconds < 10) return `用时 ${seconds.toFixed(1)} 秒`
    if (seconds < SECONDS_PER_MINUTE) return `用时 ${Math.round(seconds)} 秒`

    const roundedSeconds = Math.round(seconds)
    const minutes = Math.floor(roundedSeconds / SECONDS_PER_MINUTE)
    const remainingSeconds = roundedSeconds % SECONDS_PER_MINUTE
    return `用时 ${minutes} 分 ${remainingSeconds} 秒`
}
</script>

<style scoped>
/* ===== 基础布局 ===== */
.bb-msg {
    display: flex;
    gap: 10px;
    max-width: 80%;
    margin-bottom: 14px;
}
.bb-msg--user {
    flex-direction: row-reverse;
    margin-left: auto;
}
.bb-msg--ai {
    margin-right: auto;
}
.bb-msg--tool {
    margin-right: auto;
    max-width: 70%;
    opacity: 0.9;
}

.bb-msg__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
}
/* 用户头像：复用侧栏 bb-avatar 风格 */
.bb-msg__avatar--user {
    color: #fff;
    font-weight: var(--bb-weight-semibold);
}
/* AI 头像：应用 Logo */
.bb-msg__avatar--ai {
    background: var(--bb-bg-card);
    overflow: hidden;
}
.bb-msg__logo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.3);
}
/* 工具头像：信息色 */
.bb-msg__avatar--tool {
    background: var(--bb-info-light);
    color: var(--bb-info);
}

.bb-msg__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

/* ===== 消息气泡 ===== */
.bb-msg__content {
    padding: 11px 15px;
    border-radius: var(--bb-radius-md);
    font-size: 14px;
    line-height: 1.7;
    word-break: break-word;
    user-select: text;
}
.bb-msg__content--ai {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    color: var(--bb-text-primary);
}
.bb-msg__content--user {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
}

/* ===== 深度思考 ===== */
.bb-msg__thinking-block {
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    overflow: hidden;
}
.bb-msg__think-head {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: var(--bb-bg-input);
    color: var(--bb-text-secondary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: background 0.15s var(--bb-ease);
    font-family: var(--bb-font);
}
.bb-msg__think-head:hover {
    background: var(--bb-bg-hover);
}
.bb-msg__think-duration {
    color: var(--bb-text-tertiary);
    font-weight: var(--bb-weight-normal);
    font-variant-numeric: tabular-nums;
}
.bb-msg__think-head .rotated {
    transform: rotate(180deg);
}
.bb-msg__think-head svg:last-child {
    margin-left: auto;
    transition: transform 0.15s var(--bb-ease);
}
.bb-msg__think-body {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--bb-text-secondary);
    background: var(--bb-bg-page);
    white-space: pre-wrap;
    line-height: 1.6;
    max-height: 300px;
    overflow-y: auto;
    user-select: text;
}

/* ===== Markdown 渲染 ===== */
.bb-msg__streaming-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bb-accent);
    animation: dotPulse 1.2s infinite ease-in-out;
    align-self: flex-start;
    margin-left: 4px;
}
@keyframes dotPulse {
    0%,
    100% {
        opacity: 0.3;
        transform: scale(0.7);
    }
    50% {
        opacity: 1;
        transform: scale(1);
    }
}

/* ===== Markdown 渲染 ===== */
.bb-msg__content--ai :deep(h2) {
    font-size: 15px;
    margin: 10px 0 6px;
    color: var(--bb-text-primary);
}
.bb-msg__content--ai :deep(h3) {
    font-size: 14px;
    margin: 8px 0 4px;
}
.bb-msg__content--ai :deep(strong) {
    color: var(--bb-accent);
}
.bb-msg__content--ai :deep(ul),
.bb-msg__content--ai :deep(ol) {
    padding-left: 18px;
    margin: 4px 0;
}
.bb-msg__content--ai :deep(li) {
    padding: 1px 0;
}
.bb-msg__content--ai :deep(code) {
    background: var(--bb-bg-input);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 13px;
    font-family: var(--bb-font-mono);
}
.bb-msg__content--ai :deep(pre) {
    background: var(--bb-bg-input);
    padding: 10px 14px;
    border-radius: var(--bb-radius-sm);
    font-size: 12px;
    font-family: var(--bb-font-mono);
    overflow-x: auto;
    margin: 8px 0;
}
.bb-msg__content--ai :deep(pre code) {
    background: none;
    padding: 0;
}

/* ===== 工具卡片 ===== */
.bb-tool-card {
    display: block;
    width: 100%;
    border: 1px solid var(--bb-border-light);
    border-left: 3px solid var(--bb-info);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-card);
    overflow: hidden;
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
}
.bb-tool-card:hover {
    border-color: var(--bb-info);
    border-left-color: var(--bb-info);
}

.bb-tool-card__toggle {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 0;
    background: transparent;
    cursor: pointer;
    font-family: var(--bb-font);
    text-align: left;
}
.bb-tool-card__name {
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-info);
    font-family: var(--bb-font-mono);
}
.bb-tool-card__count {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--bb-bg-input);
    color: var(--bb-text-tertiary);
    margin-left: auto;
}
.bb-tool-card__chev {
    flex-shrink: 0;
    color: var(--bb-text-tertiary);
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.bb-tool-card__chev.open {
    transform: rotate(180deg);
}
</style>
