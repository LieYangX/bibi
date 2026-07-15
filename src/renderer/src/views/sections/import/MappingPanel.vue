<template>
    <section class="mapping-panel" aria-labelledby="mapping-title">
        <header class="mapping-head">
            <div id="mapping-title" class="mapping-title">
                <SplitSquareHorizontal :size="17" />
                <span>规则映射</span>
            </div>
            <span v-if="disabled" class="mapping-syncing">
                <LoaderCircle :size="13" />
                同步中
            </span>
        </header>

        <div class="bulk-account-row">
            <span class="bulk-account-label"><Layers3 :size="14" />批量替换账户</span>
            <label class="bulk-account-control">
                <span>支出账户</span>
                <BbSelect
                    :model-value="bulkAccountValue('expense')"
                    :options="accountSelectOptions"
                    :disabled="disabled || !hasItemType('expense')"
                    size="sm"
                    placeholder="选择付款账户"
                    @update:model-value="emitBulkAccount('expense', $event)"
                />
            </label>
            <label class="bulk-account-control">
                <span>收入账户</span>
                <BbSelect
                    :model-value="bulkAccountValue('income')"
                    :options="accountSelectOptions"
                    :disabled="disabled || !hasItemType('income')"
                    size="sm"
                    placeholder="选择收款账户"
                    @update:model-value="emitBulkAccount('income', $event)"
                />
            </label>
        </div>

        <div class="mapping-grid">
            <div class="mapping-column">
                <div class="mapping-column-head">
                    <Tags :size="15" />
                    <span>分类映射</span>
                    <span>{{ categoryMappings.length }} 项</span>
                </div>
                <div v-if="categoryMappings.length" class="mapping-list">
                    <div v-for="row in categoryMappings" :key="row.key" class="mapping-row">
                        <div class="mapping-source" :title="row.sourceCategory">
                            <span class="mapping-source-main">{{ row.sourceCategory }}</span>
                            <span class="mapping-source-meta">
                                {{ typeLabel(row.type) }} · {{ row.count }} 条
                            </span>
                        </div>
                        <ArrowRight :size="14" class="mapping-arrow" />
                        <BbCascader
                            :model-value="row.categoryPath"
                            :options="categoryOptions(row.type)"
                            :placeholder="row.mixed ? '多个分类' : '请选择分类'"
                            allow-parent-selection
                            @update:model-value="emitCategoryMapping(row, $event)"
                        />
                    </div>
                </div>
                <div v-else class="mapping-empty">暂无分类映射</div>
            </div>

            <div class="mapping-column">
                <div class="mapping-column-head">
                    <WalletCards :size="15" />
                    <span>账户映射</span>
                    <span>{{ accountMappings.length }} 项</span>
                </div>
                <div v-if="accountMappings.length" class="mapping-list">
                    <div v-for="row in accountMappings" :key="row.key" class="mapping-row">
                        <div
                            class="mapping-source"
                            :class="{ 'mapping-source--warning': !row.sourceAccountKey }"
                            :title="row.sourceAccountKey || '未识别账户'"
                        >
                            <span class="mapping-source-main">
                                {{ row.sourceAccountKey || '未识别账户' }}
                            </span>
                            <span class="mapping-source-meta">
                                {{ roleLabel(row.role) }} · {{ row.count }} 条
                            </span>
                        </div>
                        <ArrowRight :size="14" class="mapping-arrow" />
                        <BbSelect
                            :model-value="row.mixed ? MIXED_VALUE : row.accountId || ''"
                            :options="accountSelectOptions"
                            :disabled="disabled || !row.sourceAccountKey"
                            size="sm"
                            :placeholder="row.mixed ? '多个账户' : '请选择账户'"
                            @update:model-value="emitAccountMapping(row, $event)"
                        />
                    </div>
                </div>
                <div v-else class="mapping-empty">暂无账户映射</div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ImportAccountRole, ImportDraftOperation, ImportDraftSnapshot } from '@shared/types'
import {
    ArrowRight,
    Layers3,
    LoaderCircle,
    SplitSquareHorizontal,
    Tags,
    WalletCards
} from '@lucide/vue'
import { BbCascader, BbSelect } from '../../../components/ui'

