/**
 * 天气信息 IPC
 *
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { getCurrentWeather } from '../services/weather.service'
import { registerIpcHandler } from './handle-ipc'

/**
 * 注册天气 IPC 处理器
 *
 * @author xiangwei
 */
export function registerWeatherIpc(): void {
    registerIpcHandler(
        IPC_CHANNELS.weather.getCurrent,
        IPC_SCHEMAS.weather.getCurrent,
        '获取天气失败',
        (_event, forceRefresh) => getCurrentWeather(forceRefresh)
    )
}
