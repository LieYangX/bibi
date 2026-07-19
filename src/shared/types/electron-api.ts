/**
 * 渲染进程可访问的桌面能力契约
 * @author xiangwei
 */

import type { Account, CreateAccountDTO, UpdateAccountDTO } from './account'
import type { Budget, BudgetWithProgress, SetBudgetDTO } from './budget'
import type { CreateTodoDTO, Todo, TodoListFilter, UpdateTodoDTO } from './todo'
import type {
    Category,
    CategoryType,
    CreateCategoryDTO,
    CreateSubCategoryDTO,
    SubCategory,
    UpdateCategoryDTO
} from './category'
import type {
    ImportConfirmDTO,
    ImportDiscardDTO,
    ImportDraftSnapshot,
    ImportDraftUpdateDTO,
    ImportResult,
    ImportSource
} from './import'
import type { MonthlyStatistics, AnnualStatistics } from './statistics'
import type {
    BatchDeleteTransactionsResult,
    CreateTransactionDTO,
    ExportTransactionsResult,
    Transaction,
    TransactionFilter,
    TransactionListResult,
    UpdateTransactionDTO
} from './transaction'
import type { AgentAPI } from './agent'
import type { IpcResult } from './api'
import type { User, UserListResult } from './user'
import type { WeatherSnapshot } from './weather'

export interface AppVersions {
    electron: string
    node: string
    chrome: string
    v8: string
    app: string
}

export interface RendererErrorReport {
    kind: 'error' | 'unhandledrejection' | 'vue'
    message: string
    stack?: string
    source?: string
}

export interface ElectronAPI {
    clipboard: {
        writeText: (text: string) => void
    }
    user: {
        list: () => Promise<IpcResult<UserListResult>>
        create: (name: string) => Promise<IpcResult<User>>
        switch: (id: string) => Promise<IpcResult>
        delete: (id: string) => Promise<IpcResult>
    }
    account: {
        list: () => Promise<IpcResult<Account[]>>
        create: (data: CreateAccountDTO) => Promise<IpcResult<Account>>
        update: (id: string, data: UpdateAccountDTO) => Promise<IpcResult<Account | null>>
        delete: (id: string) => Promise<IpcResult>
    }
    category: {
        list: (type?: CategoryType) => Promise<IpcResult<Category[]>>
        create: (data: CreateCategoryDTO) => Promise<IpcResult<Category>>
        update: (id: string, data: UpdateCategoryDTO) => Promise<IpcResult<Category | null>>
        delete: (id: string) => Promise<IpcResult>
        createSub: (data: CreateSubCategoryDTO) => Promise<IpcResult<SubCategory>>
        updateSub: (id: string, data: { name: string }) => Promise<IpcResult<SubCategory | null>>
        deleteSub: (id: string) => Promise<IpcResult>
        resetDefaults: () => Promise<IpcResult>
    }
    transaction: {
        create: (data: CreateTransactionDTO) => Promise<IpcResult<Transaction>>
        update: (id: string, data: UpdateTransactionDTO) => Promise<IpcResult<Transaction>>
        delete: (id: string) => Promise<IpcResult>
        batchDelete: (ids: string[]) => Promise<IpcResult<BatchDeleteTransactionsResult>>
        list: (filter: TransactionFilter) => Promise<IpcResult<TransactionListResult>>
        getById: (id: string) => Promise<IpcResult<Transaction | null>>
        export: (filter: TransactionFilter) => Promise<IpcResult<ExportTransactionsResult>>
    }
    budget: {
        set: (data: SetBudgetDTO) => Promise<IpcResult<Budget>>
        getMonth: (year: number, month: number) => Promise<IpcResult<BudgetWithProgress[]>>
        getYear: (year: number) => Promise<IpcResult<BudgetWithProgress[]>>
        delete: (id: string) => Promise<IpcResult>
    }
    todo: {
        list: (filter: TodoListFilter) => Promise<IpcResult<Todo[]>>
        create: (data: CreateTodoDTO) => Promise<IpcResult<Todo>>
        update: (id: string, data: UpdateTodoDTO) => Promise<IpcResult<Todo | null>>
        delete: (id: string) => Promise<IpcResult>
        toggle: (id: string) => Promise<IpcResult<Todo>>
    }
    statistics: {
        getMonthly: (year: number, month: number) => Promise<IpcResult<MonthlyStatistics>>
        getAnnual: (year: number) => Promise<IpcResult<AnnualStatistics>>
    }
    weather: {
        getCurrent: (forceRefresh?: boolean) => Promise<IpcResult<WeatherSnapshot>>
    }
    file: {
        selectDirectory: () => Promise<IpcResult<string | null>>,
        openFile: (path: string) => Promise<IpcResult>,
        getWorkspaceDir: () => Promise<IpcResult<string>>,
        setWorkspaceDir: (basePath: string) => Promise<IpcResult<string>>,
        resetWorkspaceDir: () => Promise<IpcResult<string>>
    },
    import: {
        selectFile: (source: ImportSource) => Promise<IpcResult<string | null>>
        parseFile: (
            fileToken: string,
            source: ImportSource
        ) => Promise<IpcResult<ImportDraftSnapshot>>
        updateDraft: (data: ImportDraftUpdateDTO) => Promise<IpcResult<ImportDraftSnapshot>>
        confirmDraft: (data: ImportConfirmDTO) => Promise<IpcResult<ImportResult>>
        discardDraft: (data: ImportDiscardDTO) => Promise<IpcResult>
    }
    setting: {
        get: <T>(key: string, defaultValue?: T) => Promise<IpcResult<T | undefined>>
        set: (key: string, value: unknown) => Promise<IpcResult>
    }
    app: {
        getVersions: () => Promise<IpcResult<AppVersions>>
        openLogDirectory: () => Promise<IpcResult>
        reportRendererError: (report: RendererErrorReport) => Promise<IpcResult>
        quit: () => void
        setAutoLaunch: (enabled: boolean) => Promise<IpcResult<boolean>>
        getAutoLaunch: () => Promise<IpcResult<boolean>>
    }
    window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<IpcResult<boolean>>
        onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
        minimizeToTray: () => void
        getMinimizePreference: () => Promise<IpcResult<boolean>>
        setMinimizePreference: (value: boolean) => Promise<IpcResult>
    }
    agent: AgentAPI
}
