/**
 * 用户会话状态管理
 * @author xiangwei
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import { resetUserData } from '../app/session/reset-user-data'

export type UserInfo = User

export const useUserStore = defineStore('user', () => {
    const users = ref<UserInfo[]>([])
    const currentUserId = ref<string | null>(null)
    const initialized = ref(false)
    let bootstrapPromise: Promise<void> | null = null

    const currentUser = computed(
        () => users.value.find((user) => user.id === currentUserId.value) || null
    )
    const userColor = computed(() => currentUser.value?.color || '#165DFF')
    const userInitial = computed(() => currentUser.value?.name?.charAt(0) || '?')

    async function loadUsers(): Promise<void> {
        const result = await desktopApi.user.list()
        if (!result.ok) return

        users.value = result.data.users
        if (!currentUserId.value) currentUserId.value = result.data.lastUserId
        if (currentUserId.value && !users.value.some((user) => user.id === currentUserId.value)) {
            currentUserId.value = null
        }
    }

    async function bootstrap(): Promise<void> {
        if (initialized.value) return
        if (!bootstrapPromise) {
            bootstrapPromise = loadUsers().finally(() => {
                initialized.value = true
                bootstrapPromise = null
            })
        }
        await bootstrapPromise
    }

    async function createUser(name: string): Promise<UserInfo | null> {
        const result = await desktopApi.user.create(name)
        if (!result.ok) return null

        resetUserData()
        currentUserId.value = result.data.id
        await loadUsers()
        return result.data
    }

    async function switchUser(id: string): Promise<boolean> {
        if (currentUserId.value) {
            await desktopApi.agent.cancelChat()
        }
        const result = await desktopApi.user.switch(id)
        if (!result.ok) return false

        resetUserData()
        currentUserId.value = id
        return true
    }

    async function deleteUser(id: string): Promise<boolean> {
        if (currentUserId.value === id) {
            await desktopApi.agent.cancelChat()
        }
        const result = await desktopApi.user.delete(id)
        if (!result.ok) return false

        if (currentUserId.value === id) {
            resetUserData()
            currentUserId.value = null
        }
        await loadUsers()
        return true
    }

    return {
        users,
        currentUserId,
        initialized,
        currentUser,
        userColor,
        userInitial,
        loadUsers,
        bootstrap,
        createUser,
        switchUser,
        deleteUser
    }
})
