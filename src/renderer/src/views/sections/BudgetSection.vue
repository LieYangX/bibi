<template>
    <div>
        <div class="budget-nav">
            <div class="budget-mode-switch" role="group" aria-label="预算模式">
                <button
                    class="budget-mode-btn"
                    :class="{ active: budgetMode === 'month' }"
                    @click="switchBudgetMode('month')"
                >
                    月度
                </button>
                <button
                    class="budget-mode-btn"
                    :class="{ active: budgetMode === 'year' }"
                    @click="switchBudgetMode('year')"
                >
                    年度
                </button>
            </div>
            <div class="bb-month-nav">
                <button class="bb-month-arrow" @click="goPrev">
                    <ChevronLeft :size="18" />
                </button>
                <span class="bb-month-label">{{ navLabel }}</span>
                <button class="bb-month-arrow" @click="goNext">
                    <ChevronRight :size="18" />
                </button>
            </div>
        </div>
        <div class="section-card">
            <div class="bb-card-head">
                <Database :size="18" class="bb-card-head__icon" /><span>预算执行情况</span>
            </div>
            <div v-if="statisticsStore.error" class="budget-status is-error">
                <span>{{ statisticsStore.error }}</span>
                <button class="bb-btn bb-btn-sm" @click="reloadCurrent">重试</button>
            </div>
            <div v-if="statisticsStore.loading && !budgetList.length" class="bb-empty">
                <span>正在加载预算…</span>
            </div>
            <div v-else-if="!budgetList.length && !statisticsStore.error" class="bb-empty">
                <span>暂无预算设定</span><span class="bb-empty-hint">请在下方设定预算</span>
            </div>
            <div v-for="b in budgetList" :key="b.id" class="budget-row">
                <div class="budget-row__top">
                    <div class="budget-row__cat">
                        <span
                            class="budget-dot"
                            :style="{ background: budgetColor(b.progress_pct) }"
                        />{{ b.category_name || '总预算' }}
                    </div>
                    <span class="budget-row__text text-mono"
                        ><BbAmount :value="b.used_cents" /> / <BbAmount :value="b.amount_cents"
                    /></span>
                </div>
                <BbProgress
                    :percent="Math.min(b.progress_pct, 100)"
                    :color="budgetColor(b.progress_pct)"
                />
                <div class="budget-row__pct" :style="{ color: budgetColor(b.progress_pct) }">
                    {{ b.progress_pct }}%<span v-if="b.progress_pct >= 100" class="budget-warn"
                        >· 已超支</span
                    ><span v-else-if="b.progress_pct >= 80" class="budget-warn">· 接近上限</span>
                </div>
            </div>
        </div>
        <div class="section-card" style="margin-top: 14px">
            <div class="bb-card-head">
                <PlusCircle :size="18" class="bb-card-head__icon" /><span>{{
                    budgetMode === 'month' ? '设定月度预算' : '设定年度预算'
                }}</span>
            </div>
            <div class="budget-form">
                <BbSelect
                    v-model="newBudget.category_id"
                    :options="budgetCatOptions"
                    placeholder="选择分类"
                />
                <div class="budget-form__row">
                    <div class="bb-number-wrap" style="flex: 1">
                        <span class="bb-number-prefix">¥</span
                        ><input
                            v-model.number="newBudget.amount"
                            type="number"
                            class="bb-input"
                            step="0.01"
                            min="0"
                            placeholder="预算金额"
                        />
                    </div>
                    <button
                        class="bb-btn bb-btn-primary"
                        :disabled="!newBudget.amount || newBudget.amount <= 0"
                        @click="handleSetBudget"
                    >
                        设定
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useCategoryStore } from '../../stores/category.store'
import { useBudgetStore } from '../../stores/budget.store'
import { useStatisticsStore } from '../../stores/statistics.store'
import { BbProgress, BbSelect, Message } from '../../components/ui'
import { BbAmount } from '../../components/common'
import { ChevronLeft, ChevronRight, Database, PlusCircle } from '@lucide/vue'
import { onRefreshMany } from '../../composables/useRefreshBus'

