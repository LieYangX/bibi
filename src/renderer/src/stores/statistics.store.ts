/**
 * 统计状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MonthlyStatistics, AnnualStatistics } from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    isUserRequestCurrent
} from '../app/session/user-request-generation'

export type MonthlyStats = MonthlyStatistics

export const useStatisticsStore = defineStore('statistics', () => {
    const monthlyStats = ref<MonthlyStats | null>(null)
    const annualStats = ref<AnnualStatistics | null>(null)
    const currentYear = ref(new Date().getFullYear())
    const currentMonth = ref(new Date().getMonth() + 1)
    const loading = ref(false)
    const error = ref<string | null>(null)
    let latestRequestId = 0

    async function loadMonthly(year?: number, month?: number): Promise<void> {
        const requestId = ++latestRequestId
        const generation = captureUserRequestGeneration()
        const targetYear = year ?? currentYear.value
        const targetMonth = month ?? currentMonth.value
        currentYear.value = targetYear
        currentMonth.value = targetMonth
        loading.value = true
        error.value = null

        const result = await desktopApi.statistics.getMonthly(targetYear, targetMonth)
        if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return
        loading.value = false
        if (result.ok) {
            monthlyStats.value = result.data
        } else {
            error.value = result.error
        }
    }

    async function loadAnnual(year?: number): Promise<void> {
        const requestId = ++latestRequestId
        const generation = captureUserRequestGeneration()
        const targetYear = year ?? currentYear.value
        currentYear.value = targetYear
        loading.value = true
        error.value = null

        const result = await desktopApi.statistics.getAnnual(targetYear)
        if (requestId !== latestRequestId || !isUserRequestCurrent(generation)) return
        loading.value = false
        if (result.ok) {
            annualStats.value = result.data
        } else {
            error.value = result.error
        }
    }

    function goPrevMonth(): void {
        if (currentMonth.value === 1) {
            currentYear.value--
            currentMonth.value = 12
        } else {
            currentMonth.value--
        }
        void loadMonthly(currentYear.value, currentMonth.value)
    }

    function goNextMonth(): void {
        if (currentMonth.value === 12) {
            currentYear.value++
            currentMonth.value = 1
        } else {
            currentMonth.value++
        }
        void loadMonthly(currentYear.value, currentMonth.value)
    }

    function goPrevYear(): void {
        currentYear.value--
        void loadAnnual(currentYear.value)
    }

    function goNextYear(): void {
        currentYear.value++
        void loadAnnual(currentYear.value)
    }

    function reset(): void {
        latestRequestId++
        monthlyStats.value = null
        annualStats.value = null
        currentYear.value = new Date().getFullYear()
        currentMonth.value = new Date().getMonth() + 1
        loading.value = false
        error.value = null
    }

    return {
        monthlyStats,
        annualStats,
        currentYear,
        currentMonth,
        loading,
        error,
        loadMonthly,
        loadAnnual,
        goPrevMonth,
        goNextMonth,
        goPrevYear,
        goNextYear,
        reset
    }
})
