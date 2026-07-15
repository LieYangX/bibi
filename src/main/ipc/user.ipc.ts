/**
 * 用户管理 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import {
    clearCurrentUserIfMatches,
    getCurrentUserId,
    setCurrentUserId
} from '../services/session.service'
import { createUser, deleteUser, listUsers, userExists } from '../services/user.service'
import { registerIpcHandler } from './handle-ipc'

export function registerUserIpc(): void {
    registerIpcHandler(IPC_CHANNELS.user.list, IPC_SCHEMAS.none, '获取用户列表失败', async () => ({
        users: await listUsers(),
        lastUserId: await getCurrentUserId()
    }))

    registerIpcHandler(
        IPC_CHANNELS.user.create,
        IPC_SCHEMAS.user.create,
        '创建用户失败',
        async (_event, name) => {
            const user = await createUser(name)
            await setCurrentUserId(user.id)
            return user
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.user.switch,
        IPC_SCHEMAS.user.switch,
        '切换用户失败',
        async (_event, id) => {
            if (!(await userExists(id))) {
                throw new Error('用户不存在')
            }
            await setCurrentUserId(id)
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.user.delete,
        IPC_SCHEMAS.user.delete,
        '删除用户失败',
        async (_event, id) => {
            await deleteUser(id)
            await clearCurrentUserIfMatches(id)
        }
    )
}