interface SelectOption {
    value: string | number
    label: string
}

interface CascaderOption {
    value: string
    label: string
    children?: Array<{ value: string; label: string }>
}

interface CategoryMappingRow {
    key: string
    type: 'expense' | 'income'
    sourceCategory: string
    count: number
    categoryPath: string[]
    mixed: boolean
}

interface AccountMappingRow {
    key: string
    role: ImportAccountRole
    sourceAccountKey: string
    count: number
    accountId: string | null
    mixed: boolean
}

const MIXED_VALUE = '__mixed__'
const NONE_VALUE = '__none__'

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

const accountSelectOptions = computed<SelectOption[]>(() => [
    { value: '', label: '未映射' },
    ...props.accountOptions
])

const categoryMappings = computed<CategoryMappingRow[]>(() => {
    const groups = new Map<
        string,
        {
            type: 'expense' | 'income'
            sourceCategory: string
            count: number
            selections: Set<string>
        }
    >()

    for (const item of props.snapshot.items) {
        if (item.type === 'skip' || !item.source.category) continue
        const key = `${item.type}:${item.source.category}`
        const current = groups.get(key) ?? {
            type: item.type,
            sourceCategory: item.source.category,
            count: 0,
            selections: new Set<string>()
        }
        current.count++
        current.selections.add(`${item.category_id ?? ''}:${item.sub_category_id ?? ''}`)
        groups.set(key, current)
    }

    return [...groups.entries()]
        .map(([key, group]) => {
            const [selection = ''] = group.selections
            const [categoryId = '', subCategoryId = ''] = selection.split(':')
            return {
                key,
                type: group.type,
                sourceCategory: group.sourceCategory,
                count: group.count,
                categoryPath:
                    group.selections.size === 1 && categoryId
                        ? [categoryId, ...(subCategoryId ? [subCategoryId] : [])]
                        : [],
                mixed: group.selections.size > 1
            }
        })
        .sort((left, right) =>
            `${left.type}:${left.sourceCategory}`.localeCompare(
                `${right.type}:${right.sourceCategory}`,
                'zh-CN'
            )
        )
})

const accountMappings = computed<AccountMappingRow[]>(() => {
    const groups = new Map<
        string,
        {
            role: ImportAccountRole
            sourceAccountKey: string
            count: number
            selections: Set<string>
        }
    >()

    for (const item of props.snapshot.items) {
        if (item.type === 'skip') continue
        const role: ImportAccountRole = item.type === 'expense' ? 'payment' : 'receipt'
        const key = `${role}:${item.source.account_key}`
        const current = groups.get(key) ?? {
            role,
            sourceAccountKey: item.source.account_key,
            count: 0,
            selections: new Set<string>()
        }
        current.count++
        current.selections.add(item.account_id ?? '')
        groups.set(key, current)
    }

    return [...groups.entries()]
        .map(([key, group]) => ({
            key,
            role: group.role,
            sourceAccountKey: group.sourceAccountKey,
            count: group.count,
            accountId: group.selections.size === 1 ? [...group.selections][0] || null : null,
            mixed: group.selections.size > 1
        }))
        .sort((left, right) =>
            `${left.role}:${left.sourceAccountKey}`.localeCompare(
                `${right.role}:${right.sourceAccountKey}`,
                'zh-CN'
            )
        )
})

function categoryOptions(type: 'expense' | 'income'): CascaderOption[] {
    return type === 'expense' ? props.expenseCategories : props.incomeCategories
}

function typeLabel(type: 'expense' | 'income'): string {
    return type === 'expense' ? '支出' : '收入'
}

function roleLabel(role: ImportAccountRole): string {
    return role === 'payment' ? '付款' : '收款'
}

function hasItemType(type: 'expense' | 'income'): boolean {
    return props.snapshot.items.some((item) => item.type === type)
}

function bulkAccountValue(type: 'expense' | 'income'): string {
    const items = props.snapshot.items.filter((item) => item.type === type)
    if (!items.length) return NONE_VALUE
    const accountIds = new Set(items.map((item) => item.account_id ?? ''))
    if (accountIds.size > 1) return MIXED_VALUE
    return [...accountIds][0] ?? ''
}

