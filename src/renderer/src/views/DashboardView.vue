<template>
    <div class="bb-page-container bb-page-container--medium">
        <PageHeader :title="pageTitle" subtitle="收支概览与支出排行">
            <template #actions>
                <div class="dashboard-actions">
                    <div class="mode-switch" role="group" aria-label="统计模式">
                        <button
                            class="mode-switch__btn"
                            :class="{ active: mode === 'month' }"
                            @click="switchMode('month')"
                        >
                            月度
                        </button>
                        <button
                            class="mode-switch__btn"
                            :class="{ active: mode === 'year' }"
                            @click="switchMode('year')"
                        >
                            年度
                        </button>
                    </div>
                    <div class="bb-month-nav">
                        <button class="bb-month-arrow" :title="navPrevTitle" @click="goPrev">
                            <ChevronLeft :size="18" />
                        </button>
                        <button class="bb-month-arrow" :title="navResetTitle" @click="goReset">
                            {{ mode === 'month' ? '本月' : '今年' }}
                        </button>
                        <button class="bb-month-arrow" :title="navNextTitle" @click="goNext">
                            <ChevronRight :size="18" />
                        </button>
                    </div>
                </div>
            </template>
        </PageHeader>

        <section
            class="weather-strip"
            :class="{ 'weather-strip--stale': weather?.isStale }"
            aria-label="当前天气"
        >
            <template v-if="weather">
                <div class="weather-strip__main">
                    <span class="weather-strip__icon" :class="weatherToneClass">
                        <component :is="weatherIcon" :size="25" aria-hidden="true" />
                    </span>
                    <div class="weather-strip__summary">
                        <div class="weather-strip__location">
                            <MapPin :size="12" aria-hidden="true" />
                            <span>{{ weatherLocation }}</span>
                        </div>
                        <div class="weather-strip__condition">
                            <strong>{{ weather.temperature }}°</strong>
                            <span>{{ weather.weather }}</span>
                        </div>
                        <div class="weather-strip__time">
                            {{ weather.reportTime || '刚刚更新' }}
                            <span v-if="weather.isStale"> · 缓存数据</span>
                        </div>
                    </div>
                </div>

                <div class="weather-strip__metrics" role="list" aria-label="天气指标">
                    <div class="weather-strip__metric" role="listitem">
                        <Droplets :size="15" aria-hidden="true" />
                        <span>湿度</span>
                        <strong>{{ weather.humidity }}%</strong>
                    </div>
                    <div class="weather-strip__metric" role="listitem">
                        <Wind :size="15" aria-hidden="true" />
                        <span>风力</span>
                        <strong>{{ weather.windDirection }} {{ weather.windPower }}</strong>
                    </div>
                </div>

                <div v-if="primaryWeatherAlert" class="weather-strip__alert">
                    <AlertTriangle :size="15" aria-hidden="true" />
                    <span :title="primaryWeatherAlert.title">{{ primaryWeatherAlert.title }}</span>
                    <small v-if="weather.alerts.length > 1">+{{ weather.alerts.length - 1 }}</small>
                </div>
                <div v-else class="weather-strip__status">天气平稳</div>

                <button
                    class="weather-strip__refresh"
                    title="刷新天气"
                    :disabled="weatherLoading"
                    @click="loadWeather(true)"
                >
                    <RefreshCw :size="15" :class="{ spinning: weatherLoading }" />
                </button>
            </template>

            <template v-else>
                <div class="weather-strip__placeholder">
                    <CloudOff v-if="weatherError" :size="20" aria-hidden="true" />
                    <CloudSun v-else :size="20" aria-hidden="true" />
                    <span>{{ weatherError ? '天气暂不可用' : '正在获取当地天气…' }}</span>
                </div>
                <button
                    class="weather-strip__refresh weather-strip__refresh--placeholder"
                    title="重新获取天气"
                    :disabled="weatherLoading"
                    @click="loadWeather(true)"
                >
                    <RefreshCw :size="15" :class="{ spinning: weatherLoading }" />
                </button>
            </template>
        </section>

        <div v-if="statisticsStore.error" class="dashboard-status is-error">
            <span>{{ statisticsStore.error }}</span>
            <button class="bb-btn bb-btn-sm" @click="reloadCurrent">重试</button>
        </div>
        <div v-if="statisticsStore.loading && !stats" class="dashboard-status">
            正在加载统计数据…
        </div>

        <template v-else-if="stats">
            <div class="stat-grid">
                <div
                    v-for="c in cards"
                    :key="c.label"
                    class="stat-card"
                    :style="{ '--card-color': c.color }"
                >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="stat-icon" v-html="c.icon" />
                    <div class="stat-body">
                        <div class="stat-label">{{ c.label }}</div>
                        <div class="stat-value">
                            <BbAmount
                                :value="c.valueCents"
                                :sign="c.sign"
                                :use-locale="c.useLocale"
                            />
                        </div>
                        <div v-if="c.sub" class="stat-sub">{{ c.sub }}</div>
                    </div>
                </div>
            </div>

            <div class="charts">
                <div class="chart-box">
                    <div class="chart-head">
                        <span class="chart-dot" style="background: var(--bb-accent)" />支出构成
                    </div>
                    <v-chart
                        v-if="hasExpenseData"
                        :option="pieOption"
                        autoresize
                        style="height: 300px"
                    />
                    <EmptyState v-else :text="mode === 'month' ? '本月暂无支出' : '本年暂无支出'" />
                </div>
                <div class="chart-box">
                    <div class="chart-head">
                        <span class="chart-dot" style="background: var(--bb-danger)" />{{
                            mode === 'month' ? '每日趋势' : '月度趋势'
                        }}
                    </div>
                    <v-chart
                        v-if="hasTrendData"
                        :option="barOption"
                        autoresize
                        style="height: 300px"
                    />
                    <EmptyState
                        v-else
                        :text="mode === 'month' ? '本月暂无支出流水' : '本年暂无支出流水'"
                    />
                </div>
            </div>

            <!-- 分类支出排行 -->
            <div class="rank-card">
                <div class="chart-head">
                    <span class="chart-dot" style="background: var(--bb-success)" />分类支出排行
                </div>
                <v-chart
                    v-if="hasExpenseData"
                    :option="rankOption"
                    autoresize
                    style="height: 300px"
                />
                <EmptyState v-else :text="mode === 'month' ? '本月暂无支出' : '本年暂无支出'" />
            </div>
            <div class="rank-card">
                <div class="chart-head">
                    <span class="chart-dot" style="background: var(--bb-success)" />分类收入排行
                </div>
                <v-chart
                    v-if="hasIncomeData"
                    :option="rankIncomeOption"
                    autoresize
                    style="height: 300px"
                />
                <EmptyState v-else :text="mode === 'month' ? '本月暂无收入' : '本年暂无收入'" />
            </div>

            <!-- 预算执行一览 -->
            <div class="budget-card">
                <div class="chart-head">
                    <span class="chart-dot" style="background: var(--bb-accent)" />预算执行一览
                </div>
                <template v-if="hasBudgetData">
                    <div v-for="b in budgetList" :key="b.id" class="budget-item">
                        <div class="budget-item__top">
                            <span class="budget-item__cat">{{ b.category_name || '总预算' }}</span>
                            <span class="budget-item__text">
                                <BbAmount :value="b.used_cents" /> /
                                <BbAmount :value="b.amount_cents" />
                            </span>
                        </div>
                        <BbProgress
                            :percent="Math.min(b.progress_pct, 100)"
                            :color="budgetColor(b.progress_pct)"
                        />
                        <div
                            class="budget-item__pct"
                            :style="{ color: budgetColor(b.progress_pct) }"
                        >
                            {{ b.progress_pct }}%<span v-if="b.progress_pct >= 100"> · 已超支</span>
                            <span v-else-if="b.progress_pct >= 80"> · 接近上限</span>
                        </div>
                    </div>
                </template>
                <EmptyState
                    v-else
                    text="暂无预算设定"
                    :hint="mode === 'month' ? '在预算页面设定每月预算' : '在预算页面设定年度预算'"
                />
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * 首页 Dashboard
 * 展示当月收支概览、支出构成饼图与每日趋势柱状图
 * @author xiangwei
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useStatisticsStore } from '../stores/statistics.store'
import { PageHeader, EmptyState, BbAmount } from '../components/common'
import { BbProgress } from '../components/ui'
import { onRefreshMany } from '../composables/useRefreshBus'
import { desktopApi } from '../api/desktop-api'
import type { WeatherSnapshot } from '@shared/types'
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Cloud,
    CloudFog,
    CloudLightning,
    CloudOff,
    CloudRain,
    CloudSun,
    Droplets,
    MapPin,
    RefreshCw,
    Snowflake,
    Sun,
    Wind
} from '@lucide/vue'

