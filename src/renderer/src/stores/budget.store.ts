/**
 * 预算状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BudgetWithProgress, SetBudgetDTO } from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    isUserRequestCurrent
} from '../app/session/user-request-generation'

export type BudgetInfo = BudgetWithProgress

export const useBudgetStore = defineStore('budget', () => {
    const budgets = ref<BudgetInfo[]>([])
    const yearBudgets = ref<BudgetInfo[]>([])

    async function loadBudgets(year: number, month: number): Promise<void> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.budget.getMonth(year, month)
        if (result.ok && isUserRequestCurrent(generation)) {
            budgets.value = result.data
        }
    }

    async function loadYearBudgets(year: number): Promise<void> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.budget.getYear(year)
        if (result.ok && isUserRequestCurrent(generation)) {
            yearBudgets.value = result.data
        }
    }

    async function setBudget(data: SetBudgetDTO): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.budget.set(data)
        return result.ok && isUserRequestCurrent(generation)
    }

    async function deleteBudget(id: string): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.budget.delete(id)
        return result.ok && isUserRequestCurrent(generation)
    }

    function reset(): void {
        budgets.value = []
        yearBudgets.value = []
    }

    return { budgets, yearBudgets, loadBudgets, loadYearBudgets, setBudget, deleteBudget, reset }
})
