/**
 * 统计概览 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { getMonthlyStatistics, getAnnualStatistics } from '../services/statistics.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerStatisticsIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.statistics.getMonthly,
        IPC_SCHEMAS.statistics.getMonthly,
        '获取统计失败',
        (userId, _event, year, month) => getMonthlyStatistics(userId, year, month)
    )

    registerUserIpcHandler(
        IPC_CHANNELS.statistics.getAnnual,
        IPC_SCHEMAS.statistics.getAnnual,
        '获取年度统计失败',
        (userId, _event, year) => getAnnualStatistics(userId, year)
    )
}
