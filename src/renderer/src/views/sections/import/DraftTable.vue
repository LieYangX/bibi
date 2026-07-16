<template>
    <section class="draft-table-section" aria-labelledby="draft-table-title">
        <header class="table-toolbar">
            <div id="draft-table-title" class="table-title">
                <ListChecks :size="17" />
                <span>账单明细</span>
                <span class="table-count"
                    >{{ filteredItems.length }} / {{ snapshot.items.length }}</span
                >
            </div>
            <div class="table-filters">
                <div class="table-search">
                    <Search :size="14" />
                    <input
                        v-model="searchText"
                        type="search"
                        placeholder="搜索摘要、来源分类或账户"
                        aria-label="搜索账单明细"
                    />
                    <button
                        v-if="searchText"
                        type="button"
                        title="清空搜索"
                        aria-label="清空搜索"
                        @click="searchText = ''"
                    >
                        <X :size="13" />
                    </button>
                </div>
                <BbSelect
                    :model-value="stateFilter"
                    :options="stateOptions"
                    size="sm"
                    width="118px"
                    @update:model-value="stateFilter = String($event)"
                />
                <BbSelect
                    :model-value="typeFilter"
                    :options="typeFilterOptions"
                    size="sm"
                    width="108px"
                    @update:model-value="typeFilter = String($event)"
                />
            </div>
        </header>

        <div class="table-scroll">
            <table class="draft-table">
                <thead>
                    <tr>
                        <th class="select-column">
                            <input
                                type="checkbox"
                                :checked="allVisibleSelected"
                                :indeterminate="someVisibleSelected && !allVisibleSelected"
                                :disabled="disabled || selectableVisibleItems.length === 0"
                                aria-label="选择当前页可导入明细"
                                @change="toggleVisibleItems"
                            />
                        </th>
                        <th>日期</th>
                        <th>来源摘要</th>
                        <th>来源分类</th>
                        <th>收支</th>
                        <th>笔笔分类</th>
                        <th>账户</th>
                        <th class="amount-column">金额</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="item in pagedItems"
                        :key="item.id"
                        :class="[
                            `row-state--${item.state}`,
                            { 'row-not-included': !item.included }
                        ]"
                    >
                        <td class="select-column">
                            <input
                                type="checkbox"
                                :checked="item.included"
                                :disabled="disabled || !canToggleIncluded(item)"
                                :aria-label="`${item.date} ${item.source.category || '未分类'}`"
                                @change="toggleItem(item, $event)"
                            />
                        </td>
                        <td class="date-cell">
                            <span>{{ item.date }}</span>
                            <span v-if="item.time" class="date-time">{{ item.time }}</span>
                        </td>
                        <td class="summary-cell">
                            <span class="summary-primary" :title="summaryPrimary(item)">
                                {{ summaryPrimary(item) }}
                            </span>
                            <span
                                v-if="summarySecondary(item)"
                                class="summary-secondary"
                                :title="summarySecondary(item)"
                            >
                                {{ summarySecondary(item) }}
                            </span>
                        </td>
                        <td class="source-cell">
                            <span :title="item.source.category || '未识别分类'">
                                {{ item.source.category || '未识别分类' }}
                            </span>
                            <span>{{
                                item.source.status || item.source.direction || '未知状态'
                            }}</span>
                        </td>
                        <td>
                            <BbSelect
                                :model-value="item.type"
                                :options="itemTypeOptions"
                                :disabled="disabled || isLockedItem(item)"
                                size="sm"
                                width="92px"
                                @update:model-value="updateItemType(item, $event)"
                            />
                        </td>
                        <td>
                            <div
                                v-if="item.type !== 'skip'"
                                class="table-cascader"
                                :class="{
                                    'table-control--disabled': disabled || isLockedItem(item)
                                }"
                            >
                                <BbCascader
                                    :model-value="categoryPath(item)"
                                    :options="categoryOptions(item.type)"
                                    placeholder="选择分类"
                                    allow-parent-selection
                                    @update:model-value="updateItemCategory(item, $event)"
                                />
                            </div>
                            <span v-else class="table-placeholder">--</span>
                        </td>
                        <td>
                            <BbSelect
                                v-if="item.type !== 'skip'"
                                :model-value="item.account_id || ''"
                                :options="accountSelectOptions"
                                :disabled="disabled || isLockedItem(item)"
                                size="sm"
                                width="150px"
                                placeholder="选择账户"
                                @update:model-value="updateItemAccount(item, $event)"
                            />
                            <span v-else class="table-placeholder">--</span>
                        </td>
                        <td
                            class="amount-cell"
                            :class="
                                item.type === 'income'
                                    ? 'amount-cell--income'
                                    : 'amount-cell--expense'
                            "
                        >
                            {{
                                item.type === 'income' ? '+' : item.type === 'expense' ? '-' : ''
                            }}¥{{ formatAmount(item.amount_cents) }}
                        </td>
                        <td class="state-cell">
                            <span class="state-badge" :class="`state-badge--${item.state}`">
                                {{ stateMeta[item.state].label }}
                            </span>
                            <span
                                v-if="item.issues[0]"
                                class="state-issue"
                                :title="item.issues.join('；')"
                            >
                                {{ item.issues[0] }}
                            </span>
                        </td>
                    </tr>
                    <tr v-if="pagedItems.length === 0">
                        <td colspan="9" class="table-empty">没有符合条件的明细</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <footer class="table-pagination">
            <span>第 {{ pageStart }}-{{ pageEnd }} 条，共 {{ filteredItems.length }} 条</span>
            <div class="pagination-actions">
                <button
                    type="button"
                    title="上一页"
                    aria-label="上一页"
                    :disabled="currentPage <= 1"
                    @click="currentPage--"
                >
                    <ChevronLeft :size="15" />
                </button>
                <span>{{ currentPage }} / {{ pageCount }}</span>
                <button
                    type="button"
                    title="下一页"
                    aria-label="下一页"
                    :disabled="currentPage >= pageCount"
                    @click="currentPage++"
                >
                    <ChevronRight :size="15" />
                </button>
            </div>
        </footer>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
    ImportDraftItem,
    ImportDraftOperation,
    ImportDraftSnapshot,
    ImportItemType,
    ImportRowState
} from '@shared/types'
import { ChevronLeft, ChevronRight, ListChecks, Search, X } from '@lucide/vue'
import { BbCascader, BbSelect } from '../../../components/ui'
import { formatYuan } from '../../../utils/format'

