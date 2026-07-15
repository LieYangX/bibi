<template>
    <div class="window-controls" style="-webkit-app-region: no-drag">
        <button
            class="win-btn"
            :class="{ 'win-btn--min': true }"
            title="最小化"
            @click="handleMinimize"
        >
            <svg class="win-icon" viewBox="0 0 16 16" aria-hidden="true">
                <line
                    x1="3"
                    y1="8"
                    x2="13"
                    y2="8"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                />
            </svg>
        </button>
        <button
            class="win-btn"
            :class="{ 'win-btn--max': true }"
            :title="isMaximized ? '还原' : '最大化'"
            @click="handleMaximize"
        >
            <svg v-if="!isMaximized" class="win-icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect
                    x="2.5"
                    y="2.5"
                    width="11"
                    height="11"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                />
            </svg>
            <svg v-else class="win-icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect
                    x="4"
                    y="0.5"
                    width="10"
                    height="10"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                />
                <rect
                    x="1.5"
                    y="4"
                    width="9"
                    height="10"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                />
            </svg>
        </button>
        <button class="win-btn win-btn--close" title="关闭" @click="handleClose">
            <svg class="win-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                />
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { desktopApi } from '../api/desktop-api'
import { observeMaximizeState } from './window-maximize-state'

/**
 * 窗口最大化状态
 */
const isMaximized = ref(false)
let stopMaximizeListener: (() => void) | undefined

/**
 * 组件挂载后同步窗口最大化状态并监听变化
 */
onMounted(() => {
    stopMaximizeListener = observeMaximizeState(
        {
            getCurrent: async () => {
                const result = await desktopApi.window.isMaximized()
                return result.ok ? result.data : undefined
            },
            subscribe: (listener) => desktopApi.window.onMaximizeChange(listener)
        },
        (maximized) => {
            isMaximized.value = maximized
        }
    )
})

onUnmounted(() => {
    stopMaximizeListener?.()
    stopMaximizeListener = undefined
})

/**
 * 最小化窗口
 */
function handleMinimize(): void {
    desktopApi.window.minimize()
}

/**
 * 最大化/还原窗口
 */
function handleMaximize(): void {
    desktopApi.window.maximize()
}

/**
 * 关闭窗口
 */
function handleClose(): void {
    desktopApi.window.close()
}
</script>

<style scoped>
.window-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 100%;
    padding: 0 8px;
}

.win-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 26px;
    border: none;
    border-radius: var(--bb-radius-sm);
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    outline: none;
    transition:
        background var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease),
        transform var(--bb-duration-fast) var(--bb-ease);
}

.win-btn:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-secondary);
}

.win-btn:active {
    transform: scale(0.94);
}

.win-btn--close:hover {
    background: var(--bb-danger);
    color: #fff;
}

.win-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}
</style>
