<template>
    <div class="shell">
        <!-- 左侧图标轨道 -->
        <aside class="rail">
            <router-link
                :to="agentStore.config.enabled ? '/' : '/overview'"
                class="rail-logo"
                title="笔笔"
                aria-label="笔笔"
                draggable="false"
                @dragstart.prevent
            >
                <img src="../assets/app-icon.png" alt="笔笔" draggable="false" />
            </router-link>

            <nav class="rail-nav-group">
                <router-link
                    v-for="item in railItems"
                    :key="item.path"
                    v-slot="{ navigate, isActive }"
                    :to="item.path"
                    :title="item.label"
                    custom
                >
                    <a
                        class="rail-nav"
                        :class="{ 'router-link-active': isActive }"
                        :title="item.label"
                        :aria-label="item.label"
                        @click="navigate"
                    >
                        <component :is="item.icon" :size="20" />
                    </a>
                </router-link>
            </nav>

            <div class="rail-spacer" />

            <router-link v-slot="{ navigate, isActive }" to="/settings" title="设置" custom>
                <a
                    class="rail-nav"
                    :class="{ 'router-link-active': isActive }"
                    title="设置"
                    aria-label="设置"
                    @click="navigate"
                >
                    <SettingsIcon :size="20" />
                </a>
            </router-link>

            <router-link
                to="/login?switch=1"
                class="rail-avatar"
                title="切换用户"
                aria-label="切换用户"
            >
                {{ userStore.userInitial }}
            </router-link>
        </aside>

        <!-- 右侧主内容区 -->
        <div class="main">
            <header class="topbar">
                <div class="topbar__drag" style="-webkit-app-region: drag" />
                <WindowControls />
            </header>
            <div ref="contentRef" class="content" :class="{ 'content--agent': isAgentHome }">
                <router-view v-slot="{ Component: ViewComponent, route: currentRoute }">
                    <transition name="page" mode="out-in">
                        <component :is="ViewComponent" :key="currentRoute.path" />
                    </transition>
                </router-view>
            </div>
        </div>

        <!-- 浮动操作栈：回到小笔 + 记账 FAB（小笔主页隐藏，未启用小笔时不显示回到小笔） -->
        <transition name="fab" appear>
            <div v-if="!isAgentHome" class="fab-stack">
                <button class="fab" title="记一笔" @click="showTxnModal = true">
                    <Pencil :size="22" />
                </button>
                <button
                    v-if="agentStore.config.enabled"
                    class="back-to-bot"
                    title="回到小笔"
                    @click="goHome"
                >
                    回到小笔
                </button>
            </div>
        </transition>

        <!-- 记账弹窗 -->
        <TransactionModal v-model:visible="showTxnModal" @saved="onTransactionSaved" />
    </div>
</template>

<script setup lang="ts">
/**
 * 应用整体布局壳
 * 负责图标轨道导航、顶部窗口控制、记账弹窗与回到小笔浮动按钮
 * 注意：此组件挂载时一定有已登录用户（见 router.beforeEach）
 * @author xiangwei
 */

import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.store'
import { useAgentStore } from '../stores/agent.store'
import WindowControls from './WindowControls.vue'
import TransactionModal from './TransactionModal.vue'
import { emitRefresh } from '../composables/useRefreshBus'
import {
    BarChart3,
    List,
    Shield,
    Tag,
    Wallet,
    FileDown,
    CheckSquare,
    Settings as SettingsIcon,
    Pencil
} from '@lucide/vue'
import type { Component } from 'vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const agentStore = useAgentStore()
const showTxnModal = ref(false)
const contentRef = ref<HTMLElement | null>(null)

/** 小笔主页路由，隐藏 FAB 并接管主内容区滚动 */
const isAgentHome = computed(() => route.path === '/')

/** 图标轨道导航项（小笔主页使用应用 Logo，单独渲染） */
const railItems: Array<{ path: string; label: string; icon: Component }> = [
    { path: '/overview', label: '概览', icon: BarChart3 },
    { path: '/detail', label: '流水', icon: List },
    { path: '/accounts', label: '账户', icon: Shield },
    { path: '/categories', label: '分类', icon: Tag },
    { path: '/budget', label: '预算', icon: Wallet },
    { path: '/import', label: '导入', icon: FileDown },
    { path: '/todos', label: '待办', icon: CheckSquare }
]

/** 返回小笔主页 */
function goHome(): void {
    void router.push('/')
}

/** 记账成功后通知相关页面刷新数据 */
function onTransactionSaved(): void {
    emitRefresh('transaction')
    emitRefresh('account')
    emitRefresh('budget')
}

/** 加载智能体配置 */
onMounted(() => {
    void agentStore.loadConfig()
})

/** 切换用户时重新加载智能体配置 */
watch(
    () => userStore.currentUserId,
    () => {
        void agentStore.loadConfig()
    }
)

/** 路由切换后重置主内容区滚动位置 */
watch(
    () => route.path,
    async () => {
        await nextTick()
        contentRef.value?.scrollTo({ top: 0 })
    }
)
</script>

<style scoped>
.shell {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--bb-bg-page);
}

