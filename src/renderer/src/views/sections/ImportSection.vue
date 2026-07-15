<template>
    <div class="import-section">
        <header class="import-page-head">
            <div class="import-page-title">
                <span class="import-page-title__icon"><FileDown :size="18" /></span>
                <div>
                    <h2>导入账单</h2>
                    <span v-if="draft" :title="draft.file_name">{{ draft.file_name }}</span>
                    <span v-else>{{ sourceLabel }}账单</span>
                </div>
            </div>
            <div class="source-switch" role="group" aria-label="账单来源">
                <button
                    v-for="item in sourceOptions"
                    :key="item.value"
                    type="button"
                    :class="{ active: source === item.value }"
                    :disabled="isBusy"
                    @click="selectSource(item.value)"
                >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span style="display: inline-flex" v-html="item.icon" />
                    {{ item.label }}
                </button>
            </div>
        </header>

        <section v-if="!draft && !importResult" class="upload-surface">
            <button
                class="upload-target"
                type="button"
                :disabled="isBusy || storesLoading"
                @click="handleSelectFile"
            >
                <span class="upload-target__icon">
                    <LoaderCircle v-if="isBusy || storesLoading" :size="31" class="loading-icon" />
                    <Upload v-else :size="31" />
                </span>
                <strong>{{ isBusy ? '正在读取账单' : `选择${sourceLabel}账单` }}</strong>
                <span>{{ source === 'alipay' ? '支付宝官方 CSV' : '微信支付 XLSX' }}</span>
            </button>
        </section>

        <section v-else-if="!draft && importResult" class="import-result">
            <CheckCircle2 :size="26" />
            <div class="import-result__main">
                <strong>账单已写入</strong>
                <span
                    >成功 {{ importResult.success_count }} 条，跳过
                    {{ importResult.skip_count }} 条</span
                >
            </div>
            <div class="import-result__amounts">
                <span>支出 ¥{{ formatCents(importResult.expense_cents) }}</span>
                <span>收入 ¥{{ formatCents(importResult.income_cents) }}</span>
            </div>
            <button class="bb-btn bb-btn-primary" type="button" @click="startAnotherImport">
                <FilePlus2 :size="15" />
                继续导入
            </button>
        </section>

        <!-- 导入帮助提示 -->
        <section v-if="!draft && !importResult" class="import-help">
            <div class="help-card">
                <span class="help-card__icon"><FileSearch :size="18" /></span>
                <div class="help-card__body">
                    <strong>导出账单文件</strong>
                    <span
                        >支付宝：我的 → 账单 → 右上角··· → 开具交易流水证明 → 用于个人对账（CSV）<br />微信：我
                        → 服务 → 账单 → 右上角··· → 账单下载 → 下载交易明细（XLSX）</span
                    >
                </div>
            </div>
            <div class="help-card">
                <span class="help-card__icon"><ListChecks :size="18" /></span>
                <div class="help-card__body">
                    <strong>导入流程</strong>
                    <span
                        >选择文件 → 自动解析为草稿 → 映射分类与账户 → 确认写入 →
                        数据持久化到本地数据库，全程无需联网</span
                    >
                </div>
            </div>
        </section>

        <template v-if="draft">
            <section class="draft-file-bar">
                <div class="draft-file-info">
                    <FileSpreadsheet :size="18" />
                    <div>
                        <strong :title="draft.file_name">{{ draft.file_name }}</strong>
                        <span>{{ sourceLabel }} · 待确认</span>
                    </div>
                </div>
                <div class="draft-file-actions">
                    <span v-if="pendingUpdates > 0" class="draft-sync-state">
                        <LoaderCircle :size="13" />
                        保存修改
                    </span>
                    <button
                        class="bb-btn bb-btn-sm"
                        type="button"
                        :disabled="isBusy"
                        @click="handleSelectFile"
                    >
                        <RotateCcw :size="14" />
                        重新选择
                    </button>
                </div>
            </section>

            <section class="summary-strip" aria-label="导入草稿汇总">
                <div class="summary-metric">
                    <span>总记录</span>
                    <strong>{{ draft.summary.total }}</strong>
                </div>
                <div class="summary-metric summary-metric--accent">
                    <span>已选</span>
                    <strong>{{ draft.summary.included }}</strong>
                </div>
                <div class="summary-metric summary-metric--success">
                    <span>就绪</span>
                    <strong>{{ draft.summary.ready }}</strong>
                </div>
                <div class="summary-metric summary-metric--warning">
                    <span>未映射</span>
                    <strong>{{ draft.summary.unmapped }}</strong>
                </div>
                <div class="summary-metric">
                    <span>重复</span>
                    <strong>{{ draft.summary.duplicate }}</strong>
                </div>
                <div class="summary-metric">
                    <span>已排除</span>
                    <strong>{{ draft.summary.excluded }}</strong>
                </div>
                <div class="summary-metric summary-metric--danger">
                    <span>无效</span>
                    <strong>{{ draft.summary.invalid }}</strong>
                </div>
            </section>

            <MappingPanel
                :snapshot="draft"
                :account-options="accountOptions"
                :expense-categories="expenseCategoryOptions"
                :income-categories="incomeCategoryOptions"
                :disabled="isBusy"
                @operation="queueDraftOperation"
            />

            <DraftTable
                :snapshot="draft"
                :account-options="accountOptions"
                :expense-categories="expenseCategoryOptions"
                :income-categories="incomeCategoryOptions"
                :disabled="isBusy"
                @operation="queueDraftOperation"
            />

            <ConfirmBar
                v-model:remember-mappings="rememberMappings"
                :snapshot="draft"
                :busy="isBusy"
                @confirm="confirmDraft"
                @discard="cancelDraft"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type {
    ImportDraftOperation,
    ImportDraftSnapshot,
    ImportResult,
    ImportSource
} from '@shared/types'
import {
    CheckCircle2,
    FileDown,
    FilePlus2,
    FileSearch,
    FileSpreadsheet,
    ListChecks,
    LoaderCircle,
    RotateCcw,
    Upload
} from '@lucide/vue'
import { Message } from '../../components/ui'
import { desktopApi } from '../../api/desktop-api'
import { useAccountStore } from '../../stores/account.store'
import { useCategoryStore, type CategoryInfo } from '../../stores/category.store'
import { emitRefresh } from '../../composables/useRefreshBus'
import { formatYuan } from '../../utils/format'
import ConfirmBar from './import/ConfirmBar.vue'
import DraftTable from './import/DraftTable.vue'
import MappingPanel from './import/MappingPanel.vue'

