<template>
    <aside class="context-panel">
        <div class="context-panel__head">
            <span class="context-panel__title">今日速览</span>
            <button
                class="context-panel__eye"
                type="button"
                :title="amountMaskEnabled ? '显示金额' : '金额脱敏'"
                @click="toggleAmountMask"
            >
                <EyeOff v-if="amountMaskEnabled" :size="16" />
                <Eye v-else :size="16" />
            </button>
        </div>

        <!-- 今日天气 -->
        <div
            class="ctx-weather"
            :class="{ 'ctx-weather--stale': weather?.isStale }"
            aria-label="当前天气"
        >
            <template v-if="weather">
                <div class="ctx-weather__main">
                    <span class="ctx-weather__icon" :class="weatherToneClass">
                        <component :is="weatherIcon" :size="20" aria-hidden="true" />
                    </span>
                    <div class="ctx-weather__info">
                        <div class="ctx-weather__location">
                            <MapPin :size="10" aria-hidden="true" />
                            <span>{{ weatherLocation }}</span>
                        </div>
                        <div class="ctx-weather__condition">
                            <strong>{{ weather.temperature }}°</strong>
                            <span>{{ weather.weather }}</span>
                        </div>
                    </div>
                    <button
                        class="ctx-weather__refresh"
                        title="刷新天气"
                        :disabled="weatherLoading"
                        @click="loadWeather(true)"
                    >
                        <RefreshCw :size="13" :class="{ spinning: weatherLoading }" />
                    </button>
                </div>
                <div class="ctx-weather__meta">
                    <span>
                        <Droplets :size="11" aria-hidden="true" />
                        {{ weather.humidity }}%
                    </span>
                    <span>
                        <Wind :size="11" aria-hidden="true" />
                        {{ weather.windDirection }} {{ weather.windPower }}
                    </span>
                    <span v-if="weather.isStale" class="ctx-weather__cache">缓存</span>
                </div>
                <div v-if="weather.alerts.length" class="ctx-weather__alert">
                    <span>{{ weather.alerts[0].title }}</span>
                </div>
            </template>
            <template v-else>
                <div class="ctx-weather__placeholder">
                    <CloudOff v-if="weatherError" :size="16" aria-hidden="true" />
                    <CloudSun v-else :size="16" aria-hidden="true" />
                    <span>{{ weatherError ? '天气暂不可用' : '获取天气…' }}</span>
                </div>
                <button
                    class="ctx-weather__refresh"
                    title="重新获取天气"
                    :disabled="weatherLoading"
                    @click="loadWeather(true)"
                >
                    <RefreshCw :size="13" :class="{ spinning: weatherLoading }" />
                </button>
            </template>
        </div>

        <!-- 本月收支速览 -->
        <div class="ctx-stat-grid">
            <div class="ctx-stat-card">
                <span class="ctx-stat-label">本月支出</span>
                <div class="ctx-stat-row">
                    <BbAmount class="ctx-stat-amount" :value="monthExpense" :use-locale="true" />
                    <span class="ctx-trend ctx-trend--down">
                        <TrendingDown :size="11" />
                        环比 ↓8%
                    </span>
                </div>
            </div>
            <div class="ctx-stat-card">
                <span class="ctx-stat-label">本月收入</span>
                <div class="ctx-stat-row">
                    <BbAmount
                        class="ctx-stat-amount ctx-stat-amount--income"
                        :value="monthIncome"
                        :use-locale="true"
                    />
                </div>
            </div>
        </div>

        <!-- 预算执行 -->
        <section class="ctx-section">
            <div class="ctx-section__head">预算执行 · {{ currentMonthLabel }}</div>
            <div v-if="budgetList.length" class="ctx-budget-list">
                <div v-for="budget in budgetList" :key="budget.id" class="ctx-budget-row">
                    <span class="ctx-budget-name">{{ budgetLabel(budget) }}</span>
                    <BbProgress
                        class="ctx-budget-track"
                        :percent="budget.progress_pct"
                        :color="budgetColor(budget.progress_pct)"
                    />
                    <span class="ctx-budget-pct">{{ budget.progress_pct }}%</span>
                </div>
            </div>
            <div v-else class="ctx-empty-inline">暂无预算</div>
        </section>

        <!-- 最近流水 -->
        <section class="ctx-section">
            <div class="ctx-section__head ctx-section__head--row">
                <span>最近流水</span>
                <router-link class="ctx-section__more" to="/detail">查看全部 -></router-link>
            </div>
            <div v-if="recentTransactions.length" class="ctx-tx-list">
                <div v-for="tx in recentTransactions" :key="tx.id" class="ctx-tx-row">
                    <span class="ctx-tx-dot" :style="{ background: txDotColor(tx) }" />
                    <span class="ctx-tx-name">{{ txLabel(tx) }}</span>
                    <BbAmount
                        class="ctx-tx-amount"
                        :class="{ 'ctx-tx-amount--expense': tx.type === 'expense' }"
                        :value="tx.amount_cents"
                        :sign="tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''"
                    />
                </div>
            </div>
            <div v-else class="ctx-empty-inline">暂无流水</div>
        </section>

        <!-- 智能体任务进度（绑定当前会话，切换会话自动重载） -->
        <section v-if="agentStore.currentConversationId" class="ctx-section">
            <div class="ctx-section__head ctx-section__head--row">
                <span>小笔待办</span>
                <span v-if="agentTasks.length" class="ctx-task-count">
                    {{ completedTaskCount }}/{{ agentTasks.length }}
                </span>
            </div>
            <BbProgress
                v-if="agentTasks.length > 0"
                class="ctx-task-track"
                :percent="taskProgressPercent"
                color="var(--bb-accent)"
            />
            <div v-if="agentTasks.length" class="ctx-task-list">
                <div v-for="task in agentTasks" :key="task.id" class="ctx-task-row">
                    <span
                        class="ctx-task-check"
                        :class="{ 'is-done': task.status === 'completed' }"
                    >
                        <Check v-if="task.status === 'completed'" :size="10" />
                    </span>
                    <span
                        class="ctx-task-title"
                        :class="{ 'is-done': task.status === 'completed' }"
                    >
                        {{ task.title }}
                    </span>
                </div>
            </div>
            <div v-else class="ctx-empty-inline">暂无进行中的任务</div>
        </section>

        <!-- 导入草稿提醒 -->
        <router-link v-if="importStore.draftItemCount > 0" class="ctx-alert" to="/import">
            <Lightbulb :size="15" />
            <span>导入草稿 {{ importStore.draftItemCount }} 条待确认</span>
            <ChevronRight :size="14" class="ctx-alert__arrow" />
        </router-link>
    </aside>
