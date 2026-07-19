<template>
    <div class="bb-file-card" @click="openFile">
        <div class="bb-file-card__icon">
            <FileIcon :size="20" />
        </div>
        <div class="bb-file-card__info">
            <span class="bb-file-card__name">{{ fileName }}</span>
            <div class="bb-file-card__meta">
                <span class="bb-file-card__action" :class="actionClass">{{ actionLabel }}</span>
                <span class="bb-file-card__dir">{{ fileDir }}</span>
            </div>
        </div>
        <ExternalLink :size="14" class="bb-file-card__open-icon" />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileIcon, ExternalLink } from '@lucide/vue'
import { desktopApi } from '../api/desktop-api'
import { Message } from './ui'
import type { StructuredFileData } from '@shared/types'

const props = defineProps<{
    data: StructuredFileData
}>()

const fileName = computed(() => {
    const parts = props.data.path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1]
})

const fileDir = computed(() => {
    const parts = props.data.path.replace(/\\/g, '/').split('/')
    parts.pop()
    return parts.join('/')
})

const actionLabel = computed(() => {
    const map: Record<string, string> = {
        created: '已创建',
        modified: '已修改',
        deleted: '已删除',
        ran: '已执行'
    }
    return map[props.data.action] || props.data.action
})

const actionClass = computed(() => {
    const map: Record<string, string> = {
        created: 'bb-file-card__action--created',
        modified: 'bb-file-card__action--modified',
        deleted: 'bb-file-card__action--deleted',
        ran: 'bb-file-card__action--ran'
    }
    return map[props.data.action] || ''
})

async function openFile(): Promise<void> {
    const result = await desktopApi.file.openFile(props.data.path)
    if (!result.ok) {
        Message.warning('无法打开文件：' + result.error)
    }
}
</script>

<style scoped>
.bb-file-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--bb-border-light);
    border-left: 3px solid var(--bb-accent);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-card);
    cursor: pointer;
    transition:
        border-color var(--bb-duration-fast) var(--bb-ease),
        background var(--bb-duration-fast) var(--bb-ease);
    user-select: none;
}
.bb-file-card:hover {
    border-color: var(--bb-accent);
    background: var(--bb-bg-hover);
}
.bb-file-card:hover .bb-file-card__open-icon {
    opacity: 1;
}

.bb-file-card__icon {
    flex-shrink: 0;
    color: var(--bb-accent);
}

.bb-file-card__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.bb-file-card__name {
    font-size: 13px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bb-file-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
}

.bb-file-card__action {
    font-weight: var(--bb-weight-semibold);
}
.bb-file-card__action--created {
    color: var(--bb-success);
}
.bb-file-card__action--modified {
    color: var(--bb-accent);
}
.bb-file-card__action--deleted {
    color: var(--bb-danger);
}
.bb-file-card__action--ran {
    color: var(--bb-info);
}

.bb-file-card__dir {
    color: var(--bb-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bb-file-card__open-icon {
    flex-shrink: 0;
    color: var(--bb-text-tertiary);
    opacity: 0;
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
}
</style>
