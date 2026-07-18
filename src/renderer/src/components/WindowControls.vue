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

        <BbModal
            :visible="showCloseConfirm"
            title="退出确认"
            width="360px"
            @update:visible="showCloseConfirm = $event"
            @close="handleCancelClose"
        >
            <div class="close-confirm-body">
                <p class="close-confirm-text">确定要退出笔笔吗？</p>
                <label class="close-confirm-option">
                    <input v-model="minimizeToTray" type="checkbox" />
                    <span class="check-visual"></span>
                    <span>最小化到系统托盘，不退出程序</span>
                </label>
            </div>
            <template #footer>
                <button class="bb-btn" @click="handleCancelClose">取消</button>
                <button class="bb-btn bb-btn-primary" @click="handleConfirmClose">确定</button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { desktopApi } from '../api/desktop-api'
import { observeMaximizeState } from './window-maximize-state'
import { BbModal } from './ui'

/**
 * 窗口最大化状态
 */
const isMaximized = ref(false)
let stopMaximizeListener: (() => void) | undefined

/**
 * 是否显示关闭确认弹窗
 */
const showCloseConfirm = ref(false)

/**
 * 弹窗中"最小化到系统托盘"勾选框的当前值
 */
const minimizeToTray = ref(false)

/**
 * 从 session 读取的上次保存的选择
 * 用于打开弹窗时恢复显示，避免取消操作污染下次显示
 */
const savedMinimizeToTray = ref(false)

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
    // 读取 session 中保存的最小化偏好，作为弹窗初始勾选状态
    void loadMinimizePreference()
})

onUnmounted(() => {
    stopMaximizeListener?.()
    stopMaximizeListener = undefined
})

/**
 * 从主进程加载上次保存的最小化偏好
 */
async function loadMinimizePreference(): Promise<void> {
    const result = await desktopApi.window.getMinimizePreference()
    if (result.ok) {
        savedMinimizeToTray.value = result.data
        minimizeToTray.value = result.data
    }
}

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
 * 关闭窗口前显示确认弹窗
 * 打开时将勾选框恢复为上次保存的选择
 */
function handleClose(): void {
    minimizeToTray.value = savedMinimizeToTray.value
    showCloseConfirm.value = true
}

/**
 * 取消关闭
 * 不重置勾选框，下次打开时由 handleClose 恢复为上次保存的选择
 */
function handleCancelClose(): void {
    showCloseConfirm.value = false
}

/**
 * 确认关闭或最小化到托盘
 * 将当前勾选状态保存到 session，作为下次弹窗的初始状态
 */
async function handleConfirmClose(): Promise<void> {
    showCloseConfirm.value = false
    const preference = minimizeToTray.value
    // 更新本地缓存并持久化到 session
    savedMinimizeToTray.value = preference
    await desktopApi.window.setMinimizePreference(preference)
    if (preference) {
        desktopApi.window.minimizeToTray()
    } else {
        desktopApi.window.close()
    }
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

.close-confirm-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.close-confirm-text {
    margin: 0;
    font-size: 14px;
    color: var(--bb-text-primary);
    line-height: 1.6;
}

.close-confirm-option {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--bb-text-secondary);
    user-select: none;
}

.close-confirm-option input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
}

.close-confirm-option .check-visual {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--bb-border);
    border-radius: 3px;
    background: var(--bb-bg-card);
    flex-shrink: 0;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.close-confirm-option input:checked + .check-visual {
    background: var(--bb-accent);
    border-color: var(--bb-accent);
}

.close-confirm-option input:checked + .check-visual::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    display: block;
}
</style>
