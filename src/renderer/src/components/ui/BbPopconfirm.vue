<template>
    <div class="bb-popconfirm-wrap" @click.stop>
        <div ref="triggerRef" style="display: inline-block" @click="show = !show">
            <slot name="reference" />
        </div>
        <teleport to="body">
            <transition name="bb-pop">
                <div v-if="show" class="bb-popconfirm" :style="posStyle" @click.stop>
                    <div class="bb-popconfirm__text">
                        <slot>{{ content }}</slot>
                    </div>
                    <div class="bb-popconfirm__actions">
                        <button class="bb-btn bb-btn-sm" @click="show = false">取消</button>
                        <button class="bb-btn bb-btn-sm bb-btn-primary" @click="confirm">
                            确定
                        </button>
                    </div>
                </div>
            </transition>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

defineProps<{ content?: string }>()
const emit = defineEmits<{ ok: [] }>()

const show = ref(false)
const triggerRef = ref<HTMLElement>()
const posStyle = ref({})

/** 弹窗固定宽度，与样式中的 .bb-popconfirm 保持一致 */
const POPOVER_WIDTH = 200
/** 弹窗距离视窗边缘的最小间距 */
const EDGE_PADDING = 8

function updatePos(): void {
    const el = triggerRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()

    // 默认以触发器中心为基准居中显示
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    // 同时限制左右边界，防止弹窗溢出视窗
    const maxLeft = window.innerWidth - POPOVER_WIDTH - EDGE_PADDING
    left = Math.max(EDGE_PADDING, Math.min(left, maxLeft))

    posStyle.value = {
        position: 'fixed',
        top: rect.bottom + 6 + 'px',
        left: left + 'px',
        zIndex: 2000
    }
}

function onViewportChange(): void {
    if (show.value) {
        show.value = false
    }
}

watch(show, (visible) => {
    if (visible) {
        nextTick(() => {
            requestAnimationFrame(updatePos)
        })
        window.addEventListener('scroll', onViewportChange, true)
        window.addEventListener('resize', onViewportChange)
    } else {
        window.removeEventListener('scroll', onViewportChange, true)
        window.removeEventListener('resize', onViewportChange)
    }
})

function confirm(): void {
    show.value = false
    emit('ok')
}

function handleClick(e: MouseEvent): void {
    const el = triggerRef.value
    if (el && !el.contains(e.target as Node) && show.value) {
        show.value = false
    }
}

onMounted(() => {
    updatePos()
    document.addEventListener('click', handleClick)
    window.addEventListener('resize', updatePos)
})
onUnmounted(() => {
    show.value = false
    document.removeEventListener('click', handleClick)
    window.removeEventListener('resize', updatePos)
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
})
</script>

<style scoped>
.bb-popconfirm-wrap {
    display: inline-block;
}
.bb-popconfirm {
    width: 200px;
    background: #fff;
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    padding: 12px 14px;
}
.bb-popconfirm__text {
    font-size: 13px;
    color: var(--bb-text-primary);
    margin-bottom: 10px;
}
.bb-popconfirm__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.bb-pop-enter-active,
.bb-pop-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}
.bb-pop-enter-from,
.bb-pop-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
