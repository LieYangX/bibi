import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
    Account,
    Budget,
    BudgetWithProgress,
    Category,
    IpcResult,
    MonthlyStatistics,
    Transaction,
    TransactionFilter,
    TransactionListResult,
    User
} from '../../src/shared/types'

const desktopApiMock = vi.hoisted(() => ({
    user: {
        list: vi.fn(),
        create: vi.fn(),
        switch: vi.fn(),
        delete: vi.fn()
    },
    agent: {
        cancelChat: vi.fn()
    },
    account: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    },
    category: {
        list: vi.fn(),
        create: vi.fn(),
        createSub: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateSub: vi.fn(),
        deleteSub: vi.fn(),
        resetDefaults: vi.fn()
    },
    budget: {
        getMonth: vi.fn(),
        set: vi.fn(),
        delete: vi.fn()
    },
    statistics: {
        getMonthly: vi.fn()
    },
    transaction: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    }
}))

vi.mock('../../src/renderer/src/api/desktop-api', () => ({
    desktopApi: desktopApiMock
}))

import { resetUserData } from '../../src/renderer/src/app/session/reset-user-data'
import {
    captureUserRequestGeneration,
    invalidateUserRequests,
    isUserRequestCurrent
} from '../../src/renderer/src/app/session/user-request-generation'
import { useAccountStore } from '../../src/renderer/src/stores/account.store'
import { useBudgetStore } from '../../src/renderer/src/stores/budget.store'
import { useCategoryStore } from '../../src/renderer/src/stores/category.store'
import { useStatisticsStore } from '../../src/renderer/src/stores/statistics.store'
import { useTransactionStore } from '../../src/renderer/src/stores/transaction.store'
import { useUserStore } from '../../src/renderer/src/stores/user.store'

