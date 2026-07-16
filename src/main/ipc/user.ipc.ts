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
import { wechatChannelService } from '../agent/wechat-channel.service'
import { logger } from '../utils/logger'

/**
 * 后台恢复指定用户保存的微信连接
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
function restoreUserWechatConnection(userId: string): void {
    void wechatChannelService.getStatus(userId).catch((error: unknown) => {
        logger.warn('WechatChannel', '切换用户后恢复微信连接失败', {
            userId,
            error: error instanceof Error ? error.message : String(error)
        })
    })
}

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
            const previousUserId = await getCurrentUserId()
            if (previousUserId) await wechatChannelService.suspend(previousUserId)
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
            const previousUserId = await getCurrentUserId()
            if (previousUserId && previousUserId !== id) {
                await wechatChannelService.suspend(previousUserId)
            }
            await setCurrentUserId(id)
            restoreUserWechatConnection(id)
        }
    )

    registerIpcHandler(
        IPC_CHANNELS.user.delete,
        IPC_SCHEMAS.user.delete,
        '删除用户失败',
        async (_event, id) => {
            await wechatChannelService.removeUser(id)
            await deleteUser(id)
            await clearCurrentUserIfMatches(id)
        }
    )
}