interface SelectOption {
    value: string
    label: string
}

interface CascaderOption {
    value: string
    label: string
    children?: Array<{ value: string; label: string }>
}

interface SourceOption {
    value: ImportSource
    label: string
    icon: string
}

/** 导入来源图标 SVG */
const sourceIconSvg: Record<string, string> = {
    alipay: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="M21.422 15.358q-5.744-1.73-6.678-2.062a12.4 12.4 0 0 0 1.32-3.32H12.8V8.872h4v-.68h-4V6.344h-1.536c-.28 0-.312.248-.312.248v1.592H7.2v.68h3.752v1.104H7.88v.616h6.224a11 11 0 0 1-.888 2.176c-1.408-.464-2.192-.784-3.912-.944c-3.256-.312-4.008 1.48-4.128 2.576C5 16.064 6.48 17.424 8.688 17.424s3.68-1.024 5.08-2.72q1.75.837 6.514 2.902A9.99 9.99 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10a10 10 0 0 1-.578 3.358m-12.99 1.01c-2.336 0-2.704-1.48-2.584-2.096s.8-1.416 2.104-1.416c1.496 0 2.832.384 4.44 1.16c-1.136 1.48-2.52 2.352-3.96 2.352"/></svg>',
    wechat: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="M18.575 13.711a.91.91 0 0 0 .898-.898a.895.895 0 0 0-.898-.898a.894.894 0 0 0-.898.898c0 .5.4.898.898.898m-4.425 0a.91.91 0 0 0 .898-.898c0-.498-.4-.898-.898-.898a.894.894 0 0 0-.898.898c0 .5.399.898.898.898m6.567 5.04a.35.35 0 0 0-.172.37c0 .048 0 .098.025.147c.098.417.294 1.081.294 1.106c0 .073.025.122.025.172a.22.22 0 0 1-.221.22c-.05 0-.074-.024-.123-.048l-1.449-.836a.8.8 0 0 0-.344-.098c-.073 0-.147 0-.196.024c-.688.197-1.4.295-2.161.295c-3.66 0-6.607-2.457-6.607-5.505s2.947-5.505 6.607-5.505c3.659 0 6.606 2.458 6.606 5.505c0 1.647-.884 3.146-2.284 4.154M16.674 8.099a9 9 0 0 0-.28-.005c-4.174 0-7.606 2.86-7.606 6.505c0 .554.08 1.09.228 1.6h-.089a10 10 0 0 1-2.584-.368c-.074-.025-.148-.025-.222-.025a.83.83 0 0 0-.419.123l-1.747 1.005a.35.35 0 0 1-.148.05a.273.273 0 0 1-.27-.27c0-.074.024-.123.049-.197c.024-.024.246-.834.369-1.324c0-.05.024-.123.024-.172a.56.56 0 0 0-.221-.441C2.059 13.376 1 11.586 1 9.599C1.001 5.944 4.571 3 8.951 3c3.765 0 6.93 2.169 7.723 5.098m-5.154.418c.573 0 1.026-.477 1.026-1.026c0-.573-.453-1.026-1.026-1.026s-1.026.453-1.026 1.026s.453 1.026 1.026 1.026m-5.26 0c.573 0 1.027-.477 1.027-1.026c0-.573-.454-1.026-1.027-1.026c-.572 0-1.026.453-1.026 1.026s.454 1.026 1.026 1.026"/></svg>'
}

