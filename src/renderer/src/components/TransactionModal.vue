<template>
    <BbModal
        :visible="visible"
        :title="editTransaction ? '编辑流水' : '记一笔'"
        width="520px"
        @update:visible="$emit('update:visible', $event)"
        @close="$emit('close')"
    >
        <div class="txn-modal">
            <!-- 类型切换 -->
            <div class="bb-pill-group" style="margin-bottom: 20px">
                <button
                    v-for="t in types"
                    :key="t.value"
                    class="bb-pill"
                    :class="{ active: formData.type === t.value }"
                    :style="formData.type === t.value ? { background: t.color, color: '#fff' } : {}"
                    @click="switchType(t.value)"
                >
                    <component :is="t.icon" :size="16" /><span style="margin-left: 4px">{{
                        t.label
                    }}</span>
                </button>
            </div>

            <!-- 金额 -->
            <div class="amount-area">
                <div class="amount-row">
                    <span class="amount-symbol">¥</span>
                    <input
                        ref="amountRef"
                        v-model="amountDisplay"
                        class="amount-input"
                        type="text"
                        inputmode="decimal"
                        placeholder="0.00"
                        @focus="amountFocused = true"
                        @blur="onAmountBlur"
                    />
                </div>
                <div class="quick-amounts">
                    <button
                        v-for="v in quickAmounts"
                        :key="v"
                        class="quick-btn"
                        @click="addAmount(v)"
                    >
                        +{{ v }}
                    </button>
                </div>
            </div>

            <!-- 表单字段 -->
            <div class="form-fields">
                <div class="form-row">
                    <div class="form-row__icon"><Shield :size="16" /></div>
                    <div class="form-row__body">
                        <div class="form-row__label">账户</div>
                        <BbSelect
                            v-model="formData.account_id"
                            :options="accountOptions"
                            placeholder="选择账户"
                        />
                    </div>
                </div>

                <div v-if="formData.type === 'transfer'" class="form-row">
                    <div class="form-row__icon form-row__icon--accent">
                        <ArrowLeftRight :size="16" />
                    </div>
                    <div class="form-row__body">
                        <div class="form-row__label">转入</div>
                        <BbSelect
                            v-model="formData.target_account_id"
                            :options="targetAccountOptions"
                            placeholder="选择转入账户"
                        />
                    </div>
                </div>

                <div v-if="formData.type !== 'transfer'" class="form-row">
                    <div
                        class="form-row__icon"
                        :style="
                            formData.type === 'income'
                                ? 'background:var(--bb-success-light);color:var(--bb-success)'
                                : 'background:var(--bb-danger-light);color:var(--bb-danger)'
                        "
                    >
                        <Grid3X3 :size="16" />
                    </div>
                    <div class="form-row__body">
                        <div class="form-row__label">分类</div>
                        <BbCascader
                            v-model="categoryPath"
                            :options="categoryOptions"
                            placeholder="选择分类"
                        />
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-row__icon"><Calendar :size="16" /></div>
                    <div class="form-row__body">
                        <div class="form-row__label">日期</div>
                        <BbDatePicker v-model="formData.date" placeholder="选择日期" />
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-row__icon"><Pencil :size="16" /></div>
                    <div class="form-row__body">
                        <div class="form-row__label">备注（可选）</div>
                        <input
                            v-model="formData.note"
                            class="bb-input"
                            :maxlength="200"
                            placeholder="记点什么..."
                        />
                    </div>
                </div>
            </div>

            <button
                class="save-btn"
                :class="{ loading: saving }"
                :disabled="saving"
                @click="handleSave"
            >
                <span v-if="saving" class="save-spinner" /><Check v-else :size="18" />
                {{ saving ? '保存中...' : editTransaction ? '保存修改' : '记一笔' }}
            </button>
        </div>
    </BbModal>
</template>

<script setup lang="ts">
/**
 * 记账弹窗
 * 支出 / 收入 / 转账三种类型，选择账户与分类后写入流水
 * @author xiangwei
 */

