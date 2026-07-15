<template>
    <div class="login-view">
        <!-- 装饰背景 -->
        <div class="login-bg">
            <div class="bg-orb bg-orb--1" />
            <div class="bg-orb bg-orb--2" />
            <div class="bg-orb bg-orb--3" />
        </div>

        <div class="login-card">
            <!-- 品牌区 -->
            <div class="login-brand">
                <div class="login-logo-wrap">
                    <img class="login-logo" src="../assets/app-icon.png" alt="笔笔" />
                    <div class="login-logo-glow" />
                </div>
                <h1 class="login-title">笔笔</h1>
                <p class="login-sub">简洁的桌面记账</p>
            </div>

            <!-- 用��列表 -->
            <div v-if="userStore.users.length" class="user-list">
                <div
                    v-for="u in userStore.users"
                    :key="u.id"
                    class="user-card"
                    @click="selectUser(u.id)"
                >
                    <div class="user-card__avatar" :style="{ backgroundColor: u.color }">
                        {{ u.name.charAt(0) }}
                    </div>
                    <div class="user-card__info">
                        <span class="user-card__name">{{ u.name }}</span>
                        <span class="user-card__hint">点击进入</span>
                    </div>
                    <BbPopconfirm content="删除该用户及全部数据？" @ok="del(u.id)">
                        <template #reference>
                            <button class="user-card__del" title="删除用户">
                                <Trash2 :size="14" />
                            </button>
                        </template>
                    </BbPopconfirm>
                </div>
            </div>
            <div v-else class="bb-empty" style="padding: 0 0 24px">
                <UserPlus :size="32" style="color: var(--bb-text-disabled); margin-bottom: 4px" />
                <span>还没有用户，创建一个吧</span>
            </div>

            <!-- 创建用户 -->
            <div class="create-area">
                <div class="create-input-wrap">
                    <User :size="16" class="create-input-icon" />
                    <input
                        v-model="name"
                        class="create-input"
                        placeholder="输入新用户名"
                        :maxlength="20"
                        @keydown.enter="create"
                    />
                </div>
                <button class="create-btn" :disabled="!name.trim()" @click="create">
                    <span>创建并进入</span>
                    <ArrowRight :size="16" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 登录/切换用户页
 * - 无 ?switch 参数且存在上次登录用户 → 自动进入首页
 * - 带 ?switch=1 参数 → 显示用户列表手动选择
 * @author xiangwei
 */

import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.store'
import { BbPopconfirm, Message } from '../components/ui'
import { Trash2, User, UserPlus, ArrowRight } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const name = ref('')

onMounted(async () => {
    await userStore.bootstrap()
    // 仅在非切换模式下，如果已有上次登录用户则自动进入
    const isSwitch = route.query.switch === '1'
    if (!isSwitch && userStore.currentUserId) {
        router.replace('/')
    }
})

async function selectUser(id: string): Promise<void> {
    if (await userStore.switchUser(id)) {
        await router.push('/')
    } else {
        Message.error('切换用户失败')
    }
}

async function create(): Promise<void> {
    if (!name.value.trim()) return
    const u = await userStore.createUser(name.value)
    if (u) router.push('/')
    else Message.error('创建失败')
}

async function del(id: string): Promise<void> {
    const ok = await userStore.deleteUser(id)
    if (ok) Message.success('已删除')
    else Message.error('删除失败')
}
</script>

<style scoped>
/* ========== 布局 ========== */
.login-view {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 44px);
    overflow: hidden;
}

/* ========== 装饰背景 ========== */
.login-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
}
.bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.45;
}
.bg-orb--1 {
    width: 420px;
    height: 420px;
    background: rgba(217, 164, 4, 0.25);
    top: -120px;
    left: -80px;
    animation: float 12s ease-in-out infinite;
}
.bg-orb--2 {
    width: 320px;
    height: 320px;
    background: rgba(99, 102, 241, 0.12);
    bottom: -60px;
    right: -60px;
    animation: float 16s ease-in-out infinite reverse;
}
.bg-orb--3 {
    width: 200px;
    height: 200px;
    background: rgba(217, 164, 4, 0.1);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: float 20s ease-in-out infinite;
}
@keyframes float {
    0%,
    100% {
        transform: translate(0, 0) scale(1);
    }
    33% {
        transform: translate(30px, -30px) scale(1.05);
    }
    66% {
        transform: translate(-20px, 20px) scale(0.95);
    }
}

