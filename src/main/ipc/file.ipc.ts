/**
 * 文件系统 IPC
 * 提供目录选择等原生对话框能力
 * @author xiangwei
 */

import { dialog, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { registerIpcHandler } from './handle-ipc'
import {
    getWorkspaceDir,
    resolveAndSaveWorkspaceDir,
    resetToDefaultWorkspaceDir
} from '../services/workspace.service'

export function registerFileIpc(): void {
    registerIpcHandler(
        IPC_CHANNELS.file.selectDirectory,
        IPC_SCHEMAS.file.selectDirectory,
        '选择目录失败',
        async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })
            return result.filePaths[0] ?? null
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.file.openFile,
        IPC_SCHEMAS.file.openFile,
        '打开文件失败',
        async (_event, filePath: string) => {
            const errorMessage = await shell.openPath(filePath)
            if (errorMessage) throw new Error(errorMessage)
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.file.getWorkspaceDir,
        IPC_SCHEMAS.file.getWorkspaceDir,
        '获取工作目录失败',
        async () => {
            return await getWorkspaceDir()
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.file.setWorkspaceDir,
        IPC_SCHEMAS.file.setWorkspaceDir,
        '设置工作目录失败',
        async (_event, basePath: string) => {
            return await resolveAndSaveWorkspaceDir(basePath)
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.file.resetWorkspaceDir,
        IPC_SCHEMAS.file.resetWorkspaceDir,
        '重置工作目录失败',
        async () => {
            return await resetToDefaultWorkspaceDir()
        }
    )
}