interface Deferred<T> {
    promise: Promise<T>
    resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

describe('用户域请求代次', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        desktopApiMock.agent.cancelChat.mockResolvedValue({ ok: true })
        setActivePinia(createPinia())
        invalidateUserRequests()
    })

    it('失效后拒绝旧代次', () => {
        const generation = captureUserRequestGeneration()

        expect(isUserRequestCurrent(generation)).toBe(true)
        invalidateUserRequests()
        expect(isUserRequestCurrent(generation)).toBe(false)
    })

    it('创建、切换和删除当前用户时依次推进请求代次', async () => {
        const userStore = useUserStore()
        const createdUser = { id: 'user-created' } as User
        desktopApiMock.user.create.mockResolvedValueOnce({ ok: true, data: createdUser })
        desktopApiMock.user.list.mockResolvedValue({
            ok: true,
            data: { users: [createdUser], lastUserId: createdUser.id }
        })

        const beforeCreate = captureUserRequestGeneration()
        await userStore.createUser('新用户')
        expect(isUserRequestCurrent(beforeCreate)).toBe(false)

        desktopApiMock.user.switch.mockResolvedValueOnce({ ok: true })
        const beforeSwitch = captureUserRequestGeneration()
        await userStore.switchUser(createdUser.id)
        expect(isUserRequestCurrent(beforeSwitch)).toBe(false)

        desktopApiMock.user.delete.mockResolvedValueOnce({ ok: true })
        const beforeDelete = captureUserRequestGeneration()
        await userStore.deleteUser(createdUser.id)
        expect(isUserRequestCurrent(beforeDelete)).toBe(false)
    })

    it('切换用户后丢弃所有用户域 Store 的在途查询结果', async () => {
        const accountRequest = createDeferred<IpcResult<Account[]>>()
        const expenseRequest = createDeferred<IpcResult<Category[]>>()
        const incomeRequest = createDeferred<IpcResult<Category[]>>()
        const budgetRequest = createDeferred<IpcResult<BudgetWithProgress[]>>()
        const statisticsRequest = createDeferred<IpcResult<MonthlyStatistics>>()
        const transactionRequest = createDeferred<IpcResult<TransactionListResult>>()

        desktopApiMock.account.list.mockReturnValueOnce(accountRequest.promise)
        desktopApiMock.category.list.mockImplementation((type: string) =>
            type === 'expense' ? expenseRequest.promise : incomeRequest.promise
        )
        desktopApiMock.budget.getMonth.mockReturnValueOnce(budgetRequest.promise)
        desktopApiMock.statistics.getMonthly.mockReturnValueOnce(statisticsRequest.promise)
        desktopApiMock.transaction.list.mockReturnValueOnce(transactionRequest.promise)

        const accountStore = useAccountStore()
        const categoryStore = useCategoryStore()
        const budgetStore = useBudgetStore()
        const statisticsStore = useStatisticsStore()
        const transactionStore = useTransactionStore()
        const pendingLoads = Promise.all([
            accountStore.loadAccounts(),
            categoryStore.loadCategories(),
            budgetStore.loadBudgets(2026, 7),
            statisticsStore.loadMonthly(2026, 7),
            transactionStore.loadTransactions({ page: 2 })
        ])

        resetUserData()
        accountRequest.resolve({ ok: true, data: [{ id: 'account-a' } as Account] })
        expenseRequest.resolve({ ok: true, data: [{ id: 'expense-a' } as Category] })
        incomeRequest.resolve({ ok: true, data: [{ id: 'income-a' } as Category] })
        budgetRequest.resolve({ ok: true, data: [{ id: 'budget-a' } as BudgetWithProgress] })
        statisticsRequest.resolve({ ok: true, data: { year: 2026 } as MonthlyStatistics })
        transactionRequest.resolve({
            ok: true,
            data: {
                items: [{ id: 'transaction-a' } as Transaction],
                total: 1,
                page: 2,
                page_size: 50,
                has_more: false,
                next_cursor: null
            }
        })
        await pendingLoads

        expect(accountStore.accounts).toEqual([])
        expect(categoryStore.expenseCategories).toEqual([])
        expect(categoryStore.incomeCategories).toEqual([])
        expect(categoryStore.loaded).toBe(false)
        expect(budgetStore.budgets).toEqual([])
        expect(statisticsStore.monthlyStats).toBeNull()
        expect(transactionStore.transactions).toEqual([])
        expect(transactionStore.total).toBe(0)
        expect(transactionStore.currentFilter).toEqual({})
    })

    it('旧会话下完成的写操作不再返回成功或触发重新加载', async () => {
        const accountRequest = createDeferred<IpcResult<Account>>()
        const categoryRequest = createDeferred<IpcResult<Category>>()
        const budgetRequest = createDeferred<IpcResult<Budget>>()
        const transactionRequest = createDeferred<IpcResult<Transaction>>()

        desktopApiMock.account.create.mockReturnValueOnce(accountRequest.promise)
        desktopApiMock.category.create.mockReturnValueOnce(categoryRequest.promise)
        desktopApiMock.budget.set.mockReturnValueOnce(budgetRequest.promise)
        desktopApiMock.transaction.create.mockReturnValueOnce(transactionRequest.promise)

        const accountResult = useAccountStore().createAccount({
            name: '账户 A',
            type: 'cash',
            initial_balance_cents: 0
        })
        const categoryResult = useCategoryStore().createCategory({
            name: '分类 A',
            type: 'expense'
        })
        const budgetResult = useBudgetStore().setBudget({
            year: 2026,
            month: 7,
            amount_cents: 100
        })
        const transactionResult = useTransactionStore().createTransaction({
            type: 'expense',
            account_id: 'account-a',
            amount_cents: 100,
            date: '2026-07-11'
        })

        resetUserData()
        accountRequest.resolve({ ok: true, data: { id: 'account-a' } as Account })
        categoryRequest.resolve({ ok: true, data: { id: 'category-a' } as Category })
        budgetRequest.resolve({ ok: true, data: { id: 'budget-a' } as Budget })
        transactionRequest.resolve({ ok: true, data: { id: 'transaction-a' } as Transaction })

        expect((await accountResult).ok).toBe(false)
        expect(await categoryResult).toBe(false)
        expect(await budgetResult).toBe(false)
        expect((await transactionResult).ok).toBe(false)
        expect(desktopApiMock.account.list).not.toHaveBeenCalled()
        expect(desktopApiMock.category.list).not.toHaveBeenCalled()
    })

    it('同一用户快速切换筛选时只接收最后一次流水结果', async () => {
        const firstRequest = createDeferred<IpcResult<TransactionListResult>>()
        const secondRequest = createDeferred<IpcResult<TransactionListResult>>()
        desktopApiMock.transaction.list
            .mockReturnValueOnce(firstRequest.promise)
            .mockReturnValueOnce(secondRequest.promise)
        const transactionStore = useTransactionStore()

        const firstLoad = transactionStore.loadTransactions({ type: 'expense' })
        const secondLoad = transactionStore.loadTransactions({ type: 'income' })
        secondRequest.resolve({
            ok: true,
            data: {
                items: [{ id: 'latest-transaction' } as Transaction],
                total: 1,
                page: 1,
                page_size: 50,
                has_more: false,
                next_cursor: null
            }
        })
        await secondLoad
        firstRequest.resolve({
            ok: true,
            data: {
                items: [{ id: 'stale-transaction' } as Transaction],
                total: 1,
                page: 1,
                page_size: 50,
                has_more: false,
                next_cursor: null
            }
        })
        await firstLoad

        expect(transactionStore.transactions.map((transaction) => transaction.id)).toEqual([
            'latest-transaction'
        ])
        expect(transactionStore.currentFilter.type).toBe('income')
    })

    it('流水追加分页向 IPC 传递可克隆的普通游标并正确结束加载', async () => {
        desktopApiMock.transaction.list
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [{ id: 'transaction-2' } as Transaction],
                    total: 2,
                    page: 1,
                    page_size: 1,
                    has_more: true,
                    next_cursor: { date: '2026-07-12', id: 'transaction-2' }
                }
            })
            .mockImplementationOnce(async (filter: TransactionFilter) => {
                structuredClone(filter)
                return {
                    ok: true,
                    data: {
                        items: [{ id: 'transaction-1' } as Transaction],
                        total: 2,
                        page: 1,
                        page_size: 1,
                        has_more: false,
                        next_cursor: null
                    }
                }
            })

        const transactionStore = useTransactionStore()
        await transactionStore.loadTransactions({ page_size: 1 })
        const loaded = await transactionStore.loadMoreTransactions()
        const loadMoreFilter = desktopApiMock.transaction.list.mock.calls[1][0]

        expect(loaded).toBe(true)
        expect(loadMoreFilter.cursor).toEqual({
            date: '2026-07-12',
            id: 'transaction-2'
        })
        expect(transactionStore.loadingMore).toBe(false)
        expect(transactionStore.hasMore).toBe(false)
        expect(transactionStore.transactions.map((transaction) => transaction.id)).toEqual([
            'transaction-2',
            'transaction-1'
        ])
    })

    it('流水追加分页异常后复位加载状态并保留错误信息', async () => {
        desktopApiMock.transaction.list
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [{ id: 'transaction-2' } as Transaction],
                    total: 2,
                    page: 1,
                    page_size: 1,
                    has_more: true,
                    next_cursor: { date: '2026-07-12', id: 'transaction-2' }
                }
            })
            .mockRejectedValueOnce(new Error('分页请求失败'))

        const transactionStore = useTransactionStore()
        await transactionStore.loadTransactions({ page_size: 1 })
        const loaded = await transactionStore.loadMoreTransactions()

        expect(loaded).toBe(false)
        expect(transactionStore.loadingMore).toBe(false)
        expect(transactionStore.error).toBe('分页请求失败')
    })
})
