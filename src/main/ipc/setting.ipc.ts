/**
 * 系统设置 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { getSetting, setSetting } from '../services/setting.service'
import { registerIpcHandler } from './handle-ipc'

export function registerSettingIpc(): void {
    registerIpcHandler(
        IPC_CHANNELS.setting.get,
        IPC_SCHEMAS.setting.get,
        '获取设置失败',
        (_event, key, defaultValue) => getSetting(key, defaultValue)
    )
    registerIpcHandler(
        IPC_CHANNELS.setting.set,
        IPC_SCHEMAS.setting.set,
        '保存设置失败',
        async (_event, key, value) => setSetting(key, value)
    )
}
