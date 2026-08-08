/**
 * Tool Server IPC 处理器
 *
 * 向渲染进程暴露 Tool Server 的开关、配对码、设备管理能力。
 *
 * @author xiangwei
 */

import { z } from 'zod'
import { registerIpcHandler } from './handle-ipc'
import { getSetting, setSetting } from '../services/setting.service'
import { startToolServer, stopToolServer } from '../tool-server'
import {
    generatePairingCode,
    listPairedDevices,
    revokeDevice
} from '../tool-server/pairing'
import { logger } from '../utils/logger'

/**
 * 注册 Tool Server 相关 IPC 处理器
 *
 * @author xiangwei
 */
export function registerToolServerIpc(): void {
    // 获取开关状态
    registerIpcHandler(
        'tool-server:getStatus',
        z.tuple([]),
        '获取状态失败',
        async () => {
            const enabled = (await getSetting<boolean>('tool_server_enabled')) ?? false
            return { enabled }
        }
    )

    // 切换开关
    registerIpcHandler(
        'tool-server:toggle',
        z.tuple([z.boolean()]),
        '切换失败',
        async (_event, enable) => {
            const current = (await getSetting<boolean>('tool_server_enabled')) ?? false

            if (enable === current) {
                return { enabled: enable }
            }

            if (enable) {
                await startToolServer()
            } else {
                await stopToolServer()
            }

            await setSetting('tool_server_enabled', enable)
            logger.info('ToolServer', '开关已切换', { enabled: enable })

            return { enabled: enable }
        }
    )

    // 生成配对码
    registerIpcHandler(
        'tool-server:generateCode',
        z.tuple([]),
        '生成配对码失败',
        async () => {
            const code = await generatePairingCode()
            return { code, expiresIn: 300 }
        }
    )

    // 已配对设备列表
    registerIpcHandler(
        'tool-server:listDevices',
        z.tuple([]),
        '获取设备列表失败',
        async () => {
            return listPairedDevices()
        }
    )

    // 撤销设备
    registerIpcHandler(
        'tool-server:revokeDevice',
        z.tuple([z.string()]),
        '撤销设备失败',
        async (_event, token) => {
            await revokeDevice(token)
            return null
        }
    )
}