const categoryStore = useCategoryStore()
const budgetStore = useBudgetStore()
const statisticsStore = useStatisticsStore()
const budgetMode = ref<'month' | 'year'>('month')

const budgetList = computed(() =>
    budgetMode.value === 'month'
        ? statisticsStore.monthlyStats?.budgets || []
        : statisticsStore.annualStats?.budgets || []
)

const navLabel = computed(() =>
    budgetMode.value === 'month'
        ? `${statisticsStore.currentYear} 年 ${statisticsStore.currentMonth} 月`
        : `${statisticsStore.currentYear} 年`
)

const newBudget = reactive({ category_id: '' as string, amount: 0 })

const budgetCatOptions = computed(() => [
    { value: '' as string, label: '全部（总预算）' },
    ...categoryStore.expenseCategories.map((cat) => ({ value: cat.id, label: cat.name }))
])
let stopRefresh: (() => void) | undefined

function switchBudgetMode(mode: 'month' | 'year'): void {
    if (budgetMode.value === mode) return
    budgetMode.value = mode
    if (mode === 'month') {
        void statisticsStore.loadMonthly()
    } else {
        void statisticsStore.loadAnnual()
    }
}

function goPrev(): void {
    if (budgetMode.value === 'month') {
        statisticsStore.goPrevMonth()
    } else {
        statisticsStore.goPrevYear()
    }
}

function goNext(): void {
    if (budgetMode.value === 'month') {
        statisticsStore.goNextMonth()
    } else {
        statisticsStore.goNextYear()
    }
}

/** 重新加载当前预算周期 */
function reloadCurrent(): void {
    if (budgetMode.value === 'month') {
        void statisticsStore.loadMonthly()
    } else {
        void statisticsStore.loadAnnual()
    }
}

onMounted(async () => {
    await Promise.all([categoryStore.loadCategories(), statisticsStore.loadMonthly()])
    stopRefresh = onRefreshMany(['transaction', 'budget'], () => {
        if (budgetMode.value === 'month') {
            void statisticsStore.loadMonthly()
        } else {
            void statisticsStore.loadAnnual()
        }
    })
})
onUnmounted(() => stopRefresh?.())
function budgetColor(pct: number): string {
    return pct >= 100 ? '#EF4444' : pct >= 80 ? '#EAB308' : '#16a34a'
}
async function handleSetBudget(): Promise<void> {
    const ok = await budgetStore.setBudget({
        category_id: newBudget.category_id || null,
        year: statisticsStore.currentYear,
        month: budgetMode.value === 'month' ? statisticsStore.currentMonth : 0,
        amount_cents: Math.round((newBudget.amount || 0) * 100)
    })
    if (ok) {
        Message.success('预算已设定')
        if (budgetMode.value === 'month') {
            await statisticsStore.loadMonthly()
        } else {
            await statisticsStore.loadAnnual()
        }
        newBudget.amount = 0
        newBudget.category_id = ''
    } else {
        Message.error('设定失败')
    }
}
</script>
<style scoped>
.budget-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
}

.budget-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    background: var(--bb-bg-input);
    height: 36px;
}

.budget-mode-btn {
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

.budget-mode-btn.active {
    background: var(--bb-bg-elevated);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-sm);
}

.section-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 14px;
    padding: 20px;
}
.budget-row {
    padding: 12px 0;
}
.budget-row + .budget-row {
    border-top: 1px solid var(--bb-border);
}
.budget-row__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.budget-row__cat {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.budget-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.budget-row__text {
    font-size: 13px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-secondary);
}
.budget-row__pct {
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
    font-family: var(--bb-font-mono);
    font-variant-numeric: tabular-nums;
    margin-top: 6px;
}
.budget-warn {
    color: var(--bb-text-secondary);
    font-weight: var(--bb-weight-normal);
}
.budget-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.budget-form__row {
    display: flex;
    gap: 10px;
}
.margin-bottom-18 {
    margin-bottom: 18px;
}
.budget-status {
    display: flex;
    min-height: 52px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 13px;
}
.budget-status.is-error {
    margin-bottom: 12px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.06);
    color: var(--bb-danger);
}
</style>
