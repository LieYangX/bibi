<template>
    <div class="detail-view-root">
        <div class="bb-page-container bb-page-container--medium">
            <PageHeader title="流水" subtitle="按类型、日期、关键词筛选流水">
                <template #actions>
                    <button
                        v-if="amountMaskEnabled"
                        class="bb-btn bb-btn-text page-eye-btn"
                        type="button"
                        :title="pageMaskEnabled ? '显示金额' : '隐藏金额'"
                        @click="togglePageMask"
                    >
                        <EyeOff v-if="pageMaskEnabled" :size="18" />
                        <Eye v-else :size="18" />
                    </button>
                </template>
            </PageHeader>

            <div v-if="transactionStore.error" class="txn-load-error">
                <span>{{ transactionStore.error }}</span>
                <button class="bb-btn bb-btn-sm" @click="doSearch">重试</button>
            </div>

            <div class="filter-bar">
                <BbSelect
                    v-model="filter.type"
                    :options="typeOptions"
                    size="sm"
                    width="110px"
                    @change="doSearch"
                />
                <BbSelect
                    v-model="filter.account_id"
                    :options="accountOptions"
                    placeholder="选择账户"
                    size="sm"
                    width="160px"
                />
                <BbDatePicker
                    v-model="filter.start_date"
                    placeholder="开始日期"
                    width="160px"
                    size="sm"
                />
                <BbDatePicker
                    v-model="filter.end_date"
                    placeholder="结束日期"
                    width="160px"
                    size="sm"
                />
                <div class="bb-search-wrap" style="width: 180px">
                    <div class="bb-search-icon"><Search :size="15" /></div>
                    <input
                        v-model="filter.keyword"
                        class="bb-input bb-input-sm"
                        placeholder="搜索备注..."
                        @keydown.enter="doSearch"
                    />
                    <div v-if="filter.keyword" class="bb-search-clear" @click="clearKeyword()">
                        <X :size="14" />
                    </div>
                </div>
            </div>

            <div class="txn-hint"><Info :size="12" />双击流水可修改</div>

            <!-- 批量操作栏 -->
            <div v-if="groupedTransactions.length" class="batch-bar">
                <button
                    v-if="!batchMode"
                    class="bb-btn bb-btn-text export-trigger"
                    :disabled="exporting"
                    @click="handleExport"
                >
                    <FileSpreadsheet :size="14" />{{ exporting ? '导出中…' : '导出 Excel' }}
                </button>
                <button
                    v-if="!batchMode"
                    class="bb-btn bb-btn-text batch-trigger"
                    @click="enterBatchMode"
                >
                    <Trash2 :size="14" />批量删除
                </button>
                <template v-else>
                    <label class="batch-check">
                        <input
                            type="checkbox"
                            :checked="allSelected"
                            :indeterminate="partialSelected"
                            @change="toggleSelectAll"
                        />
                        <span class="check-visual"></span>
                        <span>全选</span>
                    </label>
                    <span class="batch-count">{{ selectedIds.size }} 条选中</span>
                    <div class="batch-actions">
                        <button class="bb-btn bb-btn-text batch-cancel" @click="exitBatchMode">
                            取消
                        </button>
                        <button
                            v-if="selectedIds.size > 0"
                            class="bb-btn bb-btn-text batch-del"
                            @click="handleBatchDelete"
                        >
                            <Trash2 :size="14" />删除选中
                        </button>
                    </div>
                </template>
            </div>

            <div
                v-if="transactionStore.loading && !groupedTransactions.length"
                class="txn-loading-state"
            >
                <span class="txn-loading-state__dot" />
                正在加载流水…
            </div>

            <div v-if="groupedTransactions.length" class="txn-groups">
                <div v-for="group in groupedTransactions" :key="group.date" class="txn-group">
                    <div class="group-header">
                        <div class="group-date">
                            <span class="group-date__day">{{ (group.date || '').slice(-2) }}</span>
                            <div class="group-date__meta">
                                <span>{{ group.weekday }}</span>
                                <span>{{ (group.date || '').slice(0, 7) }}</span>
                            </div>
                        </div>
                        <div class="group-summary">
                            <span v-if="group.income > 0" class="group-summary__inc"
                                >收
                                <BbAmount
                                    :value="Math.round(group.income * 100)"
                                    sign="+"
                                    :masked="pageMaskEnabled"
                            /></span>
                            <span v-if="group.expense > 0" class="group-summary__exp"
                                >支
                                <BbAmount
                                    :value="Math.round(group.expense * 100)"
                                    :masked="pageMaskEnabled"
                            /></span>
                        </div>
                    </div>
                    <div class="txn-card">
                        <div
                            v-for="item in group.items"
                            :key="item.id"
                            class="txn-item"
                            @dblclick="handleEdit(item)"
                        >
                            <label v-if="batchMode" class="txn-check" @click.stop>
                                <input
                                    type="checkbox"
                                    :checked="selectedIds.has(item.id)"
                                    @change="toggleItem(item.id)"
                                />
                                <span class="check-visual"></span>
                            </label>
                            <span class="txn-dot" :style="{ background: txnDotColor(item) }" />
                            <div class="txn-info">
                                <div class="txn-info__top">
                                    <span class="txn-cat">{{
                                        item.category_name || typeLabel(item.type)
                                    }}</span>
                                    <span v-if="item.sub_category_name" class="txn-subcat"
                                        >· {{ item.sub_category_name }}</span
                                    >
                                </div>
                                <div
                                    v-if="item.note || item.account_name || item.time"
                                    class="txn-info__meta"
                                >
                                    <span v-if="item.time" class="txn-time">{{ item.time }}</span
                                    >{{ item.account_name
                                    }}<span v-if="item.note"> · {{ item.note }}</span>
                                </div>
                            </div>
                            <div class="txn-right">
                                <span
                                    class="txn-amount"
                                    :class="{
                                        'is-income': item.type === 'income',
                                        'is-expense':
                                            item.type === 'expense' || item.type === 'transfer'
                                    }"
                                >
                                    <BbAmount
                                        :value="item.amount_cents"
                                        :sign="txnSign(item)"
                                        :masked="pageMaskEnabled"
                                    />
                                </span>
                                <BbPopconfirm content="确定删除吗？" @ok="handleDelete(item.id)">
                                    <template #reference>
                                        <button class="bb-btn bb-btn-text txn-del">
                                            <Trash2 :size="15" />
                                        </button>
                                    </template>
                                </BbPopconfirm>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <EmptyState
                v-else-if="!transactionStore.loading"
                :icon="Inbox"
                text="没有符合条件的流水记录"
                hint="试试调整筛选条件"
            />

            <div ref="loadMoreRef" class="txn-load-more" aria-live="polite">
                <span v-if="transactionStore.loadingMore">正在加载更多…</span>
                <span v-else-if="groupedTransactions.length && !transactionStore.hasMore">
                    已加载全部 {{ total }} 条流水
                </span>
            </div>

            <button
                v-if="showBackToTop"
                class="txn-back-top"
                type="button"
                title="回到顶部"
                aria-label="回到顶部"
                @click="scrollToTop"
            >
                <ArrowUp :size="18" />
            </button>
        </div>

        <!-- 编辑流水弹窗 -->
        <TransactionModal
            v-model:visible="showEditModal"
            :edit-transaction="editingTxn"
            @saved="onEditSaved"
        />

        <!-- 批量删除确认弹窗 -->
        <BbModal
            :visible="showBatchDelModal"
            title="确认删除"
            width="400px"
            @update:visible="showBatchDelModal = $event"
        >
            <p class="del-confirm-text">
                确定删除选中的 <strong>{{ selectedIds.size }}</strong> 条流水记录？
            </p>
            <p class="del-confirm-hint">删除后数据无法恢复，请谨慎操作。</p>
            <template #footer>
                <button class="bb-btn" @click="showBatchDelModal = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    style="background: #ef4444; border-color: #ef4444"
                    @click="executeBatchDelete"
                >
                    确定删除
                </button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 流水明细页
 * 支持按类型、日期、关键词筛选，按日分组展示
 * @author xiangwei
 */

