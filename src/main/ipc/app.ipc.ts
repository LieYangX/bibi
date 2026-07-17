/**
 * 应用信息 IPC
 * @author xiangwei
 */

import { app, ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { registerIpcHandler } from './handle-ipc'
import { getLogDirectory, logger } from '../utils/logger'
import { isTrustedIpcSender } from './trusted-senders'

export function registerAppIpc(): void {
    registerIpcHandler(IPC_CHANNELS.app.getVersions, IPC_SCHEMAS.none, '获取版本信息失败', () => ({
        electron: process.versions.electron || '',
        node: process.versions.node || '',
        chrome: process.versions.chrome || '',
        v8: process.versions.v8 || '',
        app: app.getVersion()
    }))

    registerIpcHandler(
        IPC_CHANNELS.app.openLogDirectory,
        IPC_SCHEMAS.none,
        '打开日志目录失败',
        async () => {
            const logDirectory = getLogDirectory()
            const errorMessage = await shell.openPath(logDirectory)
            if (errorMessage) throw new Error(errorMessage)
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.app.reportRendererError,
        IPC_SCHEMAS.app.reportRendererError,
        '上报渲染进程异常失败',
        (_event, report) => {
            logger.error('Renderer', '渲染进程异常', report)
        }
    )

    // 设置开机自启状态，通过系统注册表写入启动项
    registerIpcHandler(
        IPC_CHANNELS.app.setAutoLaunch,
        IPC_SCHEMAS.app.setAutoLaunch,
        '设置开机自启失败',
        (_event, enabled) => {
            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: process.execPath,
                args: ['--autostart'],
                enabled: true
            })
            return app.getLoginItemSettings({
                path: process.execPath,
                args: ['--autostart']
            }).openAtLogin
        }
    )

    // 查询当前开机自启状态
    registerIpcHandler(
        IPC_CHANNELS.app.getAutoLaunch,
        IPC_SCHEMAS.app.getAutoLaunch,
        '获取开机自启状态失败',
        () =>
            app.getLoginItemSettings({
                path: process.execPath,
                args: ['--autostart']
            }).openAtLogin
    )

    ipcMain.on(IPC_CHANNELS.app.quit, (event) => {
        if (isTrustedIpcSender(event)) {
            logger.info('AppIPC', '渲染进程请求退出应用')
            app.quit()
        }
    })
}