use([
    PieChart,
    BarChart,
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    CanvasRenderer
])

const statisticsStore = useStatisticsStore()
const mode = ref<'month' | 'year'>('month')
const weather = ref<WeatherSnapshot | null>(null)
const weatherLoading = ref(false)
const weatherError = ref('')

/** 当前天气定位文案 */
const weatherLocation = computed(() => {
    const parts = [weather.value?.city, weather.value?.district].filter(
        (part, index, values): part is string => !!part && values.indexOf(part) === index
    )
    return parts.join(' · ') || weather.value?.province || '当前位置'
})

/** 当前首条天气预警 */
const primaryWeatherAlert = computed(() => weather.value?.alerts[0] ?? null)

/** 根据天气现象选择图标 */
const weatherIcon = computed(() => {
    const condition = weather.value?.weather ?? ''
    if (/雷/.test(condition)) return CloudLightning
    if (/雪|冰雹/.test(condition)) return Snowflake
    if (/雨/.test(condition)) return CloudRain
    if (/雾|霾|沙|尘/.test(condition)) return CloudFog
    if (/多云/.test(condition)) return CloudSun
    if (/阴|云/.test(condition)) return Cloud
    return Sun
})

/** 天气图标色彩类型 */
const weatherToneClass = computed(() => {
    const condition = weather.value?.weather ?? ''
    if (/雷|雨/.test(condition)) return 'weather-strip__icon--rain'
    if (/雪|冰雹/.test(condition)) return 'weather-strip__icon--snow'
    if (/雾|霾|沙|尘/.test(condition)) return 'weather-strip__icon--muted'
    return 'weather-strip__icon--sunny'
})

