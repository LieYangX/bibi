<template>
    <teleport to="body">
        <transition name="bb-modal">
            <div v-if="visible" class="bb-modal-overlay" @click.self="close">
                <div class="bb-modal-panel" :style="{ maxWidth: width }">
                    <div class="bb-modal-head">
                        <span class="bb-modal-title">{{ title }}</span>
                        <button class="bb-modal-close" @click="close"><X :size="18" /></button>
                    </div>
                    <div class="bb-modal-body">
                        <slot />
                    </div>
                    <div v-if="$slots.footer" class="bb-modal-footer">
                        <slot name="footer" />
                    </div>
                </div>
            </div>
        </transition>
    </teleport>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ visible: boolean; title?: string; width?: string }>()
const emit = defineEmits<{ 'update:visible': [v: boolean]; close: [] }>()

function close(): void {
    emit('update:visible', false)
    emit('close')
}
</script>

<style scoped>
.bb-modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--bb-bg-overlay);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.bb-modal-panel {
    width: 90vw;
    background: var(--bb-bg-card);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.bb-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px 0;
}
.bb-modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--bb-text-primary);
}
.bb-modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
}
.bb-modal-close:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-primary);
}
.bb-modal-body {
    padding: 20px 24px 24px;
    overflow-y: auto;
    flex: 1;
}
.bb-modal-footer {
    padding: 0 24px 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

/* Transitions */
.bb-modal-enter-active,
.bb-modal-leave-active {
    transition: opacity 0.2s ease;
}
.bb-modal-enter-from,
.bb-modal-leave-to {
    opacity: 0;
}
.bb-modal-enter-active .bb-modal-panel {
    animation: panel-in 0.2s ease;
}
.bb-modal-leave-active .bb-modal-panel {
    animation: panel-out 0.15s ease;
}
@keyframes panel-in {
    from {
        transform: scale(0.96) translateY(8px);
        opacity: 0;
    }
    to {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
}
@keyframes panel-out {
    from {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
    to {
        transform: scale(0.96) translateY(8px);
        opacity: 0;
    }
}
</style>
