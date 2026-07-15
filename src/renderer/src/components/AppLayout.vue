<template>
    <div class="shell">
        <!-- 左侧导航栏 -->
        <aside class="sidebar">
            <router-link to="/" class="brand">
                <img class="brand-icon" src="../assets/app-icon.png" alt="笔笔" />
                <span class="brand-text">笔笔</span>
            </router-link>

            <nav class="nav">
                <router-link
                    v-for="item in navItems"
                    :key="item.path"
                    v-slot="{ navigate, isExactActive }"
                    :to="item.path"
                    custom
                >
                    <a
                        class="nav-item"
                        :class="{ 'router-link-active': isExactActive }"
                        @click="navigate"
                    >
                        <component :is="item.icon" :size="18" class="nav-item__icon" />
                        <span class="nav-item__label">{{ item.label }}</span>
                    </a>
                </router-link>
            </nav>

            <router-link to="/login?switch=1" class="user">
                <div
                    class="bb-avatar"
                    :style="{
                        width: '34px',
                        height: '34px',
                        fontSize: '14px',
                        backgroundColor: userStore.userColor
                    }"
                >
                    {{ userStore.userInitial }}
                </div>
                <div class="user-info">
                    <span class="user-name">{{ userStore.currentUser?.name }}</span>
                    <span class="user-role">切换用户</span>
                </div>
                <LogOut :size="16" class="user-arrow" />
            </router-link>
        </aside>

        <!-- 右侧主内容区 -->
        <div class="main">
            <header class="topbar">
                <div class="topbar__drag" style="-webkit-app-region: drag" />
                <WindowControls />
            </header>
            <div
                ref="contentRef"
                class="content"
                :class="{ 'content--agent': route.path === '/agent' }"
            >
                <router-view v-slot="{ Component: ViewComponent, route: currentRoute }">
                    <transition name="page" mode="out-in">
                        <component :is="ViewComponent" :key="currentRoute.path" />
                    </transition>
                </router-view>
            </div>
        </div>

        <!-- 浮动记账按钮（智能体页面隐藏） -->
        <button v-if="showFab" class="fab" title="记一笔" @click="showTxnModal = true">
            <Pencil :size="22" />
        </button>

        <!-- 记账弹窗 -->
        <TransactionModal v-model:visible="showTxnModal" @saved="onTransactionSaved" />

        <!-- 用户切换弹窗已移除，点击用户区域直接跳转登录页 -->
    </div>
</template>

<script setup lang="ts">
/**
 * 应用整体布局壳
 * 负责侧栏导航、顶部窗口控制、记账弹窗与用户切换
 * 注意：此组件挂载时一定有已登录用户（见 router.beforeEach）
 * @author xiangwei
 */

import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
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
    Settings as SettingsIcon,
    Bot,
    LogOut,
    Pencil
} from '@lucide/vue'
import type { Component } from 'vue'

const route = useRoute()
const userStore = useUserStore()
const agentStore = useAgentStore()
const showTxnModal = ref(false)
const contentRef = ref<HTMLElement | null>(null)

/** 智能体页面隐藏浮动记账按钮 */
const showFab = computed(() => route.path !== '/agent')

/** 侧栏导航项，对应用路由 */
const baseNavItems: Array<{ path: string; label: string; icon: Component }> = [
    { path: '/', label: '首页', icon: BarChart3 },
    { path: '/detail', label: '流水', icon: List },
    { path: '/accounts', label: '账户', icon: Shield },
    { path: '/categories', label: '分类', icon: Tag },
    { path: '/budget', label: '预算', icon: Wallet },
    { path: '/import', label: '导入', icon: FileDown },
    { path: '/settings', label: '设置', icon: SettingsIcon }
]

/** 智能体启用时才显示导航项，位于「设置」上方 */
const navItems = computed(() => {
    const items = [...baseNavItems]
    if (agentStore.config.enabled) {
        const idx = items.findIndex((i) => i.path === '/settings')
        items.splice(idx, 0, { path: '/agent', label: '小笔', icon: Bot })
    }
    return items
})

/** 记账成功后通知相关页面刷新数据 */
function onTransactionSaved(): void {
    emitRefresh('transaction')
    emitRefresh('account')
    emitRefresh('budget')
}

/** 加载智能体配置，控制导航显隐 */
onMounted(() => {
    void agentStore.loadConfig()
})

/** 切换用户时重新加载智能体配置（导航栏显隐） */
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

.sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bb-bg-sidebar);
    border-right: 1px solid var(--bb-border);
    z-index: 10;
}

.brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 18px;
    text-decoration: none;
    cursor: pointer;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.brand:hover {
    transform: translateX(2px);
}
.brand-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(217, 164, 4, 0.28);
    transition:
        box-shadow var(--bb-duration-fast) var(--bb-ease),
        transform var(--bb-duration-fast) var(--bb-ease);
}
.brand:hover .brand-icon {
    box-shadow: 0 6px 16px rgba(217, 164, 4, 0.35);
    transform: rotate(-4deg) scale(1.05);
}
.brand-text {
    font-size: 18px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
    letter-spacing: -0.01em;
}

.nav {
    flex: 1;
    padding: 4px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
}
.nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 12px;
    border-radius: var(--bb-radius-md);
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-secondary);
    text-decoration: none;
    transition: all var(--bb-duration-fast) var(--bb-ease);
    position: relative;
    overflow: hidden;
}
.nav-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 0;
    background: var(--bb-accent);
    border-radius: 0 2px 2px 0;
    transform: translateY(-50%);
    transition: height var(--bb-duration-fast) var(--bb-ease);
}
.nav-item:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-primary);
    transform: translateX(2px);
}
.nav-item.router-link-active {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: 0 1px 3px rgba(217, 164, 4, 0.08);
}
.nav-item.router-link-active::before {
    height: 18px;
}
.nav-item__icon {
    font-size: 18px;
    flex-shrink: 0;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.nav-item:hover .nav-item__icon {
    transform: scale(1.1);
}
.nav-item__label {
    flex: 1;
    min-width: 0;
}

.user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid var(--bb-border);
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: background var(--bb-duration-fast) var(--bb-ease);
}
.user:hover {
    background: var(--bb-bg-hover);
}
.user-info {
    flex: 1;
    min-width: 0;
}
.user-name {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.user-role {
    font-size: 11px;
    color: var(--bb-text-tertiary);
}
.user-arrow {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.user-arrow--open {
    transform: rotate(180deg);
}

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
}
.content::-webkit-scrollbar {
    width: 4px;
}
.content::-webkit-scrollbar-thumb {
    background: var(--bb-text-disabled);
    border-radius: 2px;
}

/* FAB */
.fab {
    position: fixed;
    bottom: 32px;
    right: 32px;
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
    z-index: 100;
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px rgba(217, 164, 4, 0.38);
}
.fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 24px rgba(217, 164, 4, 0.48);
}
.fab:active {
    transform: scale(0.95);
}

/* 用户切换弹窗 */
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
</style>