/**
 * 加载首页天气
 *
 * @param forceRefresh 是否跳过主进程缓存
 * @author xiangwei
 */
async function loadWeather(forceRefresh: boolean = false): Promise<void> {
    if (weatherLoading.value) return
    weatherLoading.value = true
    weatherError.value = ''
    const result = await desktopApi.weather.getCurrent(forceRefresh)
    weatherLoading.value = false
    if (!result.ok) {
        weatherError.value = result.error
        return
    }
    weather.value = result.data
}

/** 当前统计数据源（月度／年度） */
const stats = computed(() =>
    mode.value === 'month' ? statisticsStore.monthlyStats : statisticsStore.annualStats
)

const pageTitle = computed(() => {
    if (mode.value === 'month') {
        return `${statisticsStore.currentYear} 年 ${statisticsStore.currentMonth} 月`
    }
    return `${statisticsStore.currentYear} 年`
})

const navPrevTitle = computed(() => (mode.value === 'month' ? '上个月' : '上一年'))
const navNextTitle = computed(() => (mode.value === 'month' ? '下个月' : '下一年'))
const navResetTitle = computed(() => (mode.value === 'month' ? '本月' : '今年'))

/** 切换统计模式 */
function switchMode(newMode: 'month' | 'year'): void {
    if (mode.value === newMode) return
    mode.value = newMode
    if (newMode === 'month') {
        void statisticsStore.loadMonthly()
    } else {
        void statisticsStore.loadAnnual()
    }
}

function goPrev(): void {
    if (mode.value === 'month') {
        statisticsStore.goPrevMonth()
    } else {
        statisticsStore.goPrevYear()
    }
}

function goNext(): void {
    if (mode.value === 'month') {
        statisticsStore.goNextMonth()
    } else {
        statisticsStore.goNextYear()
    }
}

function goReset(): void {
    const now = new Date()
    if (mode.value === 'month') {
        statisticsStore.loadMonthly(now.getFullYear(), now.getMonth() + 1)
    } else {
        statisticsStore.loadAnnual(now.getFullYear())
    }
}

