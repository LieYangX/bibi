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
            <router-link class="ctx-section__head ctx-section__head--link" to="/detail">
                最近流水
                <span class="ctx-section__more">查看全部 →</span>
            </router-link>
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

import { computed, onMounted, onUnmounted } from 'vue'
import { Eye, EyeOff, TrendingDown, Lightbulb, ChevronRight } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { BbAmount } from './common'
import { BbProgress } from './ui'
import { useStatisticsStore } from '../stores/statistics.store'
import { useTransactionStore } from '../stores/transaction.store'
import { useBudgetStore } from '../stores/budget.store'
import { useImportStore } from '../stores/import.store'
import { useSettingStore } from '../stores/setting.store'
import { onRefreshMany } from '../composables/useRefreshBus'
import { formatLocalDate } from '../utils/date'
import type { BudgetWithProgress, Transaction } from '@shared/types'

const statisticsStore = useStatisticsStore()
const transactionStore = useTransactionStore()
const budgetStore = useBudgetStore()
const importStore = useImportStore()
const settingStore = useSettingStore()
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
        })
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
.ctx-section__head--link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: var(--bb-text-tertiary);
    transition: color var(--bb-duration-fast) var(--bb-ease);
}
.ctx-section__head--link:hover {
    color: var(--bb-accent-text);
}
.ctx-section__more {
    font-size: 11px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-tertiary);
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
</style>