import { reactive, computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useTransactionStore, type TransactionInfo } from '../stores/transaction.store'
import { useAccountStore } from '../stores/account.store'
import { useSettingStore } from '../stores/setting.store'
import { desktopApi } from '../api/desktop-api'
import { BbPopconfirm, BbSelect, BbDatePicker, BbModal, Message } from '../components/ui'
import { PageHeader, EmptyState, BbAmount } from '../components/common'
import { onRefresh } from '../composables/useRefreshBus'
import TransactionModal from '../components/TransactionModal.vue'
import type { TransactionType } from '@shared/types'
import { Trash2, Search, X, Inbox, Eye, EyeOff, Info, ArrowUp, FileSpreadsheet } from '@lucide/vue'

const transactionStore = useTransactionStore()
const accountStore = useAccountStore()
const settingStore = useSettingStore()
const { amountMaskEnabled } = storeToRefs(settingStore)

/** 选中流水 ID 集合 */
const selectedIds = ref(new Set<string>())
const allSelected = computed(
    () =>
        groupedTransactions.value.length > 0 &&
        groupedTransactions.value.every((g) => g.items.every((i) => selectedIds.value.has(i.id)))
)
const partialSelected = computed(
    () =>
        !allSelected.value &&
        groupedTransactions.value.some((g) => g.items.some((i) => selectedIds.value.has(i.id)))
)