/** 重新加载当前统计周期 */
function reloadCurrent(): void {
    if (mode.value === 'month') {
        void statisticsStore.loadMonthly()
    } else {
        void statisticsStore.loadAnnual()
    }
}

/** 首页统计卡片实心图标 SVG */
const cardIcons = {
    income: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20.287 14.693A.75.75 0 0 0 20.75 14V7a.75.75 0 0 0-.673-.746L20 6.25h-7a.75.75 0 0 0-.53 1.28l3 3.001l-1.849 1.88c-.316.318-.577.361-.86.32c-.365-.054-.764-.25-1.317-.526l-.016-.008c-.492-.245-1.13-.562-1.8-.632c-.753-.08-1.495.152-2.161.846l-4.001 4.063a.75.75 0 0 0 1.068 1.052l4.001-4.063l.01-.009c.354-.372.644-.427.927-.397c.36.037.76.22 1.303.49l.084.043c.47.235 1.069.534 1.684.625c.734.108 1.48-.079 2.146-.751l1.842-1.872l2.939 2.938a.75.75 0 0 0 .817.163"/></svg>',
    expense:
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20.75 10a.75.75 0 0 0-1.28-.53l-2.939 2.938l-1.842-1.872l-.002-.002c-.666-.672-1.41-.857-2.144-.749c-.652.096-1.286.427-1.768.667c-.543.27-.942.454-1.303.491c-.283.03-.573-.025-.928-.397l-.009-.009l-4-4.063a.75.75 0 0 0-1.07 1.052l4.002 4.063c.666.694 1.408.925 2.161.846c.678-.07 1.321-.394 1.816-.64c.553-.276.952-.472 1.317-.525c.283-.042.544 0 .86.32l1.85 1.879l-3.001 3A.75.75 0 0 0 13 17.75h7l.077-.004A.75.75 0 0 0 20.75 17z"/></svg>',
    balance:
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><g fill="none" fill-rule="evenodd"><path fill="currentColor" d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v1h.764a2 2 0 0 1 .894.211L16.236 6H20a1 1 0 1 1 0 2h-.382l2.276 4.553c.07.139.106.292.106.447a4 4 0 0 1-8 0c0-.155.036-.308.106-.447L16.382 8h-.146a2 2 0 0 1-.894-.211L13.764 7H13v12h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3V7h-.764l-1.578.789A2 2 0 0 1 7.764 8h-.146l2.276 4.553A1 1 0 0 1 10 13a4 4 0 0 1-8 0a1 1 0 0 1 .106-.447L4.382 8H4a1 1 0 0 1 0-2h3.764l1.578-.789A2 2 0 0 1 10.236 5H11V4a1 1 0 0 1 1-1"/></g></svg>',
    wallet: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.005 6h-7a6 6 0 0 0 0 12h7v2a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1zm-7 2h8v8h-8a4 4 0 1 1 0-8m0 3v2h3v-2z"/></svg>'
}

/** 是否有支出分类数据 */
const hasExpenseData = computed(() => (stats.value?.expense_categories || []).length > 0)
/** 是否有收入分类数据 */
const hasIncomeData = computed(() => (stats.value?.income_categories || []).length > 0)
/** 是否有预算数据 */
const hasBudgetData = computed(() => (stats.value?.budgets || []).length > 0)
/** 是否有每日/月度支出数据 */
const hasTrendData = computed(() => {
    if (mode.value === 'month') {
        return (statisticsStore.monthlyStats?.daily_expense || []).length > 0
    }
    return (statisticsStore.annualStats?.monthly_expense || []).length > 0
})
const budgetList = computed(() => stats.value?.budgets || [])
function budgetColor(pct: number): string {
    return pct >= 100 ? '#EF4444' : pct >= 80 ? '#EAB308' : '#16a34a'
}

