/**
 * IPC 处理器统一注册入口
 * @author xiangwei
 */

import { registerAccountIpc } from './account.ipc'
import { registerAppIpc } from './app.ipc'
import { registerBudgetIpc } from './budget.ipc'
import { registerCategoryIpc } from './category.ipc'
import { registerImportIpc } from './import.ipc'
import { registerSettingIpc } from './setting.ipc'
import { registerStatisticsIpc } from './statistics.ipc'
import { registerTransactionIpc } from './transaction.ipc'
import { registerUserIpc } from './user.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerAgentIpc } from '../agent/ipc/agent.ipc'
import { registerSttIpc } from './stt.ipc'
import { registerWeatherIpc } from './weather.ipc'

export function registerIpcHandlers(): void {
    registerUserIpc()
    registerAccountIpc()
    registerCategoryIpc()
    registerBudgetIpc()
    registerTransactionIpc()
    registerStatisticsIpc()
    registerWeatherIpc()
    registerImportIpc()
    registerSettingIpc()
    registerAppIpc()
    registerWindowIpc()
    registerAgentIpc()
    registerSttIpc()
}
