/**
 * 流水状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
    CreateTransactionDTO,
    BatchDeleteTransactionsResult,
    IpcResult,
    Transaction,
    TransactionFilter,
    TransactionCursor,
    UpdateTransactionDTO
} from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    createStaleUserRequestResult,
    isUserRequestCurrent
} from '../app/session/user-request-generation'

export type TransactionInfo = Transaction
export type { TransactionFilter }

export const useTransactionStore = defineStore('transaction', () => {
    const transactions = ref<TransactionInfo[]>([])
    const total = ref(0)
    const currentFilter = ref<TransactionFilter>({})
    const loading = ref(false)
    const loadingMore = ref(false)
    const error = ref<string | null>(null)
    const hasMore = ref(false)
    const nextCursor = ref<TransactionCursor | null>(null)
    let latestRequestId = 0

    /**
     * 重新加载流水列表并使此前列表请求失效
     *
     * @param filter 筛选条件
     * @returns 是否加载成功
     * @author xiangwei
     */
    async function loadTransactions(filter?: TransactionFilter): Promise<boolean> {
        const requestId = ++latestRequestId
        const generation = captureUserRequestGeneration()
        const mergedFilter = { ...currentFilter.value, ...filter, cursor: undefined, page: 1 }
        currentFilter.value = mergedFilter
        loading.value = true
        loadingMore.value = false
        error.value = null

        try {
            const result = await desktopApi.transaction.list(mergedFilter)
            if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return false

            if (result.ok) {
                transactions.value = result.data.items
                total.value = result.data.total
                hasMore.value = result.data.has_more
                nextCursor.value = result.data.next_cursor
                return true
            }
            error.value = result.error
            return false
        } catch (requestError: unknown) {
            if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return false
            error.value = requestError instanceof Error ? requestError.message : '加载流水失败'
            return false
        } finally {
            if (requestId === latestRequestId && isUserRequestCurrent(generation)) {
                loading.value = false
            }
        }
    }

    /**
     * 追加下一页流水
     *
     * @returns 是否成功追加
     * @author xiangwei
     */
    async function loadMoreTransactions(): Promise<boolean> {
        const cursor = nextCursor.value
        if (!cursor || loading.value || loadingMore.value || !hasMore.value) return false

        const requestId = latestRequestId
        const generation = captureUserRequestGeneration()
        loadingMore.value = true
        error.value = null
        const cursorInput: TransactionCursor = { date: cursor.date, id: cursor.id }

        try {
            const result = await desktopApi.transaction.list({
                ...currentFilter.value,
                page: undefined,
                cursor: cursorInput
            })
            if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return false

            if (!result.ok) {
                error.value = result.error
                return false
            }

            const existingIds = new Set(transactions.value.map((transaction) => transaction.id))
            transactions.value.push(
                ...result.data.items.filter((transaction) => !existingIds.has(transaction.id))
            )
            total.value = result.data.total
            hasMore.value = result.data.has_more
            nextCursor.value = result.data.next_cursor
            return true
        } catch (requestError: unknown) {
            if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return false
            error.value = requestError instanceof Error ? requestError.message : '加载更多流水失败'
            return false
        } finally {
            if (requestId === latestRequestId && isUserRequestCurrent(generation)) {
                loadingMore.value = false
            }
        }
    }

    async function createTransaction(data: CreateTransactionDTO): Promise<IpcResult<Transaction>> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.transaction.create(data)
        return isUserRequestCurrent(generation)
            ? result
            : createStaleUserRequestResult<Transaction>()
    }

    async function updateTransaction(
        id: string,
        data: UpdateTransactionDTO
    ): Promise<IpcResult<Transaction>> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.transaction.update(id, data)
        return isUserRequestCurrent(generation)
            ? result
            : createStaleUserRequestResult<Transaction>()
    }

    async function deleteTransaction(id: string): Promise<IpcResult> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.transaction.delete(id)
        return isUserRequestCurrent(generation) ? result : createStaleUserRequestResult()
    }

    /**
     * 批量删除流水
     *
     * @param ids 流水 ID 列表
     * @returns 删除结果
     * @author xiangwei
     */
    async function batchDeleteTransactions(
        ids: string[]
    ): Promise<IpcResult<BatchDeleteTransactionsResult>> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.transaction.batchDelete(ids)
        return isUserRequestCurrent(generation)
            ? result
            : createStaleUserRequestResult<BatchDeleteTransactionsResult>()
    }

    function reset(): void {
        latestRequestId++
        transactions.value = []
        total.value = 0
        currentFilter.value = {}
        loading.value = false
        loadingMore.value = false
        error.value = null
        hasMore.value = false
        nextCursor.value = null
    }

    return {
        transactions,
        total,
        currentFilter,
        loading,
        loadingMore,
        error,
        hasMore,
        nextCursor,
        loadTransactions,
        loadMoreTransactions,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        batchDeleteTransactions,
        reset
    }
})
