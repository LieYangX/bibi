<template>
    <div v-if="!userStore.initialized" class="startup-shell">
        <div class="startup-shell__controls"><WindowControls /></div>
        <div class="startup-shell__content">
            <img src="./assets/app-icon.png" alt="笔笔" class="startup-shell__logo" />
            <div class="startup-shell__brand">笔笔</div>
            <div class="startup-shell__status"><span /><span /><span /></div>
        </div>
    </div>
    <router-view v-else />
    <ReleaseNotesDialog
        :visible="showReleaseNotes"
        :releases="allReleaseNotes"
        @acknowledge="acknowledgeReleaseNotes"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import WindowControls from './components/WindowControls.vue'
import ReleaseNotesDialog from './components/ReleaseNotesDialog.vue'
import { useUserStore } from './stores/user.store'
import { useSettingStore } from './stores/setting.store'
import { desktopApi } from './api/desktop-api'
import {
    getAllReleaseNotes,
    getReleaseNotes,
    hasReadReleaseNotes,
    markReleaseNotesRead,
    RELEASE_NOTES_DELAY_MS,
    type ReleaseNotes,
    type ReleaseNotesStorage
} from './app/release-notes'
import { openReleaseNotesKey } from './app/release-notes-presenter'

const userStore = useUserStore()
const settingStore = useSettingStore()
const showReleaseNotes = ref(false)
const currentReleaseNotes = ref<ReleaseNotes | null>(null)
const allReleaseNotes = getAllReleaseNotes()
let hasCheckedReleaseNotes = false
let releaseNotesTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 获取可用的本地已读状态存储器
 *
 * @returns 可用存储器，无法访问时返回 null
 * @author xiangwei
 */
function getReleaseNotesStorage(): ReleaseNotesStorage | null {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

/**
 * 根据主进程真实版本检查是否需要展示更新公告
 *
 * @author xiangwei
 */
async function checkReleaseNotes(): Promise<void> {
    const storage = getReleaseNotesStorage()
    if (!storage) return

    const result = await desktopApi.app.getVersions()
    if (!result.ok) return

    const release = getReleaseNotes(result.data.app)
    if (!release || hasReadReleaseNotes(storage, release)) return

    currentReleaseNotes.value = release
    releaseNotesTimer = setTimeout(() => {
        releaseNotesTimer = null
        if (!hasReadReleaseNotes(storage, release)) showReleaseNotes.value = true
    }, RELEASE_NOTES_DELAY_MS)
}

/**
 * 立即打开当前版本更新公告
 *
 * @author xiangwei
 */
async function openCurrentReleaseNotes(): Promise<void> {
    if (releaseNotesTimer) {
        clearTimeout(releaseNotesTimer)
        releaseNotesTimer = null
    }
    const result = await desktopApi.app.getVersions()
    if (!result.ok) return
    const release = getReleaseNotes(result.data.app)
    if (!release) return
    currentReleaseNotes.value = release
    showReleaseNotes.value = true
}

/**
 * 记录公告已读并关闭弹窗
 *
 * @author xiangwei
 */
function acknowledgeReleaseNotes(): void {
    if (releaseNotesTimer) {
        clearTimeout(releaseNotesTimer)
        releaseNotesTimer = null
    }
    const release = currentReleaseNotes.value
    const storage = getReleaseNotesStorage()
    if (release && storage) markReleaseNotesRead(storage, release)
    showReleaseNotes.value = false
}

provide(openReleaseNotesKey, openCurrentReleaseNotes)

/* ===== 主题应用 =====
 * 依据 settingStore.theme 与系统 prefers-color-scheme 计算实际生效的主题，
 * 在 <html> 上切换 .dark 类以触发 base.css 中的深色 token 覆盖。
 * theme === 'system' 时实时跟随系统主题变化。
 */
const prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)')
const systemPrefersDark = ref(prefersDarkMedia.matches)

function handleSchemeChange(event: MediaQueryListEvent): void {
    systemPrefersDark.value = event.matches
}

const effectiveDark = computed(() => {
    const mode = settingStore.theme
    if (mode === 'dark') return true
    if (mode === 'light') return false
    return systemPrefersDark.value
})

watch(
    effectiveDark,
    (dark) => {
        document.documentElement.classList.toggle('dark', dark)
    },
    { immediate: true }
)

onMounted(() => {
    prefersDarkMedia.addEventListener('change', handleSchemeChange)
})

onUnmounted(() => {
    prefersDarkMedia.removeEventListener('change', handleSchemeChange)
})

watch(
    () => userStore.initialized,
    (initialized) => {
        if (!initialized || hasCheckedReleaseNotes) return
        hasCheckedReleaseNotes = true
        void checkReleaseNotes()
    },
    { immediate: true }
)

onUnmounted(() => {
    if (releaseNotesTimer) clearTimeout(releaseNotesTimer)
})
</script>

<style scoped>
.startup-shell {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--bb-bg-page);
    color: var(--bb-text-primary);
}
.startup-shell__controls {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
}
.startup-shell__content {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
}
.startup-shell__logo {
    width: 58px;
    height: 58px;
    object-fit: contain;
}
.startup-shell__brand {
    font-size: 21px;
    font-weight: var(--bb-weight-semibold);
}
.startup-shell__status {
    display: flex;
    gap: 5px;
    min-height: 18px;
    align-items: center;
}
.startup-shell__status span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--bb-accent);
    animation: startup-pulse 1.2s ease-in-out infinite;
}
.startup-shell__status span:nth-child(2) {
    animation-delay: 0.15s;
}
.startup-shell__status span:nth-child(3) {
    animation-delay: 0.3s;
}
@keyframes startup-pulse {
    0%,
    70%,
    100% {
        opacity: 0.3;
        transform: translateY(0);
    }
    35% {
        opacity: 1;
        transform: translateY(-3px);
    }
}
</style>
