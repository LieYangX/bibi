/**
 * 账户管理 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import {
    createAccount,
    deleteAccount,
    listAccounts,
    updateAccount
} from '../services/account.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerAccountIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.account.list,
        IPC_SCHEMAS.none,
        '获取账户列表失败',
        (userId) => listAccounts(userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.account.create,
        IPC_SCHEMAS.account.create,
        '创建账户失败',
        (userId, _event, data) => createAccount(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.account.update,
        IPC_SCHEMAS.account.update,
        '更新账户失败',
        (userId, _event, id, data) => updateAccount(id, data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.account.delete,
        IPC_SCHEMAS.account.delete,
        '删除账户失败',
        (userId, _event, id) => deleteAccount(id, userId)
    )
}
