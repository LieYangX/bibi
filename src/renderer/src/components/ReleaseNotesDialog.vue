<template>
    <BbModal :visible="visible" title="笔笔更新" width="560px" @close="emit('acknowledge')">
        <div v-if="releases.length" class="release-notes" aria-label="全部版本更新内容">
            <header class="release-notes__intro">
                <div class="release-notes__eyebrow">
                    <Sparkles :size="15" aria-hidden="true" />
                    <span>版本记录</span>
                </div>
                <h2>每一次更新，都有迹可循</h2>
                <p>这里记录笔笔的新增能力与问题修复</p>
            </header>

            <article
                v-for="(release, index) in releases"
                :key="release.version"
                class="release-notes__version"
            >
                <header class="release-notes__version-head">
                    <div class="release-notes__version-title">
                        <span class="release-notes__timeline-dot" aria-hidden="true" />
                        <h3>v{{ release.version }}</h3>
                        <span v-if="index === 0" class="release-notes__latest">最新版本</span>
                    </div>
                    <time :datetime="release.date">{{ release.date }}</time>
                </header>

                <div class="release-notes__version-body">
                    <section
                        class="release-notes__section"
                        :aria-labelledby="`release-${release.version}-additions`"
                    >
                        <div class="release-notes__section-head">
                            <Sparkles :size="15" aria-hidden="true" />
                            <h4 :id="`release-${release.version}-additions`">新增内容</h4>
                        </div>
                        <ul class="release-notes__list">
                            <li v-for="item in release.additions" :key="item">
                                <CircleCheck :size="15" aria-hidden="true" />
                                <span>{{ item }}</span>
                            </li>
                        </ul>
                    </section>

                    <section
                        class="release-notes__section"
                        :aria-labelledby="`release-${release.version}-fixes`"
                    >
                        <div class="release-notes__section-head release-notes__section-head--fix">
                            <Bug :size="15" aria-hidden="true" />
                            <h4 :id="`release-${release.version}-fixes`">修复问题</h4>
                        </div>
                        <ul class="release-notes__list">
                            <li v-for="item in release.fixes" :key="item">
                                <CircleCheck :size="15" aria-hidden="true" />
                                <span>{{ item }}</span>
                            </li>
                        </ul>
                    </section>
                </div>
            </article>
        </div>

        <template #footer>
            <button class="bb-btn bb-btn-primary" @click="emit('acknowledge')">知道了</button>
        </template>
    </BbModal>
</template>

<script setup lang="ts">
import { Bug, CircleCheck, Sparkles } from '@lucide/vue'
import { BbModal } from './ui'
import type { ReleaseNotes } from '../app/release-notes'

defineProps<{
    visible: boolean
    releases: ReleaseNotes[]
}>()

const emit = defineEmits<{ acknowledge: [] }>()
</script>

<style scoped>
.release-notes {
    display: flex;
    flex-direction: column;
}

.release-notes__intro {
    padding: 2px 0 18px;
    border-bottom: 1px solid var(--bb-border);
}

.release-notes__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--bb-accent-text);
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
}

.release-notes__intro h2 {
    margin-top: 5px;
    color: var(--bb-text-primary);
    font-size: 19px;
    font-weight: var(--bb-weight-bold);
    line-height: 1.4;
}

.release-notes__intro p {
    margin-top: 3px;
    color: var(--bb-text-secondary);
    font-size: 13px;
}

.release-notes__version {
    position: relative;
    padding: 22px 0 24px;
}

.release-notes__version + .release-notes__version {
    border-top: 1px solid var(--bb-border);
}

.release-notes__version-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.release-notes__version-title {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
}

.release-notes__timeline-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border: 2px solid var(--bb-bg-card);
    border-radius: 50%;
    background: var(--bb-accent);
    box-shadow: 0 0 0 2px var(--bb-accent-light);
}

.release-notes__version-title h3 {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 18px;
    font-weight: var(--bb-weight-bold);
}

.release-notes__latest {
    padding: 2px 7px;
    border: 1px solid var(--bb-border);
    border-radius: 4px;
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
    line-height: 1.4;
    white-space: nowrap;
}

.release-notes__version-head time {
    flex: 0 0 auto;
    color: var(--bb-text-tertiary);
    font-family: var(--bb-font-mono);
    font-size: 11px;
}

.release-notes__version-body {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px 0 0 16px;
}

.release-notes__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.release-notes__section-head {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--bb-accent-text);
}

.release-notes__section-head--fix {
    color: var(--bb-success);
}

.release-notes__section-head h4 {
    color: var(--bb-text-primary);
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
}

.release-notes__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    list-style: none;
}

.release-notes__list li {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 8px;
    color: var(--bb-text-secondary);
    font-size: 12px;
    line-height: 1.6;
}

.release-notes__list svg {
    margin-top: 3px;
    flex: 0 0 auto;
    color: var(--bb-success);
}

.release-notes__list span {
    min-width: 0;
}

@media (max-width: 480px) {
    .release-notes__version-head {
        align-items: flex-start;
        flex-direction: column;
        gap: 5px;
    }

    .release-notes__version-body {
        padding-left: 0;
    }
}
</style>