</template>

<script setup lang="ts">
/**
 * 右侧今日速览面板
 * 展示本月收支、预算执行、最近流水与导入草稿提醒
 * 数据通过各领域 store 加载，并订阅刷新总线保持实时
 * @author xiangwei
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
    Eye,
    EyeOff,
    TrendingDown,
    Lightbulb,
    ChevronRight,
    MapPin,
    RefreshCw,
    Sun,
    Cloud,
    CloudSun,
    CloudRain,
    CloudLightning,
    CloudFog,
    Snowflake,
    CloudOff,
    Droplets,
    Wind,
    Check
} from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { BbAmount } from './common'
import { BbProgress } from './ui'
import { useStatisticsStore } from '../stores/statistics.store'
import { useTransactionStore } from '../stores/transaction.store'
import { useBudgetStore } from '../stores/budget.store'
import { useImportStore } from '../stores/import.store'
import { useSettingStore } from '../stores/setting.store'
import { useAgentStore } from '../stores/agent.store'
import { onRefreshMany } from '../composables/useRefreshBus'
import { desktopApi } from '../api/desktop-api'
import { formatLocalDate } from '../utils/date'
import type { BudgetWithProgress, Transaction, WeatherSnapshot } from '@shared/types'

const statisticsStore = useStatisticsStore()
const transactionStore = useTransactionStore()
const budgetStore = useBudgetStore()
const importStore = useImportStore()
const settingStore = useSettingStore()
const agentStore = useAgentStore()
const { amountMaskEnabled } = storeToRefs(settingStore)

const monthExpense = computed(() => statisticsStore.monthlyStats?.total_expense_cents ?? 0)
const monthIncome = computed(() => statisticsStore.monthlyStats?.total_income_cents ?? 0)
const recentTransactions = computed(() => transactionStore.transactions.slice(0, 3))
const budgetList = computed(() =>
    budgetStore.budgets
        .slice()
        .sort((a, b) => b.progress_pct - a.progress_pct)
        .slice(0, 3)
)

// ── 智能体任务（绑定当前会话，切换会话自动重载） ──
const agentTasks = computed(() => agentStore.currentTasks)
const completedTaskCount = computed(
    () => agentTasks.value.filter((t) => t.status === 'completed').length
)
const taskProgressPercent = computed(() =>
    agentTasks.value.length === 0
        ? 0
        : Math.round((completedTaskCount.value / agentTasks.value.length) * 100)
)
watch(
    () => agentStore.currentConversationId,
    (newId) => {
        if (newId) {
            void agentStore.loadTasks(newId)
        } else {
            agentStore.clearTasks()
        }
    },
    { immediate: true }
)

// ── 天气 ──
const weather = ref<WeatherSnapshot | null>(null)
const weatherLoading = ref(false)
const weatherError = ref('')

const weatherLocation = computed(() => {
    const parts = [weather.value?.city, weather.value?.district].filter(
        (part, index, values): part is string => !!part && values.indexOf(part) === index
    )
    return parts.join(' · ') || weather.value?.province || '当前位置'
})

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

const weatherToneClass = computed(() => {
    const condition = weather.value?.weather ?? ''
    if (/雷|雨/.test(condition)) return 'ctx-weather__icon--rain'
    if (/雪|冰雹/.test(condition)) return 'ctx-weather__icon--snow'
    if (/雾|霾|沙|尘/.test(condition)) return 'ctx-weather__icon--muted'
    return 'ctx-weather__icon--sunny'
})

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

const currentMonthLabel = computed(() => {
    const now = new Date()
    return `${now.getMonth() + 1} 月`
})

/**
 * 根据预算执行百分比选择进度条颜色
 *
 * @param pct 执行百分比
 * @returns 颜色值
 * @author xiangwei
 */
