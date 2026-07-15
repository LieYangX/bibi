/**
 * 用户切换后的状态失效编排
 * @author xiangwei
 */

import { useAccountStore } from '../../stores/account.store'
import { useBudgetStore } from '../../stores/budget.store'
import { useCategoryStore } from '../../stores/category.store'
import { useStatisticsStore } from '../../stores/statistics.store'
import { useTransactionStore } from '../../stores/transaction.store'
import { useAgentStore } from '../../stores/agent.store'
import { invalidateUserRequests } from './user-request-generation'

/**
 * 清空所有用户隔离的数据缓存
 *
 * @author xiangwei
 */
export function resetUserData(): void {
    invalidateUserRequests()
    useAccountStore().reset()
    useBudgetStore().reset()
    useCategoryStore().reset()
    useStatisticsStore().reset()
    useTransactionStore().reset()
    useAgentStore().reset()
}
