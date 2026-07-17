/**
 * 主窗口创建与生命周期
 * @author xiangwei
 */

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import icon from '../../../build/icon.png?asset'
import { trustWebContents } from '../ipc/trusted-senders'
import { configureWebSecurity } from './web-security'
import { logger } from '../utils/logger'

/**
 * 创建主窗口
 *
 * @returns 主窗口
 * @author xiangwei
 */
export async function createMainWindow(showOnReady = true): Promise<BrowserWindow> {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 680,
        minHeight: 480,
        title: '笔笔',
        show: false,
        frame: false,
        autoHideMenuBar: true,
        icon,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    })

    trustWebContents(window.webContents)
    configureWebSecurity(window)

    window.webContents.on('render-process-gone', (_event, details) => {
        logger.error('Window', '渲染进程退出', details)
    })
    window.webContents.on('unresponsive', () => {
        logger.warn('Window', '渲染进程无响应', { webContentsId: window.webContents.id })
    })
    window.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
            if (!isMainFrame) return
            logger.error('Window', '主页面加载失败', {
                errorCode,
                errorDescription,
                validatedUrl
            })
        }
    )

    window.once('ready-to-show', () => {
        if (showOnReady) window.show()
    })
    window.on('maximize', () => {
        window.webContents.send(IPC_CHANNELS.window.maximizeChange, true)
    })
    window.on('unmaximize', () => {
        window.webContents.send(IPC_CHANNELS.window.maximizeChange, false)
    })

    try {
        if (is.dev && process.env.ELECTRON_RENDERER_URL) {
            await window.loadURL(process.env.ELECTRON_RENDERER_URL)
            window.webContents.openDevTools({ mode: 'detach' })
        } else {
            await window.loadFile(join(__dirname, '../renderer/index.html'))
        }
    } catch (error: unknown) {
        if (!window.isDestroyed()) window.destroy()
        throw error
    }

    return window
}