function budgetColor(pct: number): string {
    if (pct >= 100) return '#EF4444'
    if (pct >= 80) return '#EAB308'
    return '#16a34a'
}

/**
 * 获取预算条目展示名称
 *
 * @param budget 预算条目
 * @returns 分类名称或「总预算」
 * @author xiangwei
 */
function budgetLabel(budget: BudgetWithProgress): string {
    return budget.category_name || '总预算'
}

/**
 * 根据分类颜色或流水类型获取圆点颜色
 *
 * @param tx 流水条目
 * @returns 颜色值
 * @author xiangwei
 */
function txDotColor(tx: Transaction): string {
    if (tx.category_color) return tx.category_color
    if (tx.type === 'expense') return 'var(--bb-danger)'
    if (tx.type === 'income') return 'var(--bb-success)'
    return 'var(--bb-accent)'
}

/**
 * 获取流水展示名称
 *
 * @param tx 流水条目
 * @returns 分类或备注名称
 * @author xiangwei
 */
function txLabel(tx: Transaction): string {
    return tx.category_name || tx.note || (tx.type === 'income' ? '收入' : '支出')
}

/**
 * 加载面板所需的本月收支、预算与最近流水
 *
 * @author xiangwei
 */
async function loadData(): Promise<void> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = formatLocalDate(now)
    await Promise.all([
        statisticsStore.loadMonthly(year, month),
        budgetStore.loadBudgets(year, month),
        transactionStore.loadTransactions({
            start_date: startDate,
            end_date: endDate,
            sort_field: 'date',
            sort_order: 'desc',
            page_size: 3
        }),
        loadWeather()
    ])
}

/**
 * 切换全局金额脱敏开关
 *
 * @author xiangwei
 */
function toggleAmountMask(): void {
    void settingStore.saveAmountMask(!amountMaskEnabled.value)
}

onMounted(() => {
    void loadData()
    void settingStore.loadAmountMask()
})

let offRefresh = onRefreshMany(['transaction', 'budget'], () => void loadData())
onUnmounted(() => offRefresh?.())
</script>

<style scoped>
.context-panel {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 16px;
    background: var(--bb-bg-card);
    border-left: 1px solid var(--bb-border);
    overflow: hidden;
}

.context-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.context-panel__title {
    font-size: 15px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
}
.context-panel__eye {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--bb-radius-sm);
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition:
        background var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease);
}
.context-panel__eye:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-secondary);
}

/* 收支速览卡片 */
.ctx-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.ctx-stat-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
    cursor: default;
    transition:
        transform var(--bb-duration-fast) var(--bb-ease),
        box-shadow var(--bb-duration-fast) var(--bb-ease);
}
.ctx-stat-card:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: var(--bb-shadow-md);
}
.ctx-stat-label {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    font-weight: var(--bb-weight-medium);
}
.ctx-stat-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
}
.ctx-stat-amount {
    font-size: 18px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
    font-variant-numeric: tabular-nums;
}
.ctx-stat-amount--income {
    color: var(--bb-success);
}
.ctx-trend {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    font-weight: var(--bb-weight-semibold);
    padding: 2px 7px;
    border-radius: 12px;
}
.ctx-trend--down {
    color: var(--bb-success);
    background: var(--bb-success-light);
}

/* 通用区块 */
.ctx-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ctx-section__head {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    font-weight: var(--bb-weight-semibold);
    letter-spacing: 0.5px;
}
.ctx-section__head--row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.ctx-section__more {
    font-size: 11px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-tertiary);
    text-decoration: none;
    transition: color var(--bb-duration-fast) var(--bb-ease);
    cursor: pointer;
}
.ctx-section__more:hover {
    color: var(--bb-accent-text);
}
.ctx-empty-inline {
    padding: 8px 2px;
    color: var(--bb-text-tertiary);
    font-size: 12px;
}