import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useAccountStore } from '../stores/account.store'
import { useCategoryStore } from '../stores/category.store'
import { useTransactionStore } from '../stores/transaction.store'
import { BbModal, BbCascader, BbSelect, BbDatePicker, Message } from './ui'
import {
    Shield,
    ArrowLeftRight,
    Grid3X3,
    Calendar,
    Pencil,
    Check,
    ArrowDown,
    ArrowUp,
    ArrowDownUp
} from '@lucide/vue'
import type { Component } from 'vue'
import type { CreateTransactionDTO, TransactionType, UpdateTransactionDTO } from '@shared/types'
import type { Transaction } from '@shared/types'
import { formatLocalDate } from '../utils/date'

const props = defineProps<{ visible: boolean; editTransaction?: Transaction | null }>()
const emit = defineEmits<{
    'update:visible': [value: boolean]
    close: []
    saved: []
}>()

const accountStore = useAccountStore()
const categoryStore = useCategoryStore()
const transactionStore = useTransactionStore()

const saving = ref(false)
const amountFocused = ref(false)
const amountRef = ref<HTMLInputElement>()
const quickAmounts = [10, 20, 50, 100, 200, 500]

const formData = reactive<{
    type: TransactionType
    account_id: string
    target_account_id: string
    amount_cents: number
    date: string
    note: string
}>({
    type: 'expense',
    account_id: '',
    target_account_id: '',
    amount_cents: 0,
    date: formatLocalDate(),
    note: ''
})
const amountDisplay = ref('')
const categoryPath = ref<string[]>([])

const types: Array<{ value: TransactionType; label: string; icon: Component; color: string }> = [
    { value: 'expense', label: '支出', icon: ArrowDown, color: '#EF5350' },
    { value: 'income', label: '收入', icon: ArrowUp, color: '#4CAF50' },
    { value: 'transfer', label: '转账', icon: ArrowDownUp, color: '#d9a404' }
]

const categoryOptions = computed(() => {
    const list =
        formData.type === 'income'
            ? categoryStore.incomeCategories
            : categoryStore.expenseCategories
    return list.map((cat) => ({
        value: cat.id,
        label: cat.name,
        children: cat.sub_categories.map((sub) => ({ value: sub.id, label: sub.name }))
    }))
})

const accountOptions = computed(() =>
    accountStore.accounts.map((acc) => ({
        value: acc.id,
        label: `${acc.name}`
    }))
)

const targetAccountOptions = computed(() =>
    accountStore.accounts
        .filter((a) => a.id !== formData.account_id)
        .map((acc) => ({
            value: acc.id,
            label: acc.name
        }))
)

watch(
    () => props.visible,
    async (val) => {
        if (!val) return
        saving.value = false
        const edit = props.editTransaction
        if (edit) {
            // 编辑模式：用已有数据填充表单
            formData.type = edit.type
            formData.account_id = edit.account_id
            formData.target_account_id = edit.target_account_id || ''
            formData.amount_cents = edit.amount_cents
            formData.date = edit.date
            formData.note = edit.note || ''
            amountDisplay.value = (edit.amount_cents / 100).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
            categoryPath.value = []
            if (edit.category_id) {
                categoryPath.value.push(edit.category_id)
                if (edit.sub_category_id) {
                    categoryPath.value.push(edit.sub_category_id)
                }
            }
        } else {
            // 新建模式：重置表单
            formData.type = 'expense'
            formData.amount_cents = 0
            formData.target_account_id = ''
            formData.note = ''
            amountDisplay.value = ''
            categoryPath.value = []
            formData.date = formatLocalDate()
        }
        await Promise.all([accountStore.loadAccounts(), categoryStore.loadCategories(true)])
        const d = accountStore.accounts.find((a) => a.is_default)
        if (!edit) {
            formData.account_id = d ? d.id : ''
        }
        nextTick(() => amountRef.value?.focus())
    }
)

function switchType(type: TransactionType): void {
    formData.type = type
    categoryPath.value = []
}

function addAmount(v: number): void {
    const cur = parseFloat(amountDisplay.value.replace(/,/g, '')) || 0
    const next = cur + v
    amountDisplay.value = next.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    formData.amount_cents = Math.round(next * 100)
    amountRef.value?.focus()
}

