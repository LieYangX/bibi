/**
 * 预加载脚本
 * 通过 contextBridge 向渲染进程暴露最小化的桌面能力
 * @author xiangwei
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import type {
    CreateAccountDTO,
    CreateCategoryDTO,
    CreateSubCategoryDTO,
    CreateTransactionDTO,
    ElectronAPI,
    ImportConfirmDTO,
    ImportDiscardDTO,
    ImportDraftUpdateDTO,
    ImportSource,
    SetBudgetDTO,
    TransactionFilter,
    UpdateAccountDTO,
    UpdateCategoryDTO,
    UpdateTransactionDTO,
    StreamEvent,
    SttProgressEvent,
    RendererErrorReport,
    WechatConnectionStatus
} from '@shared/types'

/**
 * 调用主进程并记录耗时
 *
 * @param channel IPC 频道
 * @param args 调用参数
 * @returns 主进程返回值
 * @author xiangwei
 */
async function invokeWithLog<T>(channel: string, ...args: unknown[]): Promise<T> {
    const start = Date.now()
    try {
        const result = await ipcRenderer.invoke(channel, ...args)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[IPC ${channel}] ${Date.now() - start}ms`)
        }
        return result as T
    } catch (error: unknown) {
        console.error(`[IPC x ${channel}]`, error)
        throw error
    }
}

const electronAPI: ElectronAPI = {
    user: {
        list: () => invokeWithLog(IPC_CHANNELS.user.list),
        create: (name: string) => invokeWithLog(IPC_CHANNELS.user.create, name),
        switch: (id: string) => invokeWithLog(IPC_CHANNELS.user.switch, id),
        delete: (id: string) => invokeWithLog(IPC_CHANNELS.user.delete, id)
    },
    account: {
        list: () => invokeWithLog(IPC_CHANNELS.account.list),
        create: (data: CreateAccountDTO) => invokeWithLog(IPC_CHANNELS.account.create, data),
        update: (id: string, data: UpdateAccountDTO) =>
            invokeWithLog(IPC_CHANNELS.account.update, id, data),
        delete: (id: string) => invokeWithLog(IPC_CHANNELS.account.delete, id)
    },
    category: {
        list: (type) => invokeWithLog(IPC_CHANNELS.category.list, type),
        create: (data: CreateCategoryDTO) => invokeWithLog(IPC_CHANNELS.category.create, data),
        update: (id: string, data: UpdateCategoryDTO) =>
            invokeWithLog(IPC_CHANNELS.category.update, id, data),
        delete: (id: string) => invokeWithLog(IPC_CHANNELS.category.delete, id),
        createSub: (data: CreateSubCategoryDTO) =>
            invokeWithLog(IPC_CHANNELS.category.createSub, data),
        updateSub: (id: string, data: { name: string }) =>
            invokeWithLog(IPC_CHANNELS.category.updateSub, id, data),
        deleteSub: (id: string) => invokeWithLog(IPC_CHANNELS.category.deleteSub, id),
        resetDefaults: () => invokeWithLog(IPC_CHANNELS.category.resetDefaults)
    },
    transaction: {
        create: (data: CreateTransactionDTO) =>
            invokeWithLog(IPC_CHANNELS.transaction.create, data),
        update: (id: string, data: UpdateTransactionDTO) =>
            invokeWithLog(IPC_CHANNELS.transaction.update, id, data),
        delete: (id: string) => invokeWithLog(IPC_CHANNELS.transaction.delete, id),
        batchDelete: (ids: string[]) => invokeWithLog(IPC_CHANNELS.transaction.batchDelete, ids),
        list: (filter: TransactionFilter) => invokeWithLog(IPC_CHANNELS.transaction.list, filter),
        getById: (id: string) => invokeWithLog(IPC_CHANNELS.transaction.getById, id)
    },
    budget: {
        set: (data: SetBudgetDTO) => invokeWithLog(IPC_CHANNELS.budget.set, data),
        getMonth: (year: number, month: number) =>
            invokeWithLog(IPC_CHANNELS.budget.getMonth, year, month),
        getYear: (year: number) => invokeWithLog(IPC_CHANNELS.budget.getYear, year),
        delete: (id: string) => invokeWithLog(IPC_CHANNELS.budget.delete, id)
    },
    statistics: {
        getMonthly: (year: number, month: number) =>
            invokeWithLog(IPC_CHANNELS.statistics.getMonthly, year, month),
        getAnnual: (year: number) => invokeWithLog(IPC_CHANNELS.statistics.getAnnual, year)
    },
    weather: {
        getCurrent: (forceRefresh) => invokeWithLog(IPC_CHANNELS.weather.getCurrent, forceRefresh)
    },
    import: {
        selectFile: (source: ImportSource) => invokeWithLog(IPC_CHANNELS.import.selectFile, source),
        parseFile: (fileToken: string, source: ImportSource) =>
            invokeWithLog(IPC_CHANNELS.import.parseFile, fileToken, source),
        updateDraft: (data: ImportDraftUpdateDTO) =>
            invokeWithLog(IPC_CHANNELS.import.updateDraft, data),
        confirmDraft: (data: ImportConfirmDTO) =>
            invokeWithLog(IPC_CHANNELS.import.confirmDraft, data),
        discardDraft: (data: ImportDiscardDTO) =>
            invokeWithLog(IPC_CHANNELS.import.discardDraft, data)
    },
    setting: {
        get: <T>(key: string, defaultValue?: T) =>
            invokeWithLog(IPC_CHANNELS.setting.get, key, defaultValue),
        set: (key: string, value: unknown) => invokeWithLog(IPC_CHANNELS.setting.set, key, value)
    },
    app: {
        getVersions: () => invokeWithLog(IPC_CHANNELS.app.getVersions),
        openLogDirectory: () => invokeWithLog(IPC_CHANNELS.app.openLogDirectory),
        reportRendererError: (report: RendererErrorReport) =>
            invokeWithLog(IPC_CHANNELS.app.reportRendererError, report),
        quit: () => ipcRenderer.send(IPC_CHANNELS.app.quit),
        setAutoLaunch: (enabled: boolean) => invokeWithLog(IPC_CHANNELS.app.setAutoLaunch, enabled),
        getAutoLaunch: () => invokeWithLog(IPC_CHANNELS.app.getAutoLaunch)
    },
    window: {
        minimize: () => ipcRenderer.send(IPC_CHANNELS.window.minimize),
        maximize: () => ipcRenderer.send(IPC_CHANNELS.window.maximize),
        close: () => ipcRenderer.send(IPC_CHANNELS.window.close),
        isMaximized: () => invokeWithLog(IPC_CHANNELS.window.isMaximized),
        onMaximizeChange: (callback: (maximized: boolean) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, value: boolean): void => {
                callback(value)
            }
            ipcRenderer.on(IPC_CHANNELS.window.maximizeChange, listener)
            return () => ipcRenderer.removeListener(IPC_CHANNELS.window.maximizeChange, listener)
        },
        minimizeToTray: () => ipcRenderer.send(IPC_CHANNELS.window.minimizeToTray)
    },
    agent: {
        chat: (conversationId, message, deepThink) =>
            invokeWithLog(IPC_CHANNELS.agent.chat, conversationId, message, deepThink),
        cancelChat: () => invokeWithLog(IPC_CHANNELS.agent.cancelChat),
        listConversations: (cursor) => invokeWithLog(IPC_CHANNELS.agent.listConversations, cursor),
        deleteConversation: (id) => invokeWithLog(IPC_CHANNELS.agent.deleteConversation, id),
        getConversation: (id, cursor) =>
            invokeWithLog(IPC_CHANNELS.agent.getConversation, id, cursor),
        getConfig: () => invokeWithLog(IPC_CHANNELS.agent.getConfig),
        updateConfig: (config) => invokeWithLog(IPC_CHANNELS.agent.updateConfig, config),
        listLocalTools: () => invokeWithLog(IPC_CHANNELS.agent.listLocalTools),
        listSkills: () => invokeWithLog(IPC_CHANNELS.agent.listSkills),
        getSkillDetail: (id) => invokeWithLog(IPC_CHANNELS.agent.getSkillDetail, id),
        reloadSkills: () => invokeWithLog(IPC_CHANNELS.agent.reloadSkills),
        toggleSkill: (name, enabled) =>
            invokeWithLog(IPC_CHANNELS.agent.toggleSkill, name, enabled),
        renameConversation: (id, title) =>
            invokeWithLog(IPC_CHANNELS.agent.renameConversation, id, title),
        getToolCallCounts: () => invokeWithLog(IPC_CHANNELS.agent.getToolCallCounts),
        setToolCallCounts: (counts) => invokeWithLog(IPC_CHANNELS.agent.setToolCallCounts, counts),
        createSkill: (data) => invokeWithLog(IPC_CHANNELS.agent.createSkill, data),
        deleteSkill: (name) => invokeWithLog(IPC_CHANNELS.agent.deleteSkill, name),
        listMcpServers: () => invokeWithLog(IPC_CHANNELS.agent.listMcpServers),
        saveMcpServer: (server) => invokeWithLog(IPC_CHANNELS.agent.saveMcpServer, server),
        deleteMcpServer: (name) => invokeWithLog(IPC_CHANNELS.agent.deleteMcpServer, name),
        toggleMcpServer: (name, enabled) =>
            invokeWithLog(IPC_CHANNELS.agent.toggleMcpServer, name, enabled),
        inspectMcpServer: (name) => invokeWithLog(IPC_CHANNELS.agent.inspectMcpServer, name),
        connectWechat: () => invokeWithLog(IPC_CHANNELS.agent.connectWechat),
        disconnectWechat: () => invokeWithLog(IPC_CHANNELS.agent.disconnectWechat),
        getWechatStatus: () => invokeWithLog(IPC_CHANNELS.agent.getWechatStatus),
        onWechatStatus: (callback) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                status: WechatConnectionStatus
            ): void => {
                callback(status)
            }
            ipcRenderer.on(IPC_CHANNELS.agent.wechatStatus, listener)
            return () => ipcRenderer.removeListener(IPC_CHANNELS.agent.wechatStatus, listener)
        },
        transcribeAudio: (buffer) => invokeWithLog(IPC_CHANNELS.agent.transcribeAudio, buffer),
        sttDownloadModel: (modelId) => invokeWithLog(IPC_CHANNELS.agent.sttDownloadModel, modelId),
        sttModelStatus: (modelId?) => invokeWithLog(IPC_CHANNELS.agent.sttModelStatus, modelId),
        sttDeleteModel: (modelId) => invokeWithLog(IPC_CHANNELS.agent.sttDeleteModel, modelId),
        onTranscribeProgress: (callback: (event: SttProgressEvent) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, data: SttProgressEvent): void => {
                callback(data)
            }
            ipcRenderer.on(IPC_CHANNELS.agent.transcribeProgress, listener)
            return () => ipcRenderer.removeListener(IPC_CHANNELS.agent.transcribeProgress, listener)
        },
        onEvent: (callback: (event: StreamEvent) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, event: StreamEvent): void => {
                callback(event)
            }
            ipcRenderer.on(IPC_CHANNELS.agent.event, listener)
            return () => ipcRenderer.removeListener(IPC_CHANNELS.agent.event, listener)
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