const sourceOptions: SourceOption[] = [
    { value: 'alipay', label: '支付宝', icon: sourceIconSvg.alipay },
    { value: 'wechat', label: '微信', icon: sourceIconSvg.wechat }
]

const accountStore = useAccountStore()
const categoryStore = useCategoryStore()
const source = ref<ImportSource>('alipay')
const draft = ref<ImportDraftSnapshot | null>(null)
const importResult = ref<ImportResult | null>(null)
const rememberMappings = ref(true)
const storesLoading = ref(true)
const selectingFile = ref(false)
const confirming = ref(false)
const discarding = ref(false)
const pendingUpdates = ref(0)
let updateTail: Promise<void> = Promise.resolve()

const sourceLabel = computed(
    () => sourceOptions.find((item) => item.value === source.value)?.label ?? '账单'
)
const isBusy = computed(
    () => selectingFile.value || confirming.value || discarding.value || pendingUpdates.value > 0
)
const accountOptions = computed<SelectOption[]>(() =>
    accountStore.accounts
        .filter((account) => account.is_hidden === 0)
        .map((account) => ({ value: account.id, label: account.name }))
)
const expenseCategoryOptions = computed<CascaderOption[]>(() =>
    toCascaderOptions(categoryStore.expenseCategories)
)
const incomeCategoryOptions = computed<CascaderOption[]>(() =>
    toCascaderOptions(categoryStore.incomeCategories)
)

onMounted(async () => {
    try {
        await Promise.all([accountStore.loadAccounts(), categoryStore.loadCategories()])
    } finally {
        storesLoading.value = false
    }
})

onBeforeUnmount(() => {
    const draftId = draft.value?.draft_id
    if (!draftId || confirming.value) return
    draft.value = null
    void updateTail.then(async () => {
        try {
            await desktopApi.import.discardDraft({ draft_id: draftId })
        } catch (error: unknown) {
            console.error('[导入草稿] 页面卸载时释放草稿失败', error)
        }
    })
})

function toCascaderOptions(categories: CategoryInfo[]): CascaderOption[] {
    return categories.map((category) => ({
        value: category.id,
        label: category.name,
        children: category.sub_categories.map((subCategory) => ({
            value: subCategory.id,
            label: subCategory.name
        }))
    }))
}

function formatCents(cents: number): string {
    return formatYuan(cents / 100)
}

async function selectSource(nextSource: ImportSource): Promise<void> {
    if (source.value === nextSource || isBusy.value) return
    if (draft.value && !(await discardCurrentDraft())) return
    source.value = nextSource
    importResult.value = null
}

async function handleSelectFile(): Promise<void> {
    if (selectingFile.value || confirming.value || discarding.value) return
    const selectedSource = source.value
    selectingFile.value = true
    try {
        const fileResult = await desktopApi.import.selectFile(selectedSource)
        if (!fileResult.ok) {
            Message.error(fileResult.error || '选择账单失败')
            return
        }
        if (!fileResult.data) return

        if (draft.value && !(await discardCurrentDraft())) return
        const parseResult = await desktopApi.import.parseFile(fileResult.data, selectedSource)
        if (!parseResult.ok) {
            Message.error(parseResult.error || '账单解析失败')
            return
        }

        draft.value = parseResult.data
        source.value = parseResult.data.source
        importResult.value = null
        rememberMappings.value = true
    } catch (error: unknown) {
        Message.error(errorMessage(error, '账单解析失败'))
    } finally {
        selectingFile.value = false
    }
}