const cards = computed(() => {
    const m = stats.value
    if (!m) {
        return [
            {
                label: '收入',
                valueCents: 0,
                color: 'var(--bb-success)',
                icon: cardIcons.income,
                useLocale: true
            },
            {
                label: '支出',
                valueCents: 0,
                color: 'var(--bb-danger)',
                icon: cardIcons.expense,
                useLocale: true
            },
            {
                label: '结余',
                valueCents: 0,
                color: 'var(--bb-success)',
                icon: cardIcons.balance,
                useLocale: true
            },
            {
                label: '总余额',
                valueCents: 0,
                color: 'var(--bb-accent)',
                icon: cardIcons.wallet,
                useLocale: true
            }
        ]
    }
    const bal = m.balance_cents || 0
    return [
        {
            label: '收入',
            valueCents: m.total_income_cents || 0,
            color: 'var(--bb-success)',
            icon: cardIcons.income,
            useLocale: true
        },
        {
            label: '支出',
            valueCents: m.total_expense_cents || 0,
            color: 'var(--bb-danger)',
            icon: cardIcons.expense,
            useLocale: true
        },
        {
            label: '结余',
            valueCents: Math.abs(bal),
            sign: bal >= 0 ? '+' : '-',
            color: bal >= 0 ? 'var(--bb-success)' : 'var(--bb-danger)',
            icon: cardIcons.balance,
            sub: bal >= 0 ? '收大于支' : '超支',
            useLocale: true
        },
        {
            label: '总余额',
            valueCents: m.total_balance_cents || 0,
            color: 'var(--bb-accent)',
            icon: cardIcons.wallet,
            useLocale: true
        }
    ]
})

const colors = [
    '#EAB308',
    '#EF4444',
    '#16A34A',
    '#D9A404',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
    '#6366F1',
    '#14B8A6'
]

const pieOption = computed(() => {
    const cats = stats.value?.expense_categories || []
    return {
        tooltip: {
            trigger: 'item',
            formatter: (p: { name: string; value: number; percent: number }) => {
                // 统计图金额始终直接显示，不随全局脱敏开关变化
                const value = `¥${p.value.toFixed(2)}`
                return `${p.name}: ${value} (${p.percent}%)`
            },
            backgroundColor: '#fff',
            borderColor: '#E2E8F0',
            textStyle: { color: '#0F172A', fontSize: 13 },
            extraCssText: 'border-radius:8px;border:1px solid #E2E8F0'
        },
        legend: {
            orient: 'vertical',
            right: '2%',
            top: 'center',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 12,
            textStyle: { fontSize: 12, color: '#64748B' }
        },
        color: colors,
        series: [
            {
                type: 'pie',
                radius: ['50%', '78%'],
                center: ['38%', '50%'],
                itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
                label: { show: false },
                emphasis: { scaleSize: 8, label: { show: true, fontWeight: 'bold' } },
                data: cats.map((c) => ({
                    name: c.category_name,
                    value: (c.amount_cents || 0) / 100
                }))
            }
        ]
    }
})

const barOption = computed(() => {
    const monthNames = [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月'
    ]
    if (mode.value === 'month') {
        const daily = statisticsStore.monthlyStats?.daily_expense || []
        return {
            tooltip: {
                trigger: 'axis',
                formatter: (p: { axisValue: string; value: number }[]) => {
                    const value = `¥${p[0].value.toFixed(2)}`
                    return `${p[0].axisValue}日  ${value}`
                },
                backgroundColor: '#fff',
                borderColor: '#E2E8F0',
                textStyle: { color: '#0F172A', fontSize: 13 },
                extraCssText: 'border-radius:8px;border:1px solid #E2E8F0'
            },
            grid: { top: 16, right: 16, bottom: 8, left: 0, containLabel: true },
            xAxis: {
                type: 'category',
                data: daily.map((d) => (d.date || '').slice(-5)),
                axisLine: { lineStyle: { color: '#E2E8F0' } },
                axisLabel: { color: '#94A3B8', fontSize: 11 },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: '#F1F5F9' } },
                axisLabel: { show: false }
            },
            series: [
                {
                    type: 'bar',
                    data: daily.map((d) => parseFloat(((d.amount_cents || 0) / 100).toFixed(2))),
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#d9a404' },
                                { offset: 1, color: '#fef08a' }
                            ]
                        }
                    },
                    barWidth: 18,
                    emphasis: { itemStyle: { color: '#d9a404' } }
                }
            ]
        }
    }
    // 年度模式：月度支出趋势
    const monthly = statisticsStore.annualStats?.monthly_expense || []
    return {
        tooltip: {
            trigger: 'axis',
            formatter: (p: { axisValue: string; value: number }[]) => {
                const value = `¥${p[0].value.toFixed(2)}`
                return `${p[0].axisValue}  ${value}`
            },
            backgroundColor: '#fff',
            borderColor: '#E2E8F0',
            textStyle: { color: '#0F172A', fontSize: 13 },
            extraCssText: 'border-radius:8px;border:1px solid #E2E8F0'
        },
        grid: { top: 16, right: 16, bottom: 8, left: 0, containLabel: true },
        xAxis: {
            type: 'category',
            data: monthly.map((d) => monthNames[d.month - 1]),
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { color: '#94A3B8', fontSize: 11 },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#F1F5F9' } },
            axisLabel: { show: false }
        },
        series: [
            {
                type: 'bar',
                data: monthly.map((d) => parseFloat(((d.amount_cents || 0) / 100).toFixed(2))),
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: '#d9a404' },
                            { offset: 1, color: '#fef08a' }
                        ]
                    }
                },
                barWidth: 18,
                emphasis: { itemStyle: { color: '#d9a404' } }
            }
        ]
    }
})