/* 预算执行 */
.ctx-budget-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ctx-budget-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.ctx-budget-name {
    font-size: 12px;
    color: var(--bb-text-secondary);
    width: 40px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ctx-budget-track {
    flex: 1;
    min-width: 0;
}
.ctx-budget-pct {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

/* 最近流水 */
.ctx-tx-list {
    display: flex;
    flex-direction: column;
}
.ctx-tx-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid var(--bb-border-light);
    cursor: default;
}
.ctx-tx-row:last-child {
    border-bottom: none;
}
.ctx-tx-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.ctx-tx-name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--bb-text-primary);
    font-weight: var(--bb-weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ctx-tx-amount {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}
.ctx-tx-amount--expense {
    color: var(--bb-danger);
}

/* 智能体任务进度 */
.ctx-task-count {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    font-variant-numeric: tabular-nums;
}
.ctx-task-track {
    margin-bottom: 4px;
}
.ctx-task-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
}
.ctx-task-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.ctx-task-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--bb-border);
    border-radius: 50%;
    flex-shrink: 0;
    color: transparent;
    transition:
        background var(--bb-duration-fast) var(--bb-ease),
        border-color var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease);
}
.ctx-task-check.is-done {
    background: var(--bb-success);
    border-color: var(--bb-success);
    color: var(--bb-bg-card);
}
.ctx-task-title {
    font-size: 12px;
    color: var(--bb-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--bb-duration-fast) var(--bb-ease);
}
.ctx-task-title.is-done {
    color: var(--bb-text-tertiary);
    text-decoration: line-through;
}

/* 导入草稿提醒 */
.ctx-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--bb-radius-sm);
    background: var(--bb-warning-light);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #92400e;
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    text-decoration: none;
    transition: background var(--bb-duration-fast) var(--bb-ease);
}
.ctx-alert:hover {
    background: rgba(245, 158, 11, 0.18);
}
.ctx-alert__arrow {
    margin-left: auto;
}

/* ===== 天气卡片 ===== */
.ctx-weather {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--bb-border);
    border-left: 3px solid var(--bb-accent);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
    cursor: default;
    transition:
        transform var(--bb-duration-fast) var(--bb-ease),
        box-shadow var(--bb-duration-fast) var(--bb-ease);
}
.ctx-weather:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: var(--bb-shadow-md);
}
.ctx-weather--stale {
    border-left-color: var(--bb-warning);
}
.ctx-weather__main {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ctx-weather__icon {
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
}
.ctx-weather__icon--sunny {
    background: var(--bb-accent-light);
    color: var(--bb-accent-text);
}
.ctx-weather__icon--rain {
    background: var(--bb-info-light);
    color: var(--bb-info);
}
.ctx-weather__icon--snow {
    background: rgba(14, 165, 233, 0.1);
    color: #0284c7;
}
.ctx-weather__icon--muted {
    background: var(--bb-bg-input);
    color: var(--bb-text-secondary);
}
.ctx-weather__info {
    flex: 1;
    min-width: 0;
}
.ctx-weather__location {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}
.ctx-weather__location span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ctx-weather__condition {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-top: 1px;
}
.ctx-weather__condition strong {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 20px;
    font-weight: var(--bb-weight-bold);
    line-height: 1.2;
}
.ctx-weather__condition span {
    color: var(--bb-text-primary);
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
}
.ctx-weather__refresh {
    display: inline-flex;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
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
.ctx-weather__refresh:hover:not(:disabled) {
    background: var(--bb-bg-hover);
    color: var(--bb-accent-text);
}
.ctx-weather__refresh:disabled {
    cursor: wait;
    opacity: 0.6;
}
.ctx-weather__meta {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}
.ctx-weather__meta svg {
    vertical-align: -2px;
    margin-right: 2px;
}
.ctx-weather__cache {
    margin-left: auto;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--bb-warning-light);
    color: var(--bb-warning);
    font-size: 9px;
    font-weight: var(--bb-weight-semibold);
}
.ctx-weather__alert {
    padding: 4px 8px;
    border-radius: var(--bb-radius-sm);
    background: rgba(245, 158, 11, 0.08);
    color: var(--bb-warning);
    font-size: 10px;
    font-weight: var(--bb-weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ctx-weather__placeholder {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

@keyframes ctx-weather-spin {
    to {
        transform: rotate(360deg);
    }
}
.ctx-weather__refresh.spinning,
.ctx-weather__refresh .spinning {
    animation: ctx-weather-spin 0.9s linear infinite;
}
</style>