function queueDraftOperation(operation: ImportDraftOperation): void {
    const draftId = draft.value?.draft_id
    if (!draftId) return

    pendingUpdates.value++
    const run = async (): Promise<void> => {
        const current = draft.value
        if (!current || current.draft_id !== draftId) return
        try {
            const result = await desktopApi.import.updateDraft({
                draft_id: current.draft_id,
                revision: current.revision,
                operation
            })
            if (result.ok) {
                draft.value = result.data
            } else {
                Message.error(result.error || '保存草稿修改失败')
            }
        } catch (error: unknown) {
            Message.error(errorMessage(error, '保存草稿修改失败'))
        }
    }

    const task = updateTail.then(run, run)
    updateTail = task.catch(() => undefined)
    void task.finally(() => {
        pendingUpdates.value = Math.max(0, pendingUpdates.value - 1)
    })
}

async function confirmDraft(): Promise<void> {
    await updateTail
    const current = draft.value
    if (!current || confirming.value) return
    if (current.summary.ready !== current.summary.included) {
        Message.warning('选中的账单中仍有未完成映射或不可导入的记录')
        return
    }
    if (current.summary.included === 0) {
        Message.warning('没有选中可导入的账单')
        return
    }

    confirming.value = true
    try {
        const result = await desktopApi.import.confirmDraft({
            draft_id: current.draft_id,
            revision: current.revision,
            remember_mappings: rememberMappings.value
        })
        if (!result.ok) {
            Message.error(result.error || '账单写入失败')
            return
        }

        importResult.value = result.data
        draft.value = null
        emitRefresh('transaction')
        emitRefresh('account')
        emitRefresh('budget')
        emitRefresh('import')
        await accountStore.loadAccounts()
        Message.success(`成功导入 ${result.data.success_count} 条账单`)
    } catch (error: unknown) {
        Message.error(errorMessage(error, '账单写入失败'))
    } finally {
        confirming.value = false
    }
}

async function cancelDraft(): Promise<void> {
    if (await discardCurrentDraft()) Message.success('已取消导入草稿')
}

async function discardCurrentDraft(): Promise<boolean> {
    await updateTail
    const current = draft.value
    if (!current) return true

    discarding.value = true
    try {
        const result = await desktopApi.import.discardDraft({ draft_id: current.draft_id })
        if (!result.ok) {
            Message.error(result.error || '取消导入草稿失败')
            return false
        }
        if (draft.value?.draft_id === current.draft_id) draft.value = null
        return true
    } catch (error: unknown) {
        Message.error(errorMessage(error, '取消导入草稿失败'))
        return false
    } finally {
        discarding.value = false
    }
}

function startAnotherImport(): void {
    importResult.value = null
    void handleSelectFile()
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
}
</script>

<style scoped>
.import-section {
    display: grid;
    width: 100%;
    gap: 12px;
}

.import-page-head,
.import-page-title,
.source-switch,
.draft-file-bar,
.draft-file-info,
.draft-file-actions,
.draft-sync-state,
.import-result,
.import-result__amounts {
    display: flex;
    align-items: center;
}

.import-page-head {
    min-height: 42px;
    justify-content: space-between;
    gap: 16px;
}

.import-page-title {
    min-width: 0;
    gap: 10px;
}

.import-page-title__icon {
    display: inline-flex;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(217, 164, 4, 0.2);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-accent-light);
    color: var(--bb-accent);
}

.import-page-title h2 {
    margin: 0;
    color: var(--bb-text-primary);
    font-size: 18px;
    font-weight: var(--bb-weight-bold);
}

.import-page-title > div > span {
    display: block;
    max-width: 520px;
    overflow: hidden;
    margin-top: 1px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.source-switch {
    flex-shrink: 0;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
}

.source-switch button {
    display: inline-flex;
    min-width: 88px;
    min-height: 30px;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 12px;
    cursor: pointer;
}

.source-switch button.active {
    background: var(--bb-bg-card);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-xs);
}