/* ===== 图标轨道 ===== */
.rail {
    width: 68px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 0;
    gap: 4px;
    background: var(--bb-bg-sidebar);
    border-right: 1px solid var(--bb-border);
    z-index: 10;
}

.rail-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--bb-radius-md);
    background: var(--bb-accent);
    color: #fff;
    margin-bottom: 10px;
    text-decoration: none;
    box-shadow: var(--bb-shadow-md);
    transition:
        transform var(--bb-duration-fast) var(--bb-ease),
        box-shadow var(--bb-duration-fast) var(--bb-ease);
}
.rail-logo:hover {
    transform: scale(1.05);
    box-shadow: var(--bb-shadow-lg);
}
.rail-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--bb-radius-md);
    -webkit-user-drag: none;
    user-select: none;
}

.rail-nav-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.rail-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--bb-radius-md);
    color: var(--bb-text-tertiary);
    position: relative;
    cursor: pointer;
    text-decoration: none;
    transition:
        background var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease);
}
.rail-nav:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-secondary);
}
.rail-nav.router-link-active {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
}
.rail-nav.router-link-active::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 13px;
    width: 3px;
    height: 18px;
    background: var(--bb-accent);
    border-radius: 0 2px 2px 0;
}

.rail-spacer {
    flex: 1;
}

.rail-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--bb-accent);
    color: #fff;
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    text-decoration: none;
    margin-top: 4px;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.rail-avatar:hover {
    transform: scale(1.05);
}

/* ===== 主内容区 ===== */
.main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.topbar {
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    background: var(--bb-glass-bg);
    backdrop-filter: var(--bb-glass-blur);
    -webkit-backdrop-filter: var(--bb-glass-blur);
    border-bottom: 1px solid var(--bb-glass-border);
}
.topbar__drag {
    flex: 1;
    height: 100%;
}
.content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 28px 36px;
}
.content--agent {
    overflow: hidden;
    padding: 0;
}
.content::-webkit-scrollbar {
    width: 4px;
}
.content::-webkit-scrollbar-thumb {
    background: var(--bb-text-disabled);
    border-radius: 2px;
}

/* ===== 浮动操作栈 ===== */
.fab-stack {
    position: fixed;
    bottom: 28px;
    right: 28px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    z-index: 100;
    will-change: transform, opacity;
}
.fab {
    width: 52px;
    height: 52px;
    border: none;
    border-radius: 50%;
    background: var(--bb-accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
        transform var(--bb-duration) var(--bb-ease-spring),
        box-shadow var(--bb-duration) var(--bb-ease);
    /* 双层阴影：近层较实 + 远层扩散，营造悬浮层次感 */
    /* 颜色值复用 --bb-accent 使其在暗色模式下自动适配 */
    box-shadow:
        0 4px 14px color-mix(in srgb, var(--bb-accent) 20%, transparent),
        var(--bb-shadow-float);
}
.fab:hover {
    transform: translateY(-3px) scale(1.06);
    /* 悬停时阴影更深更扩散 */
    box-shadow:
        0 6px 20px color-mix(in srgb, var(--bb-accent) 24%, transparent),
        0 14px 50px color-mix(in srgb, var(--bb-accent) 10%, transparent);
}
.fab:active {
    transform: translateY(0) scale(0.94);
    box-shadow:
        0 2px 6px color-mix(in srgb, var(--bb-accent) 16%, transparent),
        0 5px 16px color-mix(in srgb, var(--bb-accent) 6%, transparent);
}
.back-to-bot {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 11px 20px;
    border: none;
    border-radius: 26px;
    background: var(--bb-accent);
    color: #fff;
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    font-family: var(--bb-font);
    cursor: pointer;
    box-shadow: var(--bb-shadow-float);
    transition:
        transform var(--bb-duration) var(--bb-ease-spring),
        box-shadow var(--bb-duration) var(--bb-ease);
}
.back-to-bot:hover {
    transform: translateY(-2px);
    box-shadow: var(--bb-shadow-float);
}
.back-to-bot:active {
    transform: translateY(0) scale(0.96);
    box-shadow: var(--bb-shadow-md);
}

/* 浮动按钮栈入场/离场动效：scale + fade + slide，非侵入式短时长 */
.fab-enter-active {
    transition:
        opacity var(--bb-duration-slow) var(--bb-ease-out),
        transform var(--bb-duration-slow) var(--bb-ease-spring);
}
.fab-leave-active {
    transition:
        opacity var(--bb-duration-fast) var(--bb-ease),
        transform var(--bb-duration-fast) var(--bb-ease);
}
.fab-enter-from {
    opacity: 0;
    transform: translateY(16px) scale(0.85);
}
.fab-leave-to {
    opacity: 0;
    transform: scale(0.9);
}

/* 动效 */
.fade-enter-active {
    transition: opacity var(--bb-duration) var(--bb-ease);
}
.fade-leave-active {
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* 尊重用户的减少动效偏好 */
@media (prefers-reduced-motion: reduce) {
    .fab-enter-active,
    .fab-leave-active {
        transition-duration: 0.01ms;
    }
    .fab-enter-from,
    .fab-leave-to {
        transform: none;
    }
    .fab,
    .back-to-bot {
        transition-duration: 0.01ms;
    }
}
</style>