function onAmountBlur(): void {
    amountFocused.value = false
    if (amountDisplay.value) {
        const n = parseFloat(amountDisplay.value.replace(/,/g, ''))
        if (!isNaN(n)) {
            amountDisplay.value = n.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
            formData.amount_cents = Math.round(n * 100)
        }
    }
}

async function handleSave(): Promise<void> {
    if (!formData.account_id) {
        Message.warning('请选择账户')
        return
    }
    if (formData.type === 'transfer' && !formData.target_account_id) {
        Message.warning('请选择转入账户')
        return
    }
    if (formData.type !== 'transfer' && categoryPath.value.length === 0) {
        Message.warning('请选择分类')
        return
    }
    if (!formData.amount_cents || formData.amount_cents <= 0) {
        Message.warning('请输入有效金额')
        return
    }
    saving.value = true
    try {
        if (props.editTransaction) {
            // 编辑模式
            const data: UpdateTransactionDTO = {
                type: formData.type,
                account_id: formData.account_id,
                amount_cents: formData.amount_cents,
                date: formData.date || formatLocalDate(),
                note: formData.note || null
            }
            if (formData.type === 'transfer') {
                data.target_account_id = formData.target_account_id || null
                data.category_id = null
                data.sub_category_id = null
            } else {
                data.target_account_id = null
                data.category_id = categoryPath.value[0] || null
                data.sub_category_id = categoryPath.value[1] || null
            }
            const result = await transactionStore.updateTransaction(props.editTransaction.id, data)
            if (result.ok) {
                Message.success('已更新')
                emit('saved')
                emit('update:visible', false)
            } else {
                Message.error(result.error || '更新失败')
            }
        } else {
            const data: CreateTransactionDTO = {
                type: formData.type,
                account_id: formData.account_id,
                amount_cents: formData.amount_cents,
                date: formData.date || formatLocalDate(),
                note: formData.note || undefined
            }
            if (formData.type === 'transfer') {
                data.target_account_id = formData.target_account_id
            } else {
                data.category_id = categoryPath.value[0]
                data.sub_category_id = categoryPath.value[1] || undefined
            }
            const result = await transactionStore.createTransaction(data)
            if (result.ok) {
                Message.success('已保存')
                emit('saved')
                emit('update:visible', false)
            } else {
                Message.error(result.error || '保存失败')
            }
        }
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
.txn-modal {
    padding-top: 4px;
}

.amount-area {
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--bb-border);
}
.amount-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 14px;
}
.amount-symbol {
    font-size: 28px;
    font-weight: 600;
    color: var(--bb-text-primary);
    line-height: 1;
}
.amount-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: var(--bb-font-mono);
    font-size: 48px;
    font-weight: 700;
    color: var(--bb-text-primary);
    text-align: center;
    outline: none;
    padding: 0;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    max-width: 280px;
}
.amount-input::placeholder {
    color: var(--bb-text-tertiary);
    font-weight: 400;
}
.quick-amounts {
    display: flex;
    gap: 8px;
    justify-content: center;
}
.quick-btn {
    padding: 6px 14px;
    border: 1px solid var(--bb-border);
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
}
.quick-btn:hover {
    border-color: var(--bb-accent);
    color: var(--bb-accent-text);
    background: var(--bb-accent-lighter);
}

.form-fields {
    margin-bottom: 20px;
}
.form-row {
    display: flex;
    align-items: flex-start;
    padding: 11px 0;
    gap: 12px;
}
.form-row__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--bb-bg-hover);
    color: var(--bb-text-secondary);
    flex-shrink: 0;
}
.form-row__icon--accent {
    background: var(--bb-accent-light);
    color: var(--bb-accent);
}
.form-row__body {
    flex: 1;
    min-width: 0;
}
.form-row__label {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    margin-bottom: 4px;
    font-weight: 500;
}

.save-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: var(--bb-accent);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 3px 12px rgba(217, 164, 4, 0.25);
}
.save-btn:hover:not(.loading) {
    background: var(--bb-accent-hover);
    box-shadow: 0 5px 18px rgba(217, 164, 4, 0.35);
    transform: translateY(-1px);
}
.save-btn:active:not(.loading) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(217, 164, 4, 0.18);
}
.save-btn.loading {
    opacity: 0.7;
    cursor: not-allowed;
}
.save-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