.source-switch button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.upload-surface {
    overflow: hidden;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.upload-target {
    display: flex;
    width: 100%;
    min-height: 244px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 9px;
    padding: 32px;
    border: 2px dashed transparent;
    background: transparent;
    color: var(--bb-text-secondary);
    cursor: pointer;
    transition:
        border-color var(--bb-duration-fast) var(--bb-ease),
        background var(--bb-duration-fast) var(--bb-ease);
}

.upload-target:hover:not(:disabled) {
    border-color: var(--bb-accent);
    background: var(--bb-accent-soft);
}

.upload-target:disabled {
    cursor: wait;
    opacity: 0.7;
}

.upload-target__icon {
    display: inline-flex;
    width: 58px;
    height: 58px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-input);
    color: var(--bb-accent);
}

.upload-target strong {
    color: var(--bb-text-primary);
    font-size: 15px;
    font-weight: var(--bb-weight-semibold);
}

.upload-target > span:last-child {
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

.loading-icon,
.draft-sync-state svg {
    animation: import-spin 0.9s linear infinite;
}

.draft-file-bar {
    min-height: 52px;
    justify-content: space-between;
    gap: 16px;
    padding: 7px 10px 7px 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.draft-file-info {
    min-width: 0;
    gap: 9px;
}

.draft-file-info > svg {
    flex-shrink: 0;
    color: var(--bb-accent);
}

.draft-file-info strong,
.draft-file-info span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.draft-file-info strong {
    max-width: 650px;
    color: var(--bb-text-primary);
    font-size: 12px;
}

.draft-file-info span {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.draft-file-actions {
    flex-shrink: 0;
    gap: 10px;
}

.draft-sync-state {
    gap: 5px;
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.draft-file-actions .bb-btn {
    min-height: 30px;
}

.summary-strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(70px, 1fr));
    overflow: hidden;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.summary-metric {
    position: relative;
    display: flex;
    min-height: 54px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 2px;
}

.summary-metric + .summary-metric::before {
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 0;
    width: 1px;
    background: var(--bb-border-light);
    content: '';
}

.summary-metric span {
    color: var(--bb-text-tertiary);
    font-size: 10px;
}

.summary-metric strong {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 16px;
    font-variant-numeric: tabular-nums;
}

.summary-metric--accent strong {
    color: var(--bb-accent-text);
}

.summary-metric--success strong {
    color: var(--bb-success);
}

.summary-metric--warning strong {
    color: var(--bb-warning);
}

.summary-metric--danger strong {
    color: var(--bb-danger);
}

.import-result {
    gap: 14px;
    padding: 16px;
    border: 1px solid rgba(22, 163, 74, 0.24);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.import-result > svg {
    flex-shrink: 0;
    color: var(--bb-success);
}

.import-result__main {
    min-width: 0;
    flex: 1;
}

.import-result__main strong,
.import-result__main span {
    display: block;
}

.import-result__main strong {
    color: var(--bb-text-primary);
    font-size: 14px;
}

.import-result__main span,
.import-result__amounts {
    margin-top: 2px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
}

.import-result__amounts {
    margin-top: 0;
    flex-direction: column;
    align-items: flex-end;
    font-family: var(--bb-font-mono);
}

.import-result .bb-btn {
    flex-shrink: 0;
    font-size: 12px;
}

/* 导入帮助提示 */
.import-help {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.help-card {
    display: flex;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-md);
    background: var(--bb-bg-card);
}

.help-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--bb-accent-light);
    color: var(--bb-accent);
}

.help-card__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.help-card__body strong {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}

.help-card__body span {
    font-size: 11px;
    line-height: 1.6;
    color: var(--bb-text-tertiary);
}

@media (max-width: 680px) {
    .import-help {
        grid-template-columns: 1fr;
    }
}

@keyframes import-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 680px) {
    .import-page-head {
        align-items: stretch;
        flex-direction: column;
    }

    .source-switch,
    .source-switch button {
        width: 100%;
    }

    .summary-strip {
        grid-template-columns: repeat(4, minmax(64px, 1fr));
    }

    .summary-metric:nth-child(5)::before {
        display: none;
    }

    .import-result {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .import-result__amounts {
        width: 100%;
        align-items: flex-start;
    }
}

@media (max-width: 480px) {
    .draft-file-bar {
        align-items: flex-start;
        flex-direction: column;
    }

    .draft-file-actions {
        width: 100%;
        justify-content: space-between;
    }

    .summary-strip {
        grid-template-columns: repeat(2, minmax(64px, 1fr));
    }

    .summary-metric:nth-child(odd)::before {
        display: none;
    }
}
</style>
