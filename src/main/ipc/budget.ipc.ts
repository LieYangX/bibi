/**
 * 预算管理 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import {
    deleteBudget,
    getMonthBudgets,
    getYearBudgets,
    setBudget
} from '../services/budget.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerBudgetIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.budget.set,
        IPC_SCHEMAS.budget.set,
        '设置预算失败',
        (userId, _event, data) => setBudget(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.budget.getMonth,
        IPC_SCHEMAS.budget.getMonth,
        '获取预算失败',
        (userId, _event, year, month) => getMonthBudgets(userId, year, month)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.budget.delete,
        IPC_SCHEMAS.budget.delete,
        '删除预算失败',
        (userId, _event, id) => deleteBudget(id, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.budget.getYear,
        IPC_SCHEMAS.budget.getYear,
        '获取年度预算失败',
        (userId, _event, year) => getYearBudgets(userId, year)
    )
}