/* ========== 卡片 ========== */
.login-card {
    position: relative;
    width: 380px;
    padding: 40px 36px 36px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(226, 232, 240, 0.6);
    border-radius: 20px;
    box-shadow:
        0 4px 24px rgba(217, 164, 4, 0.06),
        0 1px 4px rgba(0, 0, 0, 0.04);
    animation: card-in 0.4s var(--bb-ease-spring) both;
}
@keyframes card-in {
    from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* ========== 品牌区 ========== */
.login-brand {
    text-align: center;
    margin-bottom: 32px;
}
.login-logo-wrap {
    position: relative;
    width: 56px;
    height: 56px;
    margin: 0 auto 14px;
}
.login-logo {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    position: relative;
    z-index: 1;
    animation: logo-bounce 0.6s var(--bb-ease-spring) both 0.1s;
}
.login-logo-glow {
    position: absolute;
    inset: -6px;
    border-radius: 20px;
    background: radial-gradient(circle, rgba(217, 164, 4, 0.2) 0%, transparent 70%);
    animation: glow-pulse 3s ease-in-out infinite;
}
@keyframes logo-bounce {
    from {
        transform: scale(0) rotate(-8deg);
        opacity: 0;
    }
    to {
        transform: scale(1) rotate(0);
        opacity: 1;
    }
}
@keyframes glow-pulse {
    0%,
    100% {
        opacity: 0.5;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.15);
    }
}
.login-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--bb-text-primary);
    letter-spacing: -0.02em;
    margin: 0;
}
.login-sub {
    font-size: 13px;
    color: var(--bb-text-tertiary);
    margin-top: 4px;
}

/* ========== 用户列表 ========== */
.user-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 24px;
}
.user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    cursor: pointer;
    transition: all 0.2s ease;
    animation: card-item-in 0.3s var(--bb-ease-out) both;
}
.user-card:nth-child(1) {
    animation-delay: 0.05s;
}
.user-card:nth-child(2) {
    animation-delay: 0.1s;
}
.user-card:nth-child(3) {
    animation-delay: 0.15s;
}
.user-card:nth-child(4) {
    animation-delay: 0.2s;
}
.user-card:nth-child(5) {
    animation-delay: 0.25s;
}
@keyframes card-item-in {
    from {
        opacity: 0;
        transform: translateX(-8px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
.user-card:hover {
    border-color: var(--bb-accent);
    box-shadow: 0 3px 12px rgba(217, 164, 4, 0.1);
    transform: translateX(3px);
}
.user-card:active {
    transform: scale(0.99);
}
.user-card__avatar {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    flex-shrink: 0;
    transition: transform 0.2s ease;
}
.user-card:hover .user-card__avatar {
    transform: scale(1.05);
}
.user-card__info {
    flex: 1;
    min-width: 0;
}
.user-card__name {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: var(--bb-text-primary);
}
.user-card__hint {
    display: block;
    font-size: 11px;
    color: var(--bb-text-tertiary);
    margin-top: 1px;
}
.user-card__del {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
}
.user-card:hover .user-card__del {
    opacity: 1;
}
.user-card__del:hover {
    background: var(--bb-danger-light);
    color: var(--bb-danger);
}

/* ========== 创建用户 ========== */
.create-area {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.create-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    background: var(--bb-bg-card);
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
}
.create-input-wrap:focus-within {
    border-color: var(--bb-accent);
    box-shadow: 0 0 0 3px rgba(217, 164, 4, 0.1);
}
.create-input-icon {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
}
.create-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 11px 0;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    color: var(--bb-text-primary);
}
.create-input::placeholder {
    color: var(--bb-text-tertiary);
}
.create-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 11px;
    border: none;
    border-radius: 10px;
    background: var(--bb-accent);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
    box-shadow: 0 3px 12px rgba(217, 164, 4, 0.2);
}
.create-btn:hover:not(:disabled) {
    background: var(--bb-accent-hover);
    box-shadow: 0 5px 18px rgba(217, 164, 4, 0.3);
    transform: translateY(-1px);
}
.create-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(217, 164, 4, 0.12);
}
.create-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
}
</style>
