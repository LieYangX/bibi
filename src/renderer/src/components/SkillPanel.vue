<template>
    <div class="skill-panel">
        <div class="skill-panel__header">
            <h3>Skill 管理</h3>
            <button class="skill-panel__refresh" title="刷新" @click="$emit('refresh')">
                <RefreshCw :size="14" />
            </button>
        </div>
        <div class="skill-panel__list">
            <div
                v-for="skill in skills"
                :key="skill.name"
                class="skill-card"
                :class="{ 'skill-card--disabled': !skill.isEnabled }"
            >
                <div class="skill-card__top">
                    <span class="skill-card__name">{{ skill.displayName }}</span>
                    <label class="skill-card__toggle">
                        <input
                            type="checkbox"
                            :checked="skill.isEnabled"
                            @change="onToggle(skill.name, !skill.isEnabled)"
                        />
                        <span class="toggle-track">
                            <span class="toggle-thumb" />
                        </span>
                    </label>
                </div>
                <p class="skill-card__desc">{{ skill.description }}</p>
                <div class="skill-card__meta">
                    <span
                        class="skill-card__badge"
                        :class="skill.isSystem ? 'badge--system' : 'badge--user'"
                    >
                        {{ skill.isSystem ? '系统' : '自定义' }}
                    </span>
                    <span class="skill-card__version">v{{ skill.version }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * Skill 列表面板
 * 展示所有 Skill 及状态，支持切换启用/禁用
 * @author xiangwei
 */

import { RefreshCw } from '@lucide/vue'
import type { SkillMeta } from '@shared/types'

defineProps<{
    skills: SkillMeta[]
}>()

const emit = defineEmits<{
    toggle: [name: string, enabled: boolean]
    refresh: []
}>()

function onToggle(name: string, enabled: boolean): void {
    emit('toggle', name, enabled)
}
</script>

<style scoped>
.skill-panel {
    display: flex;
    flex-direction: column;
}

.skill-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.skill-panel__header h3 {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    margin: 0;
}

.skill-panel__refresh {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}
.skill-panel__refresh:hover {
    color: var(--bb-accent);
    border-color: var(--bb-accent);
}

.skill-panel__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.skill-card {
    padding: 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
    transition: all var(--bb-duration-fast) var(--bb-ease);
}
.skill-card--disabled {
    opacity: 0.6;
}

.skill-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}

.skill-card__name {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}

/* Toggle 开关 */
.skill-card__toggle input {
    display: none;
}
.toggle-track {
    display: inline-block;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--bb-text-disabled);
    position: relative;
    cursor: pointer;
    transition: background var(--bb-duration-fast) var(--bb-ease);
}
.skill-card__toggle input:checked + .toggle-track {
    background: var(--bb-success);
}
.toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.skill-card__toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(16px);
}

.skill-card__desc {
    font-size: 12px;
    color: var(--bb-text-secondary);
    line-height: 1.5;
    margin: 0 0 8px;
}

.skill-card__meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
}

.skill-card__badge {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
}
.badge--system {
    background: var(--bb-info-light);
    color: var(--bb-info);
}
.badge--user {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
}

.skill-card__version {
    color: var(--bb-text-tertiary);
}
</style>