/** 分类排行横向柱状图 */
const rankOption = computed(() => {
    const cats = stats.value?.expense_categories || []
    // 按金额降序排列
    const sorted = [...cats].sort((a, b) => b.amount_cents - a.amount_cents)
    return {
        tooltip: {
            trigger: 'axis',
            formatter: (p: { axisValue: string; value: number }[]) => {
                const value = `¥${p[0].value.toFixed(2)}`
                return `${p[0].axisValue}: ${value}`
            },
            backgroundColor: '#fff',
            borderColor: '#E2E8F0',
            textStyle: { color: '#0F172A', fontSize: 13 },
            extraCssText: 'border-radius:8px;border:1px solid #E2E8F0'
        },
        grid: { top: 8, right: 60, bottom: 8, left: 0, containLabel: true },
        xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#F1F5F9' } },
            axisLabel: {
                color: '#94A3B8',
                fontSize: 11,
                formatter: (v: number) => `¥${v}`
            }
        },
        yAxis: {
            type: 'category',
            data: sorted.map((c) => c.category_name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#64748B', fontSize: 12, fontWeight: 600 },
            inverse: true
        },
        series: [
            {
                type: 'bar',
                data: sorted.map((c) => ({
                    value: parseFloat(((c.amount_cents || 0) / 100).toFixed(2)),
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 1,
                            y2: 0,
                            colorStops: [
                                { offset: 0, color: '#d9a404' },
                                { offset: 1, color: '#fef08a' }
                            ]
                        },
                        borderRadius: [0, 6, 6, 0]
                    }
                })),
                barWidth: 20,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (p: { value: number }) => `¥${p.value.toFixed(2)}`,
                    color: '#64748B',
                    fontSize: 11,
                    fontFamily: 'var(--bb-font-mono)'
                },
                emphasis: { itemStyle: { color: '#d9a404' } }
            }
        ]
    }
})

/** 分类收入排行横向柱状图 */
const rankIncomeOption = computed(() => {
    const cats = stats.value?.income_categories || []
    const sorted = [...cats].sort((a, b) => b.amount_cents - a.amount_cents)
    return {
        tooltip: {
            trigger: 'axis',
            formatter: (p: { axisValue: string; value: number }[]) => {
                const value = `¥${p[0].value.toFixed(2)}`
                return `${p[0].axisValue}: ${value}`
            },
            backgroundColor: '#fff',
            borderColor: '#E2E8F0',
            textStyle: { color: '#0F172A', fontSize: 13 },
            extraCssText: 'border-radius:8px;border:1px solid #E2E8F0'
        },
        grid: { top: 8, right: 60, bottom: 8, left: 0, containLabel: true },
        xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#F1F5F9' } },
            axisLabel: {
                color: '#94A3B8',
                fontSize: 11,
                formatter: (v: number) => `¥${v}`
            }
        },
        yAxis: {
            type: 'category',
            data: sorted.map((c) => c.category_name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#64748B', fontSize: 12, fontWeight: 600 },
            inverse: true
        },
        series: [
            {
                type: 'bar',
                data: sorted.map((c) => ({
                    value: parseFloat(((c.amount_cents || 0) / 100).toFixed(2)),
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 1,
                            y2: 0,
                            colorStops: [
                                { offset: 0, color: '#16A34A' },
                                { offset: 1, color: '#BBF7D0' }
                            ]
                        },
                        borderRadius: [0, 6, 6, 0]
                    }
                })),
                barWidth: 20,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (p: { value: number }) => `¥${p.value.toFixed(2)}`,
                    color: '#64748B',
                    fontSize: 11,
                    fontFamily: 'var(--bb-font-mono)'
                },
                emphasis: { itemStyle: { color: '#16A34A' } }
            }
        ]
    }
})

