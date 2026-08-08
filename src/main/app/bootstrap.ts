/**
 * Electron 应用启动编排
 * @author xiangwei
 */

import { app, BrowserWindow, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerTelemetry } from 'ai'
import { DevToolsTelemetry } from '@ai-sdk/devtools'
import { closeDatabase, initDatabase } from '../database'
import { registerIpcHandlers } from '../ipc'
import { createMainWindow } from '../windows/main-window'
import { createTray, destroyTray } from '../windows/tray'
import { getLogDirectoryInfo, logger } from '../utils/logger'
import { resetModel } from '../services/stt.service'
import { wechatChannelService } from '../agent/wechat-channel.service'
import { getCurrentUserId } from '../services/session.service'
import { userExists } from '../services/user.service'
import { backfillCategoryColors } from '../database/seed'
import { ensureDefaultWorkspaceDir } from '../services/workspace.service'
import { startToolServer, stopToolServer } from '../tool-server'
import { getSetting } from '../services/setting.service'

const APP_ID = 'com.personal.bibi'
const STARTUP_ERROR_TITLE = '笔笔启动失败'

let mainWindow: BrowserWindow | null = null
let processErrorHandlersRegistered = false

/**
 * 注册主进程兜底异常日志
 *
 * @author xiangwei
 */
function registerProcessErrorHandlers(): void {
    if (processErrorHandlersRegistered) return
    processErrorHandlersRegistered = true

    process.on('uncaughtExceptionMonitor', (error, origin) => {
        logger.error('Process', '捕获到未处理异常', { origin, error })
    })
    process.on('unhandledRejection', (reason) => {
        logger.error('Process', '捕获到未处理 Promise 拒绝', { reason })
    })
}

/**
 * 聚焦现有主窗口
 *
 * @author xiangwei
 */
function focusMainWindow(): void {
    const window = mainWindow
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
}

/**
 * 获取异常信息
 *
 * @param error 异常
 * @returns 异常信息
 * @author xiangwei
 */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * 展示启动错误并记录日志
 *
 * @param logMessage 日志信息
 * @param userMessage 用户提示
 * @param error 异常
 * @author xiangwei
 */
function reportStartupError(logMessage: string, userMessage: string, error: unknown): void {
    const message = getErrorMessage(error)
    logger.error('Bootstrap', logMessage, { error: message })
    dialog.showErrorBox(STARTUP_ERROR_TITLE, `${userMessage}：${message}`)
}

/**
 * 登记当前主窗口及其关闭生命周期
 *
 * @param window 主窗口
 * @author xiangwei
 */
function trackMainWindow(window: BrowserWindow): void {
    mainWindow = window
    window.once('closed', () => {
        if (mainWindow === window) mainWindow = null
    })
}

/**
 * 创建并登记主窗口
 *
 * @author xiangwei
 */
async function openMainWindow(showOnReady = true): Promise<void> {
    const window = await createMainWindow(showOnReady)
    trackMainWindow(window)
}

/**
 * 在 macOS 激活应用时按需重建主窗口
 *
 * @author xiangwei
 */
function handleActivate(): void {
    if (BrowserWindow.getAllWindows().length > 0) return

    void openMainWindow().catch((error: unknown) => {
        reportStartupError('重建主窗口失败', '重新打开主窗口失败', error)
    })
}

/**
 * 恢复上次登录用户保存的微信连接
 *
 * 微信连接失败不阻断应用启动，用户仍可进入小笔页面重新扫码。
 *
 * @author xiangwei
 */
async function restoreLastWechatConnection(): Promise<void> {
    const userId = await getCurrentUserId()
    if (!userId || !(await userExists(userId))) return

    try {
        const status = await wechatChannelService.getStatus(userId)
        if (status.phase === 'connected') {
            logger.info('Bootstrap', '已恢复上次微信连接', {
                userId,
                conversationId: status.conversationId
            })
        }
    } catch (error: unknown) {
        logger.warn('Bootstrap', '恢复上次微信连接失败', {
            userId,
            error: getErrorMessage(error)
        })
    }
}

/**
 * 初始化应用运行环境
 *
 * @author xiangwei
 */
async function initializeApplication(): Promise<void> {
    await app.whenReady()

    app.name = '笔笔'
    electronApp.setAppUserModelId(APP_ID)
    logger.info('Bootstrap', '应用启动', {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        platform: process.platform,
        arch: process.arch,
        packaged: app.isPackaged,
        log: getLogDirectoryInfo()
    })
    app.on('browser-window-created', (_event, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // 开发环境下注册 AI SDK DevTools 遥测，用于调试和监控 AI 运行状态
    if (!app.isPackaged) {
        registerTelemetry(DevToolsTelemetry())
        logger.info('Bootstrap', 'AI SDK DevTools 遥测已注册（开发环境）')
    }

    try {
        await initDatabase()
        // 为新版本升级回填缺少颜色的分类
        backfillCategoryColors()
    } catch (error: unknown) {
        reportStartupError('数据库初始化失败', '数据库初始化失败', error)
        app.quit()
        return
    }

    // 确保默认工作目录存在（用户未设置自定义目录时才自动创建）
    await ensureDefaultWorkspaceDir()

    await restoreLastWechatConnection()
    registerIpcHandlers()

    // 根据设置开关决定是否启动 Tool Server（供 iOS 端联动）
    const toolServerEnabled = (await getSetting<boolean>('tool_server_enabled')) ?? false
    if (toolServerEnabled) {
        try {
            await startToolServer()
        } catch (error: unknown) {
            // Tool Server 启动失败不阻断应用启动
            logger.warn('Bootstrap', 'Tool Server 启动失败（不阻断应用）', {
                error: getErrorMessage(error)
            })
        }
    } else {
        logger.info('Bootstrap', 'Tool Server 未启用（设置中已关闭）')
    }

    const isAutoStart = process.argv.includes('--autostart')
    try {
        await openMainWindow(!isAutoStart)
    } catch (error: unknown) {
        reportStartupError('创建主窗口失败', '主窗口加载失败', error)
        app.quit()
        return
    }

    // 开机自启时最小化到系统托盘，不显示主窗口
    if (isAutoStart && mainWindow) {
        createTray(mainWindow)
        logger.info('Bootstrap', '开机自启模式，应用已最小化到系统托盘')
    }

    app.on('activate', handleActivate)
    logger.info('Bootstrap', '应用初始化完成')
}

/**
 * 启动 Electron 应用
 *
 * @author xiangwei
 */
export function bootstrapApplication(): void {
    registerProcessErrorHandlers()
    if (!app.requestSingleInstanceLock()) {
        logger.warn('Bootstrap', '检测到已有运行实例，当前进程退出')
        app.quit()
        return
    }

    app.on('second-instance', focusMainWindow)
    app.on('before-quit', () => {
        logger.info('Bootstrap', '应用即将退出')
        destroyTray()
        wechatChannelService.stopAll()
        resetModel()
        void stopToolServer()
        closeDatabase()
    })
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })

    void initializeApplication().catch((error: unknown) => {
        reportStartupError('应用初始化失败', '应用初始化失败', error)
        app.quit()
    })
}
