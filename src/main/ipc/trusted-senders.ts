/**
 * IPC 可信渲染进程注册表
 * @author xiangwei
 */

import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

const trustedWebContentsIds = new Set<number>()

/**
 * 注册可信渲染进程
 *
 * @param webContents 渲染进程对象
 * @author xiangwei
 */
export function trustWebContents(webContents: WebContents): void {
    trustedWebContentsIds.add(webContents.id)
    webContents.once('destroyed', () => trustedWebContentsIds.delete(webContents.id))
}

/**
 * 判断 IPC 是否来自已注册的主框架
 *
 * @param event IPC 事件
 * @returns 是否可信
 * @author xiangwei
 */
export function isTrustedIpcSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
    return (
        trustedWebContentsIds.has(event.sender.id) && event.senderFrame === event.sender.mainFrame
    )
}