interface SelectOption {
    value: string | number
    label: string
}

interface CascaderOption {
    value: string
    label: string
    children?: Array<{ value: string; label: string }>
}

const PAGE_SIZE = 50

const stateMeta: Record<ImportRowState, { label: string }> = {
    ready: { label: '就绪' },
    unmapped: { label: '待映射' },
    duplicate: { label: '重复' },
    excluded: { label: '已排除' },
    invalid: { label: '无效' }
}

const stateOptions: SelectOption[] = [
    { value: 'all', label: '全部状态' },
    { value: 'ready', label: '就绪' },
    { value: 'unmapped', label: '待映射' },
    { value: 'duplicate', label: '重复' },
    { value: 'excluded', label: '已排除' },
    { value: 'invalid', label: '无效' }
]

const typeFilterOptions: SelectOption[] = [
    { value: 'all', label: '全部收支' },
    { value: 'expense', label: '支出' },
    { value: 'income', label: '收入' },
    { value: 'skip', label: '跳过' }
]

const itemTypeOptions: SelectOption[] = [
    { value: 'expense', label: '支出' },
    { value: 'income', label: '收入' },
    { value: 'skip', label: '跳过' }
]

const props = defineProps<{
    snapshot: ImportDraftSnapshot
    accountOptions: SelectOption[]
    expenseCategories: CascaderOption[]
    incomeCategories: CascaderOption[]
    disabled?: boolean
}>()

const emit = defineEmits<{
    operation: [operation: ImportDraftOperation]
}>()

const searchText = ref('')
const stateFilter = ref('all')
const typeFilter = ref('all')
const currentPage = ref(1)

const accountSelectOptions = computed<SelectOption[]>(() => [
    { value: '', label: '未映射' },
    ...props.accountOptions
])