/** 明细页统一脱敏开关，默认跟随全局设置 */
const pageMaskEnabled = ref(amountMaskEnabled.value)
const editingTxn = ref<TransactionInfo | null>(null)
const showEditModal = ref(false)
const showBatchDelModal = ref(false)
const batchMode = ref(false)
const loadMoreRef = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)
const exporting = ref(false)
let loadMoreObserver: IntersectionObserver | null = null
let scrollContainer: HTMLElement | null = null

/** 全局脱敏开关变化时，重置本页统一状态 */
watch(amountMaskEnabled, (enabled) => {
    pageMaskEnabled.value = enabled
})

/** 切换本页所有金额的显示/脱敏状态 */
function togglePageMask(): void {
    pageMaskEnabled.value = !pageMaskEnabled.value
}

/** 编辑保存后刷新 */
function onEditSaved(): void {
    editingTxn.value = null
    doSearch()
}

const PAGE_SIZE = 50
const filter = reactive<{
    type: TransactionType | 'all'
    account_id: string
    start_date: string
    end_date: string
    keyword: string
}>({
    type: 'all',
    account_id: '',
    start_date: '',
    end_date: '',
    keyword: ''
})
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const typeOptions = [
    { value: 'all', label: '全部类型' },
    { value: 'expense', label: '支出' },
    { value: 'income', label: '收入' },
    { value: 'transfer', label: '转账' }
]

const accountOptions = computed(() => [
    { value: '', label: '全部账户' },
    ...accountStore.accounts.map((a) => ({ value: a.id, label: a.name }))
])

/** 按日分组，便于在 UI 展示日期分隔 */
interface TransactionGroup {
    date: string
    weekday: string
    items: TransactionInfo[]
    income: number
    expense: number
}

const groupedTransactions = computed(() => {
    const list = transactionStore.transactions
    const groups: Record<string, TransactionGroup> = {}
    for (const item of list) {
        if (!item.date) continue
        const date = item.date
        if (!groups[date]) {
            const d = new Date(date)
            if (isNaN(d.getTime())) continue
            groups[date] = {
                date,
                weekday: '周' + weekdays[d.getDay()],
                items: [],
                income: 0,
                expense: 0
            }
        }
        groups[date].items.push(item)
        if (item.type === 'income') groups[date].income += (item.amount_cents || 0) / 100
        if (item.type === 'expense') groups[date].expense += (item.amount_cents || 0) / 100
    }
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
})

