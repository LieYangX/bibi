/**
 * 账户状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Account, CreateAccountDTO, IpcResult, UpdateAccountDTO } from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    createStaleUserRequestResult,
    isUserRequestCurrent
} from '../app/session/user-request-generation'

export type AccountInfo = Account

export const useAccountStore = defineStore('account', () => {
    const accounts = ref<AccountInfo[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    let latestRequestId = 0

    async function loadAccountsForGeneration(generation: number): Promise<void> {
        const requestId = ++latestRequestId
        loading.value = true
        error.value = null
        const result = await desktopApi.account.list()
        if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return
        loading.value = false
        if (result.ok) {
            accounts.value = result.data
        } else {
            error.value = result.error
        }
    }

    async function loadAccounts(): Promise<void> {
        await loadAccountsForGeneration(captureUserRequestGeneration())
    }

    async function createAccount(data: CreateAccountDTO): Promise<IpcResult<Account>> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.account.create(data)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult<Account>()
        if (result.ok) await loadAccountsForGeneration(generation)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult<Account>()
        return result
    }

    async function updateAccount(
        id: string,
        data: UpdateAccountDTO
    ): Promise<IpcResult<Account | null>> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.account.update(id, data)
        if (!isUserRequestCurrent(generation)) {
            return createStaleUserRequestResult<Account | null>()
        }
        if (result.ok) await loadAccountsForGeneration(generation)
        if (!isUserRequestCurrent(generation)) {
            return createStaleUserRequestResult<Account | null>()
        }
        return result
    }

    async function deleteAccount(id: string): Promise<IpcResult> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.account.delete(id)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult()
        if (result.ok) await loadAccountsForGeneration(generation)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult()
        return result
    }

    function reset(): void {
        latestRequestId++
        accounts.value = []
        loading.value = false
        error.value = null
    }

    return {
        accounts,
        loading,
        error,
        loadAccounts,
        createAccount,
        updateAccount,
        deleteAccount,
        reset
    }
})