const filteredItems = computed(() => {
    const keyword = searchText.value.trim().toLocaleLowerCase('zh-CN')
    return props.snapshot.items.filter((item) => {
        if (stateFilter.value !== 'all' && item.state !== stateFilter.value) return false
        if (typeFilter.value !== 'all' && item.type !== typeFilter.value) return false
        if (!keyword) return true
        const searchable = [
            item.source.counterparty,
            item.source.product,
            item.source.category,
            item.source.transaction_type,
            item.source.account_raw,
            item.source.status,
            item.note
        ]
            .join(' ')
            .toLocaleLowerCase('zh-CN')
        return searchable.includes(keyword)
    })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() => {
    const offset = (currentPage.value - 1) * PAGE_SIZE
    return filteredItems.value.slice(offset, offset + PAGE_SIZE)
})
const pageStart = computed(() =>
    filteredItems.value.length === 0 ? 0 : (currentPage.value - 1) * PAGE_SIZE + 1
)
const pageEnd = computed(() => Math.min(currentPage.value * PAGE_SIZE, filteredItems.value.length))
const selectableVisibleItems = computed(() => pagedItems.value.filter(canToggleIncluded))
const allVisibleSelected = computed(
    () =>
        selectableVisibleItems.value.length > 0 &&
        selectableVisibleItems.value.every((item) => item.included)
)
const someVisibleSelected = computed(() =>
    selectableVisibleItems.value.some((item) => item.included)
)

watch([searchText, stateFilter, typeFilter], () => {
    currentPage.value = 1
})

watch(pageCount, (count) => {
    if (currentPage.value > count) currentPage.value = count
})

function isLockedItem(item: ImportDraftItem): boolean {
    return item.state === 'duplicate' || item.state === 'invalid'
}

function canToggleIncluded(item: ImportDraftItem): boolean {
    return !isLockedItem(item) && item.type !== 'skip'
}

function summaryPrimary(item: ImportDraftItem): string {
    return item.source.counterparty || item.source.product || item.note || '无摘要'
}

function summarySecondary(item: ImportDraftItem): string {
    const primary = summaryPrimary(item)
    return [item.source.product, item.note].find((value) => value && value !== primary) ?? ''
}

function categoryOptions(type: 'expense' | 'income'): CascaderOption[] {
    return type === 'expense' ? props.expenseCategories : props.incomeCategories
}

function categoryPath(item: ImportDraftItem): string[] {
    if (!item.category_id) return []
    return [item.category_id, ...(item.sub_category_id ? [item.sub_category_id] : [])]
}

function formatAmount(cents: number): string {
    return formatYuan(cents / 100)
}

function eventChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked
}

function toggleVisibleItems(event: Event): void {
    if (props.disabled || selectableVisibleItems.value.length === 0) return
    emit('operation', {
        kind: 'set-included',
        item_ids: selectableVisibleItems.value.map((item) => item.id),
        included: eventChecked(event)
    })
}

function toggleItem(item: ImportDraftItem, event: Event): void {
    if (props.disabled || !canToggleIncluded(item)) return
    emit('operation', {
        kind: 'set-included',
        item_ids: [item.id],
        included: eventChecked(event)
    })
}

function updateItemType(item: ImportDraftItem, value: string | number): void {
    if (props.disabled || isLockedItem(item)) return
    emit('operation', {
        kind: 'update-item',
        item_id: item.id,
        changes: { type: String(value) as ImportItemType }
    })
}

function updateItemCategory(item: ImportDraftItem, path: string[]): void {
    if (props.disabled || isLockedItem(item) || item.type === 'skip') return
    emit('operation', {
        kind: 'update-item',
        item_id: item.id,
        changes: {
            category_id: path[0] ?? null,
            sub_category_id: path[1] ?? null
        }
    })
}

function updateItemAccount(item: ImportDraftItem, value: string | number): void {
    if (props.disabled || isLockedItem(item) || item.type === 'skip') return
    emit('operation', {
        kind: 'update-item',
        item_id: item.id,
        changes: { account_id: String(value) || null }
    })
}
</script>

<style scoped>
.draft-table-section {
    overflow: hidden;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.table-toolbar {
    display: flex;
    min-height: 50px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--bb-border);
}

.table-title,
.table-filters,
.table-search,
.pagination-actions {
    display: flex;
    align-items: center;
}

.table-title {
    flex-shrink: 0;
    gap: 7px;
    color: var(--bb-text-primary);
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
}

.table-title svg {
    color: var(--bb-accent);
}

.table-count {
    color: var(--bb-text-tertiary);
    font-family: var(--bb-font-mono);
    font-size: 10px;
    font-weight: var(--bb-weight-normal);
}

.table-filters {
    min-width: 0;
    gap: 7px;
}

.table-search {
    width: 238px;
    min-height: 32px;
    gap: 7px;
    padding: 0 8px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
    color: var(--bb-text-tertiary);
}

.table-search:focus-within {
    border-color: var(--bb-accent);
    box-shadow: 0 0 0 3px var(--bb-accent-light);
}

.table-search input {
    min-width: 0;
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--bb-text-primary);
    font: inherit;
    font-size: 12px;
}

.table-search input::-webkit-search-cancel-button {
    display: none;
}