let offRefresh: () => void
onMounted(async () => {
    await Promise.all([statisticsStore.loadMonthly(), loadWeather()])
    // 记账 / 预算变更后自动刷新当月统计
    offRefresh = onRefreshMany(['transaction', 'budget'], () => {
        if (mode.value === 'month') {
            void statisticsStore.loadMonthly()
        } else {
            void statisticsStore.loadAnnual()
        }
    })
})
onUnmounted(() => offRefresh?.())
</script>

<style scoped>
.weather-strip {
    display: grid;
    min-height: 82px;
    grid-template-columns: minmax(190px, 1fr) auto minmax(110px, 0.8fr) 32px;
    align-items: center;
    gap: 18px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid var(--bb-border);
    border-left: 3px solid var(--bb-accent);
    border-radius: 8px;
    background: var(--bb-bg-card);
}

.weather-strip--stale {
    border-left-color: var(--bb-warning);
}

.weather-strip__main {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 11px;
}

.weather-strip__icon {
    display: inline-flex;
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
}

.weather-strip__icon--sunny {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
}

.weather-strip__icon--rain {
    background: var(--bb-info-light);
    color: var(--bb-info);
}

.weather-strip__icon--snow {
    background: rgba(14, 165, 233, 0.1);
    color: #0284c7;
}

.weather-strip__icon--muted {
    background: var(--bb-bg-input);
    color: var(--bb-text-secondary);
}

.weather-strip__summary {
    min-width: 0;
}

.weather-strip__location {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
    color: var(--bb-text-secondary);
    font-size: 11px;
}

.weather-strip__location span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.weather-strip__condition {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin-top: 1px;
}

.weather-strip__condition strong {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 24px;
    font-weight: var(--bb-weight-bold);
    line-height: 1.2;
}

.weather-strip__condition span {
    color: var(--bb-text-primary);
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
}

.weather-strip__time {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
    white-space: nowrap;
}

.weather-strip__metrics {
    display: flex;
    align-items: stretch;
    border-right: 1px solid var(--bb-border-light);
    border-left: 1px solid var(--bb-border-light);
}

.weather-strip__metric {
    display: grid;
    min-width: 84px;
    grid-template-columns: 18px auto;
    align-items: center;
    column-gap: 4px;
    padding: 1px 14px;
    color: var(--bb-text-tertiary);
}

.weather-strip__metric + .weather-strip__metric {
    border-left: 1px solid var(--bb-border-light);
}

.weather-strip__metric svg {
    grid-row: 1 / span 2;
    color: var(--bb-text-secondary);
}

.weather-strip__metric span {
    font-size: 10px;
    line-height: 1.2;
}

.weather-strip__metric strong {
    color: var(--bb-text-primary);
    font-size: 11px;
    font-weight: var(--bb-weight-semibold);
    line-height: 1.4;
    white-space: nowrap;
}

.weather-strip__alert {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 6px;
    color: var(--bb-warning);
    font-size: 11px;
}

.weather-strip__alert svg {
    flex: 0 0 auto;
}