const total = computed(() => transactionStore.total)

// 日期筛选变化时重新查询
watch(
    () => filter.start_date,
    () => applyFilter()
)
watch(
    () => filter.end_date,
    () => applyFilter()
)
watch(
    () => filter.account_id,
    () => applyFilter()
)

let offRefresh: () => void

watch(showEditModal, (val) => {
    if (!val) editingTxn.value = null
})

onMounted(async () => {
    void accountStore.loadAccounts()
    doSearch()
    offRefresh = onRefresh('transaction', () => doSearch())
    await nextTick()
    scrollContainer = loadMoreRef.value?.closest('.content') as HTMLElement | null
    scrollContainer?.addEventListener('scroll', handlePageScroll, { passive: true })
    loadMoreObserver = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void transactionStore.loadMoreTransactions()
            }
        },
        { root: scrollContainer, rootMargin: '0px 0px 240px 0px' }
    )
    if (loadMoreRef.value) loadMoreObserver.observe(loadMoreRef.value)
})
onUnmounted(() => {
    offRefresh?.()
    loadMoreObserver?.disconnect()
    scrollContainer?.removeEventListener('scroll', handlePageScroll)
})

watch(
    () => transactionStore.hasMore,
    async (hasMore) => {
        if (!hasMore || !loadMoreObserver || !loadMoreRef.value) return
        await nextTick()
        loadMoreObserver.unobserve(loadMoreRef.value)
        loadMoreObserver.observe(loadMoreRef.value)
    }
)

function clearKeyword(): void {
    filter.keyword = ''
    applyFilter()
}

function applyFilter(): void {
    doSearch()
}

function doSearch(): void {
    batchMode.value = false
    selectedIds.value = new Set()
    void transactionStore.loadTransactions({
        type: filter.type !== 'all' ? filter.type : undefined,
        account_id: filter.account_id || undefined,
        start_date: filter.start_date || undefined,
        end_date: filter.end_date || undefined,
        keyword: filter.keyword || undefined,
        page_size: PAGE_SIZE
    })
    scrollContainer?.scrollTo({ top: 0 })
}

/** 根据页面滚动位置控制回顶按钮 */
function handlePageScroll(): void {
    showBackToTop.value = (scrollContainer?.scrollTop ?? 0) > 480
}

/** 平滑滚动到流水列表顶部 */
function scrollToTop(): void {
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' })
}

function typeLabel(t: string): string {
    return { expense: '支出', income: '收入', transfer: '转账', adjustment: '调整' }[t] || t
}

/** 根据分类颜色或流水类型返回圆点色值 */
function txnDotColor(item: TransactionInfo): string {
    if (item.category_color) return item.category_color
    if (item.type === 'expense') return 'var(--bb-danger)'
    if (item.type === 'income') return 'var(--bb-success)'
    if (item.type === 'transfer') return 'var(--bb-accent)'
    return 'var(--bb-text-tertiary)'
}

/** 根据当前筛选账户判断流水的正负号 */
function txnSign(item: TransactionInfo): string {
    if (item.type === 'income') return '+'
    if (item.type === 'transfer') {
        // 当筛选账户为目标账户时显示转入
        if (filter.account_id && item.target_account_id === filter.account_id) return '+'
    }
    return '-'
}

function handleEdit(item: TransactionInfo): void {
    editingTxn.value = item
    showEditModal.value = true
}