.table-search button {
    display: inline-flex;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
}

.table-scroll {
    overflow-x: auto;
}

.draft-table {
    width: 100%;
    min-width: 1120px;
    border-collapse: collapse;
    table-layout: fixed;
}

.draft-table th,
.draft-table td {
    padding: 8px 9px;
    border-bottom: 1px solid var(--bb-border-light);
    text-align: left;
    vertical-align: middle;
}

.draft-table th {
    height: 35px;
    background: var(--bb-bg-hover);
    color: var(--bb-text-tertiary);
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
}

.draft-table th:nth-child(1) {
    width: 42px;
}

.draft-table th:nth-child(2) {
    width: 92px;
}

.draft-table th:nth-child(3) {
    width: 190px;
}

.draft-table th:nth-child(4) {
    width: 130px;
}

.draft-table th:nth-child(5) {
    width: 105px;
}

.draft-table th:nth-child(6) {
    width: 172px;
}

.draft-table th:nth-child(7) {
    width: 168px;
}

.draft-table th:nth-child(8) {
    width: 105px;
}

.draft-table th:nth-child(9) {
    width: 116px;
}

.draft-table tbody tr {
    transition: background var(--bb-duration-fast) var(--bb-ease);
}

.draft-table tbody tr:hover {
    background: var(--bb-bg-hover);
}

.draft-table tbody tr.row-not-included {
    background: rgba(148, 163, 184, 0.045);
}

.draft-table tbody tr.row-state--unmapped {
    box-shadow: inset 3px 0 0 var(--bb-warning);
}

.draft-table tbody tr.row-state--duplicate,
.draft-table tbody tr.row-state--invalid {
    opacity: 0.66;
}

.select-column {
    text-align: center !important;
}

.select-column input {
    width: 15px;
    height: 15px;
    accent-color: var(--bb-accent);
}

.date-cell,
.amount-cell {
    font-family: var(--bb-font-mono);
    font-variant-numeric: tabular-nums;
}

.date-cell {
    color: var(--bb-text-secondary);
    font-size: 11px;
}

.date-cell span {
    display: block;
}

.date-time {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.summary-primary,
.summary-secondary,
.source-cell span,
.state-issue {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.summary-primary {
    color: var(--bb-text-primary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
}

.summary-secondary,
.source-cell span:last-child {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.source-cell span:first-child {
    color: var(--bb-text-secondary);
    font-size: 11px;
}

.table-cascader {
    min-width: 150px;
}

.table-control--disabled {
    pointer-events: none;
    opacity: 0.5;
}

.table-cascader :deep(.bb-cascader-trigger) {
    min-height: 32px;
    padding: 5px 9px;
}

.table-cascader :deep(.bb-cascader-text),
.table-cascader :deep(.bb-cascader-ph) {
    font-size: 12px;
}

.table-placeholder {
    color: var(--bb-text-disabled);
    font-size: 12px;
}

.amount-column,
.amount-cell {
    text-align: right !important;
}

.amount-cell {
    font-size: 11px;
    font-weight: var(--bb-weight-semibold);
}

.amount-cell--expense {
    color: var(--bb-danger);
}

.amount-cell--income {
    color: var(--bb-success);
}

.state-badge {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
}

.state-badge--ready {
    background: var(--bb-success-light);
    color: var(--bb-success);
}

.state-badge--unmapped {
    background: var(--bb-warning-light);
    color: var(--bb-warning);
}

.state-badge--duplicate,
.state-badge--excluded {
    background: var(--bb-bg-input);
    color: var(--bb-text-secondary);
}

.state-badge--invalid {
    background: var(--bb-danger-light);
    color: var(--bb-danger);
}

.state-issue {
    max-width: 100px;
    margin-top: 3px;
    color: var(--bb-text-tertiary);
    font-size: 9px;
}

.table-empty {
    height: 120px;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    text-align: center !important;
}

.table-pagination {
    display: flex;
    min-height: 42px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.pagination-actions {
    gap: 8px;
}

.pagination-actions button {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-card);
    color: var(--bb-text-secondary);
    cursor: pointer;
}

.pagination-actions button:hover:not(:disabled) {
    border-color: var(--bb-accent);
    color: var(--bb-accent);
}

.pagination-actions button:disabled {
    color: var(--bb-text-disabled);
    cursor: not-allowed;
}

@media (max-width: 760px) {
    .table-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }

    .table-filters {
        width: 100%;
        flex-wrap: wrap;
    }

    .table-search {
        width: 100%;
    }
}
</style>
