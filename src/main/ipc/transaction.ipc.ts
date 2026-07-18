/**
 * 流水管理 IPC
 * @author xiangwei
 */

import { dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import {
    createTransaction,
    deleteTransactions,
    deleteTransaction,
    exportTransactions,
    getTransactionById,
    listTransactions,
    updateTransaction
} from '../services/transaction.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerTransactionIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.create,
        IPC_SCHEMAS.transaction.create,
        '创建流水失败',
        (userId, _event, data) => createTransaction(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.update,
        IPC_SCHEMAS.transaction.update,
        '更新流水失败',
        (userId, _event, id, data) => updateTransaction(id, data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.delete,
        IPC_SCHEMAS.transaction.delete,
        '删除流水失败',
        (userId, _event, id) => deleteTransaction(id, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.batchDelete,
        IPC_SCHEMAS.transaction.batchDelete,
        '批量删除流水失败',
        (userId, _event, ids) => deleteTransactions(ids, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.list,
        IPC_SCHEMAS.transaction.list,
        '查询流水失败',
        (userId, _event, filter) => listTransactions(userId, filter)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.getById,
        IPC_SCHEMAS.transaction.getById,
        '获取流水详情失败',
        (userId, _event, id) => getTransactionById(id, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.transaction.export,
        IPC_SCHEMAS.transaction.export,
        '导出流水失败',
        async (userId, _event, filter) => {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
            const result = await dialog.showSaveDialog({
                defaultPath: `流水导出_${today}.xlsx`,
                filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
            })
            if (result.canceled || !result.filePath) {
                return { canceled: true, count: 0 }
            }
            return exportTransactions(userId, filter, result.filePath)
        }
    )
}