function toggleItem(id: string): void {
    const s = new Set(selectedIds.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    selectedIds.value = s
}

function toggleSelectAll(): void {
    if (allSelected.value) {
        selectedIds.value = new Set()
    } else {
        const ids = new Set<string>()
        for (const g of groupedTransactions.value) {
            for (const i of g.items) ids.add(i.id)
        }
        selectedIds.value = ids
    }
}

function enterBatchMode(): void {
    batchMode.value = true
    selectedIds.value = new Set()
}

function exitBatchMode(): void {
    batchMode.value = false
    selectedIds.value = new Set()
}

async function handleExport(): Promise<void> {
    if (exporting.value) return
    exporting.value = true
    try {
        const result = await desktopApi.transaction.export({
            type: filter.type !== 'all' ? filter.type : undefined,
            account_id: filter.account_id || undefined,
            start_date: filter.start_date || undefined,
            end_date: filter.end_date || undefined,
            keyword: filter.keyword || undefined
        })
        if (!result.ok) {
            Message.error(result.error || '导出失败')
            return
        }
        if (result.data.canceled) return
        Message.success(`已导出 ${result.data.count} 条流水到 ${result.data.file_path}`)
    } finally {
        exporting.value = false
    }
}

async function handleBatchDelete(): Promise<void> {
    if (selectedIds.value.size === 0) return
    showBatchDelModal.value = true
}

async function executeBatchDelete(): Promise<void> {
    showBatchDelModal.value = false
    const ids = [...selectedIds.value]
    const result = await transactionStore.batchDeleteTransactions(ids)
    if (!result.ok) {
        Message.error(result.error || '批量删除失败')
        return
    }
    selectedIds.value = new Set()
    Message.success(`已删除 ${result.data.deleted_count} 条`)
    doSearch()
}

async function handleDelete(id: string): Promise<void> {
    const r = await transactionStore.deleteTransaction(id)
    if (r.ok) {
        Message.success('已删除')
        doSearch()
    } else {
        Message.error(r.error || '删除失败')
    }
}
</script>

<style scoped>
.detail-view-root {
    width: 100%;
    min-height: 100%;
}

.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 12px;
    padding: 12px 16px;
}

.txn-hint {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    font-size: 11px;
    color: var(--bb-text-tertiary);
    margin-bottom: 8px;
    padding-right: 4px;
}

/* 批量操作栏 */
.batch-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    padding: 0 4px;
}

.batch-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--bb-text-secondary);
    cursor: pointer;
    user-select: none;
}

.batch-check input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
}

.batch-check .check-visual {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--bb-border);
    border-radius: 3px;
    background: var(--bb-bg-card);
    flex-shrink: 0;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.batch-check input:checked + .check-visual {
    background: var(--bb-accent);
    border-color: var(--bb-accent);
}

.batch-check input:indeterminate + .check-visual {
    background: var(--bb-accent);
    border-color: var(--bb-accent);
}

.batch-check input:indeterminate + .check-visual::after {
    content: '';
    width: 10px;
    height: 2px;
    background: #fff;
    border-radius: 1px;
    display: block;
}

.batch-check input:checked + .check-visual::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    display: block;
}

.batch-count {
    font-size: 12px;
    color: var(--bb-text-tertiary);
}

.export-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--bb-text-tertiary);
}

.export-trigger:hover {
    color: var(--bb-success);
    background: var(--bb-success-light);
}

.batch-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-left: auto;
}

.batch-trigger:hover {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

.batch-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}

.batch-del {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--bb-danger);
}

.batch-del:hover {
    background: var(--bb-danger-light);
}

.batch-cancel {
    font-size: 12px;
    color: var(--bb-text-tertiary);
}

.del-confirm-text {
    font-size: 14px;
    color: var(--bb-text-primary);
    margin-bottom: 8px;
}

.del-confirm-hint {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    line-height: 1.5;
}

.txn-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.txn-group {
    animation: group-in 0.3s var(--bb-ease-out) both;
}
@keyframes group-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 10px;
}
.group-date {
    display: flex;
    align-items: center;
    gap: 10px;
}
.group-date__day {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--bb-accent);
    color: #fff;
    font-size: 16px;
    font-weight: var(--bb-weight-bold);
    line-height: 1;
}
.group-date__meta {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    color: var(--bb-text-tertiary);
    line-height: 1.3;
}
.group-date__meta span:first-child {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.group-summary {
    display: flex;
    gap: 12px;
    font-size: 12px;
}
.group-summary__inc {
    color: var(--bb-success);
}
.group-summary__exp {
    color: var(--bb-danger);
}
.txn-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    overflow: hidden;
}
.txn-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    transition: background var(--bb-duration-fast) var(--bb-ease);
    cursor: default;
}