.weather-strip__alert span {
    overflow: hidden;
    color: var(--bb-text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.weather-strip__alert small {
    flex: 0 0 auto;
    font-family: var(--bb-font-mono);
}

.weather-strip__status {
    color: var(--bb-success);
    font-size: 11px;
    text-align: right;
}

.weather-strip__refresh {
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.weather-strip__refresh:hover:not(:disabled) {
    background: var(--bb-bg-hover);
    color: var(--bb-accent-text);
}

.weather-strip__refresh:disabled {
    cursor: wait;
    opacity: 0.6;
}

.weather-strip__placeholder {
    display: flex;
    grid-column: 1 / 4;
    align-items: center;
    gap: 9px;
    color: var(--bb-text-tertiary);
    font-size: 12px;
}

.weather-strip__refresh--placeholder {
    grid-column: 4;
}

.spinning {
    animation: weather-spin 0.9s linear infinite;
}

@keyframes weather-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 800px) {
    .weather-strip {
        grid-template-columns: minmax(170px, 1fr) auto 32px;
        gap: 12px;
    }

    .weather-strip__metrics {
        border-right: 0;
    }

    .weather-strip__alert,
    .weather-strip__status {
        grid-column: 1 / 3;
        grid-row: 2;
        padding-top: 8px;
        border-top: 1px solid var(--bb-border-light);
        text-align: left;
    }

    .weather-strip__refresh {
        grid-column: 3;
        grid-row: 1;
    }

    .weather-strip__placeholder {
        grid-column: 1 / 3;
    }
}

@media (max-width: 560px) {
    .weather-strip {
        grid-template-columns: 1fr 32px;
    }

    .weather-strip__metrics {
        grid-column: 1 / 3;
        grid-row: 2;
        justify-content: flex-start;
        padding-top: 10px;
        border: 0;
        border-top: 1px solid var(--bb-border-light);
    }

    .weather-strip__metric:first-child {
        padding-left: 0;
    }

    .weather-strip__alert,
    .weather-strip__status {
        grid-column: 1 / 3;
        grid-row: 3;
    }
}

.dashboard-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    background: var(--bb-bg-input);
    height: 36px;
}

.mode-switch__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.mode-switch__btn.active {
    background: var(--bb-bg-elevated);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-sm);
}

.bb-month-nav {
    gap: 10px;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 22px;
}
@media (max-width: 900px) {
    .stat-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 480px) {
    .stat-grid {
        grid-template-columns: 1fr;
    }
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    padding: 20px 18px;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
    /* 建立容器查询上下文，让金额字号随卡片宽度自适应 */
    container-type: inline-size;
}
.stat-card:hover {
    transform: translateY(-1px);
}

.stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--card-color) 10%, transparent);
    color: var(--card-color);
    flex-shrink: 0;
}
.stat-body {
    min-width: 0;
}
.stat-label {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    font-weight: 500;
    letter-spacing: 0.02em;
}
.stat-value {
    font-family: var(--bb-font-mono);
    /* 字号随卡片容器宽度自适应，配合 nowrap 避免长金额在 ¥ 后换行 */
    font-size: clamp(13px, 8cqw, 22px);
    font-weight: 700;
    color: var(--card-color);
    font-variant-numeric: tabular-nums;
    margin: 2px 0;
    letter-spacing: -0.02em;
    white-space: nowrap;
}
.stat-sub {
    font-size: 11px;
    color: var(--bb-text-tertiary);
}

.charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-width: 0;
}
@media (max-width: 760px) {
    .charts {
        grid-template-columns: 1fr;
    }
}
.chart-box {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    padding: 20px 24px;
    min-width: 0;
    overflow: hidden;
}
.chart-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--bb-text-primary);
    margin-bottom: 4px;
}
.chart-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.rank-card {
    margin-top: 16px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    padding: 20px 24px;
    min-width: 0;
    overflow: hidden;
}

.budget-card {
    margin-top: 16px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    padding: 20px 24px;
    min-width: 0;
    overflow: hidden;
}

.budget-item {
    padding: 12px 0;
}

.budget-item + .budget-item {
    border-top: 1px solid var(--bb-border);
}

.budget-item__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.budget-item__cat {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}

.budget-item__text {
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-secondary);
    font-family: var(--bb-font-mono);
}

.budget-item__pct {
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
    font-family: var(--bb-font-mono);
    margin-top: 6px;
}
.dashboard-status {
    display: flex;
    min-height: 180px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--bb-text-tertiary);
    font-size: 13px;
}
.dashboard-status.is-error {
    min-height: 52px;
    margin-bottom: 14px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.06);
    color: var(--bb-danger);
}
</style>