function emitCategoryMapping(row: CategoryMappingRow, path: string[]): void {
    if (props.disabled) return
    emit('operation', {
        kind: 'map-category',
        item_type: row.type,
        source_category: row.sourceCategory,
        category_id: path[0] ?? null,
        sub_category_id: path[1] ?? null
    })
}

function emitAccountMapping(row: AccountMappingRow, value: string | number): void {
    if (props.disabled || !row.sourceAccountKey) return
    emit('operation', {
        kind: 'map-account',
        role: row.role,
        source_account_key: row.sourceAccountKey,
        account_id: String(value) || null
    })
}

function emitBulkAccount(type: 'expense' | 'income', value: string | number): void {
    if (props.disabled) return
    emit('operation', {
        kind: 'bulk-account',
        item_type: type,
        account_id: String(value) || null
    })
}
</script>

<style scoped>
.mapping-panel {
    overflow: hidden;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.mapping-head {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--bb-border);
}

.mapping-title,
.mapping-syncing,
.bulk-account-label,
.bulk-account-control,
.mapping-column-head {
    display: flex;
    align-items: center;
}

.mapping-title {
    gap: 7px;
    color: var(--bb-text-primary);
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
}

.mapping-title svg,
.bulk-account-label svg,
.mapping-column-head svg {
    color: var(--bb-accent);
}

.mapping-syncing {
    gap: 5px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

.mapping-syncing svg {
    animation: mapping-spin 0.9s linear infinite;
}

.bulk-account-row {
    display: grid;
    grid-template-columns: minmax(130px, 0.7fr) repeat(2, minmax(210px, 1fr));
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--bb-border);
    background: var(--bb-bg-hover);
}

.bulk-account-label {
    gap: 6px;
    color: var(--bb-text-secondary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
}

.bulk-account-control {
    display: grid;
    grid-template-columns: auto minmax(120px, 1fr);
    gap: 8px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

.mapping-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mapping-column {
    min-width: 0;
}

.mapping-column + .mapping-column {
    border-left: 1px solid var(--bb-border);
}

.mapping-column-head {
    min-height: 38px;
    gap: 6px;
    padding: 0 12px;
    border-bottom: 1px solid var(--bb-border-light);
    color: var(--bb-text-secondary);
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
}

.mapping-column-head > span:last-child {
    margin-left: auto;
    color: var(--bb-text-tertiary);
    font-family: var(--bb-font-mono);
    font-size: 10px;
    font-weight: var(--bb-weight-normal);
}

.mapping-list {
    max-height: 294px;
    overflow-y: auto;
}

.mapping-row {
    display: grid;
    grid-template-columns: minmax(105px, 0.85fr) 14px minmax(150px, 1.15fr);
    align-items: center;
    gap: 7px;
    min-height: 52px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--bb-border-light);
}

.mapping-row:last-child {
    border-bottom: none;
}

.mapping-source {
    min-width: 0;
}

.mapping-source-main,
.mapping-source-meta {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mapping-source-main {
    color: var(--bb-text-primary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
}

.mapping-source-meta {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.mapping-source--warning .mapping-source-main {
    color: var(--bb-warning);
}

.mapping-arrow {
    color: var(--bb-text-disabled);
}

.mapping-empty {
    padding: 28px 12px;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    text-align: center;
}

@keyframes mapping-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 900px) {
    .bulk-account-row {
        grid-template-columns: 1fr 1fr;
    }

    .bulk-account-label {
        grid-column: 1 / -1;
    }

    .mapping-grid {
        grid-template-columns: 1fr;
    }

    .mapping-column + .mapping-column {
        border-top: 1px solid var(--bb-border);
        border-left: none;
    }
}

@media (max-width: 560px) {
    .bulk-account-row {
        grid-template-columns: 1fr;
    }

    .bulk-account-label {
        grid-column: auto;
    }

    .mapping-row {
        grid-template-columns: minmax(96px, 0.8fr) 12px minmax(130px, 1.2fr);
    }
}
</style>
