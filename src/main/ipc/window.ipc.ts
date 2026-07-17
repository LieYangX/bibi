/**
 * 窗口控制 IPC
 * @author xiangwei
 */

import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { registerIpcHandler } from './handle-ipc'
import { isTrustedIpcSender } from './trusted-senders'
import { createTray } from '../windows/tray'

export function registerWindowIpc(): void {
    ipcMain.on(IPC_CHANNELS.window.minimize, (event) => {
        if (isTrustedIpcSender(event)) BrowserWindow.fromWebContents(event.sender)?.minimize()
    })
    ipcMain.on(IPC_CHANNELS.window.maximize, (event) => {
        if (!isTrustedIpcSender(event)) return
        const window = BrowserWindow.fromWebContents(event.sender)
        if (window?.isMaximized()) window.unmaximize()
        else window?.maximize()
    })
    ipcMain.on(IPC_CHANNELS.window.close, (event) => {
        if (isTrustedIpcSender(event)) BrowserWindow.fromWebContents(event.sender)?.close()
    })
    ipcMain.on(IPC_CHANNELS.window.minimizeToTray, (event) => {
        if (!isTrustedIpcSender(event)) return
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window || window.isDestroyed()) return
        window.hide()
        createTray(window)
    })
    registerIpcHandler(
        IPC_CHANNELS.window.isMaximized,
        IPC_SCHEMAS.none,
        '获取窗口状态失败',
        (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
    )
}