.txn-check {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.txn-check input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
}

.txn-check .check-visual {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--bb-border);
    border-radius: 3px;
    background: var(--bb-bg-card);
    flex-shrink: 0;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.txn-check input:checked + .check-visual {
    background: var(--bb-accent);
    border-color: var(--bb-accent);
}

.txn-check input:checked + .check-visual::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    display: block;
}

.txn-item + .txn-item {
    border-top: 1px solid var(--bb-border);
}
.txn-item:hover {
    background: var(--bb-bg-hover);
}
.txn-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.txn-info {
    flex: 1;
    min-width: 0;
}
.txn-info__top {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: var(--bb-text-primary);
}
.txn-cat {
    font-weight: var(--bb-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.txn-subcat {
    font-size: 13px;
    color: var(--bb-text-secondary);
}
.txn-info__meta {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 320px;
}
.txn-time {
    font-family: var(--bb-font-mono);
    font-size: 11px;
    color: var(--bb-accent);
    background: var(--bb-accent-lighter);
    padding: 1px 5px;
    border-radius: 4px;
    margin-right: 6px;
}
.txn-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}
.txn-amount {
    font-family: var(--bb-font-mono);
    font-size: 16px;
    font-weight: var(--bb-weight-bold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: 0;
}
.txn-amount.is-expense {
    color: var(--bb-danger);
}
.txn-amount.is-income {
    color: var(--bb-success);
}
.txn-del {
    visibility: hidden;
    opacity: 0;
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
}
.txn-item:hover .txn-del {
    visibility: visible;
    opacity: 1;
}
.txn-load-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.06);
    color: var(--bb-danger);
    font-size: 13px;
}
.txn-loading-state,
.txn-load-more {
    display: flex;
    min-height: 46px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: var(--bb-text-tertiary);
}
.txn-loading-state__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--bb-accent);
    animation: txn-loading-pulse 1s ease-in-out infinite;
}
.txn-back-top {
    position: fixed;
    left: calc(50% + 110px);
    bottom: 28px;
    z-index: 20;
    display: inline-flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--bb-border);
    border-radius: 50%;
    background: var(--bb-bg-card);
    color: var(--bb-text-secondary);
    box-shadow: var(--bb-shadow-sm);
    cursor: pointer;
    transform: translateX(-50%);
    transition:
        color var(--bb-duration-fast) var(--bb-ease),
        border-color var(--bb-duration-fast) var(--bb-ease),
        transform var(--bb-duration-fast) var(--bb-ease);
}
.txn-back-top:hover {
    border-color: var(--bb-accent);
    color: var(--bb-accent-text);
    transform: translate(-50%, -2px);
}
@keyframes txn-loading-pulse {
    0%,
    100% {
        opacity: 0.35;
        transform: scale(0.8);
    }
    50% {
        opacity: 1;
        transform: scale(1);
    }
}
@media (max-width: 740px) {
    .filter-bar > * {
        flex: 1 1 auto;
        min-width: 0;
    }
    .filter-bar :deep(.bb-datepicker) {
        width: auto !important;
        min-width: 130px;
        flex: 1 1 auto;
    }
    .bb-search-wrap {
        width: auto !important;
        min-width: 130px;
        flex: 1 1 auto;
    }
}
@media (max-width: 520px) {
    .filter-bar {
        flex-direction: column;
    }
    .filter-bar > *,
    .filter-bar :deep(.bb-datepicker),
    .bb-search-wrap {
        width: 100% !important;
        min-width: 0;
        flex: none;
    }
    .txn-amount {
        font-size: 14px;
    }
    .txn-info__meta {
        max-width: 150px;
    }
}
</style>
