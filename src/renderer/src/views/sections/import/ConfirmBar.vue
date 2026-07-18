<template>
    <footer class="confirm-bar">
        <div class="confirm-summary">
            <span class="confirm-summary-item">
                <strong>{{ snapshot.summary.included }}</strong>
                已选
            </span>
            <span class="confirm-summary-item confirm-summary-item--ready">
                <strong>{{ snapshot.summary.ready }}</strong>
                就绪
            </span>
            <span
                class="confirm-summary-item"
                :class="{ 'confirm-summary-item--warning': snapshot.summary.unmapped > 0 }"
            >
                <strong>{{ snapshot.summary.unmapped }}</strong>
                未映射
            </span>
        </div>

        <label class="remember-mapping">
            <input
                type="checkbox"
                :checked="rememberMappings"
                :disabled="busy"
                @change="updateRememberMappings"
            />
            <span>记住本次映射</span>
        </label>

        <div class="confirm-actions">
            <button class="bb-btn" type="button" :disabled="busy" @click="emit('discard')">
                <XCircle :size="15" />
                取消草稿
            </button>
            <button
                class="bb-btn bb-btn-primary"
                type="button"
                :disabled="!canConfirm"
                @click="emit('confirm')"
            >
                <LoaderCircle v-if="busy" :size="15" class="confirm-spinner" />
                <CheckCircle2 v-else :size="15" />
                写入 {{ snapshot.summary.included }} 条
            </button>
        </div>
    </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ImportDraftSnapshot } from '@shared/types'
import { CheckCircle2, LoaderCircle, XCircle } from '@lucide/vue'

const props = defineProps<{
    snapshot: ImportDraftSnapshot
    rememberMappings: boolean
    busy?: boolean
}>()

const emit = defineEmits<{
    'update:rememberMappings': [value: boolean]
    confirm: []
    discard: []
}>()

const canConfirm = computed(
    () =>
        !props.busy &&
        props.snapshot.summary.included > 0 &&
        props.snapshot.summary.ready === props.snapshot.summary.included
)

function updateRememberMappings(event: Event): void {
    emit('update:rememberMappings', (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.confirm-bar {
    position: sticky;
    z-index: 30;
    bottom: 12px;
    display: grid;
    grid-template-columns: minmax(250px, 1fr) auto auto;
    min-height: 64px;
    align-items: center;
    gap: 18px;
    padding: 10px 78px 10px 14px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-glass-bg-strong);
    box-shadow: var(--bb-shadow-float);
    backdrop-filter: blur(14px);
}

.confirm-summary,
.confirm-summary-item,
.remember-mapping,
.confirm-actions {
    display: flex;
    align-items: center;
}

.confirm-summary {
    gap: 18px;
}

.confirm-summary-item {
    gap: 5px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

.confirm-summary-item strong {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 15px;
}

.confirm-summary-item--ready strong {
    color: var(--bb-success);
}

.confirm-summary-item--warning strong {
    color: var(--bb-warning);
}

.remember-mapping {
    gap: 6px;
    color: var(--bb-text-secondary);
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
}

.remember-mapping input {
    width: 15px;
    height: 15px;
    accent-color: var(--bb-accent);
}

.confirm-actions {
    gap: 8px;
}

.confirm-actions .bb-btn {
    min-height: 34px;
    padding: 7px 12px;
    font-size: 12px;
    white-space: nowrap;
}

.confirm-spinner {
    animation: confirm-spin 0.9s linear infinite;
}

@keyframes confirm-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 900px) {
    .confirm-bar {
        grid-template-columns: 1fr auto;
        padding-right: 14px;
    }

    .confirm-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
    }
}

@media (max-width: 620px) {
    .confirm-bar {
        position: static;
        grid-template-columns: 1fr;
        margin-bottom: 68px;
    }

    .confirm-summary {
        justify-content: space-between;
    }

    .confirm-actions {
        grid-column: auto;
    }

    .confirm-actions .bb-btn {
        flex: 1;
    }
}
</style>
