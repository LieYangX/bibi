<template>
    <div class="bb-page-container bb-page-container--medium">
        <PageHeader title="账户" subtitle="管理你的资金账户，按类型区分">
            <template #actions>
                <button class="bb-btn bb-btn-primary" @click="openCreate">
                    <Plus :size="16" />新建账户
                </button>
            </template>
        </PageHeader>

        <div v-if="accountStore.error" class="account-status is-error">
            <span>{{ accountStore.error }}</span>
            <button class="bb-btn bb-btn-sm" @click="accountStore.loadAccounts()">重试</button>
        </div>
        <div
            v-else-if="accountStore.loading && !accountStore.accounts.length"
            class="account-status"
        >
            正在加载账户…
        </div>

        <div v-if="accountStore.accounts.length" class="total-row">
            <span class="total-label">总余额</span>
            <span class="total-value"><BbAmount :value="totalBalanceCents" use-locale /></span>
        </div>

        <div v-if="accountStore.accounts.length" class="account-grid">
            <div
                v-for="acc in accountStore.accounts"
                :key="acc.id"
                class="account-card"
                :style="{ '--accent': typeColor(acc.type), '--accent-bg': typeBg(acc.type) }"
                @click="openEdit(acc)"
            >
                <div class="acc-top">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="acc-icon" v-html="typeIconSvg(acc.type)" />
                    <div class="acc-info">
                        <div class="acc-name">
                            {{ acc.name }}
                            <span v-if="acc.is_default" class="acc-default-tag">默认</span>
                        </div>
                        <div class="acc-type">{{ typeLabel(acc.type) }}</div>
                    </div>
                    <BbPopconfirm
                        content="确定删除该账户？删除后，该账户下的所有明细流水记录也会被删除。"
                        @ok="handleDelete(acc.id)"
                        @click.stop
                    >
                        <template #reference>
                            <button class="bb-btn bb-btn-text acc-del">
                                <Trash2 :size="15" />
                            </button>
                        </template>
                    </BbPopconfirm>
                </div>
                <div class="acc-balance" :class="{ negative: acc.balance_cents < 0 }">
                    <BbAmount :value="acc.balance_cents" />
                </div>
                <div v-if="acc.type === 'credit'" class="acc-actions">
                    <button class="bb-btn bb-btn-sm bb-btn-primary" @click.stop="openRepay(acc)">
                        <Wallet :size="14" />还款
                    </button>
                </div>
                <div v-if="acc.remark" class="acc-remark">{{ acc.remark }}</div>
            </div>
        </div>

        <EmptyState
            v-else-if="!accountStore.loading && !accountStore.error"
            :icon="Inbox"
            text="还没有账户"
            hint="创建一个账户开始记账吧"
        />

        <!-- 新建弹窗 -->
        <BbModal
            :visible="showCreate"
            title="新建账户"
            width="420px"
            @update:visible="showCreate = $event"
        >
            <div class="create-form">
                <div class="form-field">
                    <label class="form-label">账户名称</label>
                    <input v-model="createForm.name" class="bb-input" placeholder="如：工资卡" />
                </div>
                <div class="form-field">
                    <label class="form-label">账户类型</label>
                    <BbSelect v-model="createForm.type" :options="accountTypeOptions" />
                </div>
                <div class="form-field">
                    <label class="form-label">初始余额（元）</label>
                    <div class="bb-number-wrap">
                        <span class="bb-number-prefix">¥</span>
                        <input
                            v-model.number="createForm.initialBalance"
                            type="number"
                            class="bb-input"
                            step="0.01"
                        />
                    </div>
                </div>
                <div class="form-field">
                    <label class="form-label">备注</label>
                    <input
                        v-model="createForm.remark"
                        class="bb-input"
                        placeholder="可选备注信息"
                        maxlength="200"
                    />
                </div>
                <label class="bb-checkbox" style="margin-top: 8px">
                    <input v-model="createForm.isDefault" type="checkbox" />
                    设为默认账户
                </label>
            </div>
            <template #footer>
                <button class="bb-btn" @click="showCreate = false">取消</button>
                <button class="bb-btn bb-btn-primary" @click="handleCreateOk">确定</button>
            </template>
        </BbModal>

        <!-- 编辑弹窗 -->
        <BbModal
            :visible="showEdit"
            title="编辑账户"
            width="420px"
            @update:visible="showEdit = $event"
        >
            <div class="create-form">
                <div class="form-field">
                    <label class="form-label">账户名称</label>
                    <input v-model="editForm.name" class="bb-input" placeholder="如：工资卡" />
                </div>
                <div class="form-field">
                    <label class="form-label">账户类型</label>
                    <BbSelect v-model="editForm.type" :options="accountTypeOptions" />
                </div>
                <div class="form-field">
                    <label class="form-label">备注</label>
                    <input
                        v-model="editForm.remark"
                        class="bb-input"
                        placeholder="可选备注信息"
                        maxlength="200"
                    />
                </div>
                <label class="bb-checkbox" style="margin-top: 8px">
                    <input v-model="editForm.isDefault" type="checkbox" />
                    设为默认账户
                </label>
            </div>
            <template #footer>
                <button class="bb-btn" @click="showEdit = false">取消</button>
                <button class="bb-btn bb-btn-primary" @click="handleEditOk">保存</button>
            </template>
        </BbModal>

        <!-- 还款弹窗 -->
        <BbModal
            :visible="showRepay"
            title="信用卡还款"
            width="420px"
            @update:visible="showRepay = $event"
        >
            <div class="create-form">
                <div class="form-field">
                    <label class="form-label">还款账户</label>
                    <BbSelect
                        v-model="repayForm.fromAccountId"
                        :options="repayAccountOptions"
                        placeholder="选择还款来源账户"
                    />
                </div>
                <div class="form-field">
                    <label class="form-label">还款金额（元）</label>
                    <div class="bb-number-wrap">
                        <span class="bb-number-prefix">¥</span>
                        <input
                            v-model.number="repayForm.amount"
                            type="number"
                            class="bb-input"
                            step="0.01"
                            min="0.01"
                            placeholder="输入还款金额"
                        />
                    </div>
                </div>
                <div class="form-field">
                    <label class="form-label">还款日期</label>
                    <input v-model="repayForm.date" type="date" class="bb-input" />
                </div>
                <div class="form-field">
                    <label class="form-label">备注</label>
                    <input
                        v-model="repayForm.note"
                        class="bb-input"
                        placeholder="可选备注"
                        maxlength="200"
                    />
                </div>
            </div>
            <template #footer>
                <button class="bb-btn" @click="showRepay = false">取消</button>
                <button class="bb-btn bb-btn-primary" @click="handleRepayOk">确认还款</button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 账户管理页
 * @author xiangwei
 */

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useAccountStore, type AccountInfo } from '../stores/account.store'
import { useTransactionStore } from '../stores/transaction.store'
import { BbModal, BbPopconfirm, BbSelect, Message } from '../components/ui'
import { PageHeader, EmptyState, BbAmount } from '../components/common'
import { emitRefresh, onRefresh } from '../composables/useRefreshBus'
import { Plus, Trash2, Inbox, Wallet } from '@lucide/vue'
import type { AccountType } from '@shared/types'
import { formatLocalDate } from '../utils/date'

const accountStore = useAccountStore()
const transactionStore = useTransactionStore()
const showCreate = ref(false)
const showEdit = ref(false)
const editId = ref('')
const createForm = reactive<{
    name: string
    type: AccountType
    initialBalance: number
    isDefault: boolean
    remark: string
}>({
    name: '',
    type: 'bank',
    initialBalance: 0,
    isDefault: false,
    remark: ''
})
const editForm = reactive<{
    name: string
    type: AccountType
    isDefault: boolean
    remark: string
}>({ name: '', type: 'bank', isDefault: false, remark: '' })

// 还款弹窗状态
const showRepay = ref(false)
const repayCreditId = ref('')
const repayForm = reactive({
    fromAccountId: '' as string,
    amount: 0,
    date: formatLocalDate(),
    note: ''
})

const accountTypeOptions = [
    { value: 'bank', label: '银行卡' },
    { value: 'wechat', label: '微信' },
    { value: 'alipay', label: '支付宝' },
    { value: 'cash', label: '现金' },
    { value: 'credit', label: '信用卡' },
    { value: 'other', label: '其他' }
]

const totalBalanceCents = computed(() => {
    return accountStore.accounts.reduce((sum, a) => sum + a.balance_cents, 0)
})

/** 还款来源账户选项，排除当前目标信用卡 */
const repayAccountOptions = computed(() => {
    return accountStore.accounts
        .filter((a) => a.id !== repayCreditId.value)
        .map((a) => ({ value: a.id, label: `${a.name}（${typeLabel(a.type)}）` }))
})

let offRefresh: () => void
onMounted(() => {
    accountStore.loadAccounts()
    // 记账 / 删除流水可能导致账户余额变化，需同步刷新
    offRefresh = onRefresh('transaction', () => accountStore.loadAccounts())
})
onUnmounted(() => offRefresh?.())

function typeLabel(t: string): string {
    return (
        (
            {
                bank: '银行卡',
                wechat: '微信',
                alipay: '支付宝',
                cash: '现金',
                credit: '信用卡',
                other: '其他'
            } as Record<string, string>
        )[t] || t
    )
}
function typeColor(t: string): string {
    return (
        (
            {
                bank: '#5B8EA8',
                wechat: '#5B8C5A',
                alipay: '#6B8ED4',
                cash: '#d9a404',
                credit: '#D95D4A',
                other: '#888'
            } as Record<string, string>
        )[t] || '#5B8EA8'
    )
}
function typeBg(t: string): string {
    return (
        (
            {
                bank: 'rgba(91,142,168,0.1)',
                wechat: 'rgba(91,140,90,0.1)',
                alipay: 'rgba(107,142,212,0.1)',
                cash: 'rgba(217,164,4,0.1)',
                credit: 'rgba(217,93,74,0.1)',
                other: 'rgba(136,136,136,0.1)'
            } as Record<string, string>
        )[t] || 'rgba(91,142,168,0.1)'
    )
}
/** 账户类型实心图标 SVG */
function typeIconSvg(t: string): string {
    const icons: Record<string, string> = {
        // 银行建筑
        bank: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 20h20v2H2zm2-8h2v7H4zm5 0h2v7H9zm4 0h2v7h-2zm5 0h2v7h-2zM2 7l10-5l10 5v4H2zm10 1a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/></svg>',
        // 微信品牌图标
        wechat: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M18.575 13.711a.91.91 0 0 0 .898-.898a.895.895 0 0 0-.898-.898a.894.894 0 0 0-.898.898c0 .5.4.898.898.898m-4.425 0a.91.91 0 0 0 .898-.898c0-.498-.4-.898-.898-.898a.894.894 0 0 0-.898.898c0 .5.399.898.898.898m6.567 5.04a.35.35 0 0 0-.172.37c0 .048 0 .098.025.147c.098.417.294 1.081.294 1.106c0 .073.025.122.025.172a.22.22 0 0 1-.221.22c-.05 0-.074-.024-.123-.048l-1.449-.836a.8.8 0 0 0-.344-.098c-.073 0-.147 0-.196.024c-.688.197-1.4.295-2.161.295c-3.66 0-6.607-2.457-6.607-5.505s2.947-5.505 6.607-5.505c3.659 0 6.606 2.458 6.606 5.505c0 1.647-.884 3.146-2.284 4.154M16.674 8.099a9 9 0 0 0-.28-.005c-4.174 0-7.606 2.86-7.606 6.505c0 .554.08 1.09.228 1.6h-.089a10 10 0 0 1-2.584-.368c-.074-.025-.148-.025-.222-.025a.83.83 0 0 0-.419.123l-1.747 1.005a.35.35 0 0 1-.148.05a.273.273 0 0 1-.27-.27c0-.074.024-.123.049-.197c.024-.024.246-.834.369-1.324c0-.05.024-.123.024-.172a.56.56 0 0 0-.221-.441C2.059 13.376 1 11.586 1 9.599C1.001 5.944 4.571 3 8.951 3c3.765 0 6.93 2.169 7.723 5.098m-5.154.418c.573 0 1.026-.477 1.026-1.026c0-.573-.453-1.026-1.026-1.026s-1.026.453-1.026 1.026s.453 1.026 1.026 1.026m-5.26 0c.573 0 1.027-.477 1.027-1.026c0-.573-.454-1.026-1.027-1.026c-.572 0-1.026.453-1.026 1.026s.454 1.026 1.026 1.026"/></svg>',
        // 支付宝品牌图标
        alipay: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M21.422 15.358q-5.744-1.73-6.678-2.062a12.4 12.4 0 0 0 1.32-3.32H12.8V8.872h4v-.68h-4V6.344h-1.536c-.28 0-.312.248-.312.248v1.592H7.2v.68h3.752v1.104H7.88v.616h6.224a11 11 0 0 1-.888 2.176c-1.408-.464-2.192-.784-3.912-.944c-3.256-.312-4.008 1.48-4.128 2.576C5 16.064 6.48 17.424 8.688 17.424s3.68-1.024 5.08-2.72q1.75.837 6.514 2.902A9.99 9.99 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10a10 10 0 0 1-.578 3.358m-12.99 1.01c-2.336 0-2.704-1.48-2.584-2.096s.8-1.416 2.104-1.416c1.496 0 2.832.384 4.44 1.16c-1.136 1.48-2.52 2.352-3.96 2.352"/></svg>',
        // 钱箱（¥）
        cash: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M3.005 3.003h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1m10 10v-1h3v-2h-2.586L15.54 7.88l-1.414-1.414l-2.121 2.122l-2.121-2.122L8.469 7.88l2.122 2.122H8.005v2h3v1h-3v2h3v2h2v-2h3v-2z"/></svg>',
        // 信用卡
        credit: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.005 10v10a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1V10zm0-2h-20V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1zm-7 8v2h4v-2z"/></svg>',
        // 硬币
        other: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14.005 2.003a8 8 0 0 1 3.292 15.293A8 8 0 1 1 6.711 6.71a8 8 0 0 1 7.294-4.707m-3 7h-2v1a2.5 2.5 0 0 0-.164 4.995l.164.005h2l.09.008a.5.5 0 0 1 0 .984l-.09.008h-4v2h2v1h2v-1a2.5 2.5 0 0 0 .164-4.995l-.164-.005h-2l-.09-.008a.5.5 0 0 1 0-.984l.09-.008h4v-2h-2zm3-5A6 6 0 0 0 9.52 6.016a8 8 0 0 1 8.47 8.471a6 6 0 0 0-3.986-10.484"/></svg>'
    }
    return icons[t] || icons.other
}

function openCreate(): void {
    createForm.name = ''
    createForm.type = 'bank'
    createForm.initialBalance = 0
    createForm.isDefault = false
    createForm.remark = ''
    showCreate.value = true
}

function openEdit(acc: AccountInfo): void {
    editId.value = acc.id
    editForm.name = acc.name
    editForm.type = acc.type
    editForm.isDefault = !!acc.is_default
    editForm.remark = acc.remark || ''
    showEdit.value = true
}

async function handleCreateOk(): Promise<void> {
    if (!createForm.name.trim()) {
        Message.warning('请输入名称')
        return
    }
    const r = await accountStore.createAccount({
        name: createForm.name,
        type: createForm.type,
        initial_balance_cents: Math.round(createForm.initialBalance * 100),
        is_default: createForm.isDefault,
        remark: createForm.remark || undefined
    })
    if (r.ok) {
        Message.success('创建成功')
        showCreate.value = false
        emitRefresh('account')
        emitRefresh('transaction')
    } else {
        Message.error(r.error || '创建失败')
    }
}

async function handleEditOk(): Promise<void> {
    if (!editForm.name.trim()) {
        Message.warning('请输入名称')
        return
    }
    const r = await accountStore.updateAccount(editId.value, {
        name: editForm.name,
        type: editForm.type,
        is_default: editForm.isDefault,
        remark: editForm.remark || undefined
    })
    if (r.ok) {
        Message.success('已更新')
        showEdit.value = false
        emitRefresh('account')
        emitRefresh('transaction')
    } else {
        Message.error(r.error || '更新失败')
    }
}

async function handleDelete(id: string): Promise<void> {
    const r = await accountStore.deleteAccount(id)
    if (r.ok) {
        Message.success('已删除')
        emitRefresh('account')
        emitRefresh('transaction')
    } else {
        Message.error(r.error || '删除失败')
    }
}

function openRepay(acc: { id: string; name: string }): void {
    repayCreditId.value = acc.id
    repayForm.fromAccountId = ''
    repayForm.amount = 0
    repayForm.date = formatLocalDate()
    repayForm.note = ''
    showRepay.value = true
}

async function handleRepayOk(): Promise<void> {
    if (!repayForm.fromAccountId) {
        Message.warning('请选择还款账户')
        return
    }
    if (!repayForm.amount || repayForm.amount <= 0) {
        Message.warning('请输入有效的还款金额')
        return
    }

    const r = await transactionStore.createTransaction({
        type: 'transfer',
        account_id: repayForm.fromAccountId,
        target_account_id: repayCreditId.value,
        amount_cents: Math.round(repayForm.amount * 100),
        date: repayForm.date,
        note: repayForm.note || '信用卡还款'
    })

    if (r.ok) {
        Message.success('还款成功')
        showRepay.value = false
        emitRefresh('account')
        emitRefresh('transaction')
    } else {
        Message.error(r.error || '还款失败')
    }
}
</script>

<style scoped>
.total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    margin-bottom: 16px;
}
.total-label {
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-secondary);
}
.total-value {
    font-family: var(--bb-font-mono);
    font-size: 22px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-accent-text);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
}
.account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
    gap: 12px;
}
.account-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    padding: 18px;
    min-width: 288px;
    transition: all var(--bb-duration) var(--bb-ease);
    animation: card-rise 0.35s var(--bb-ease-spring) both;
    cursor: pointer;
}
@keyframes card-rise {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.account-card:nth-child(1) {
    animation-delay: 0s;
}
.account-card:nth-child(2) {
    animation-delay: 0.05s;
}
.account-card:nth-child(3) {
    animation-delay: 0.1s;
}
.account-card:nth-child(4) {
    animation-delay: 0.15s;
}
.account-card:hover {
    transform: translateY(-2px);
}
.acc-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
}
.acc-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--accent-bg);
    font-size: 20px;
    flex-shrink: 0;
}
.acc-info {
    flex: 1;
    min-width: 0;
}
.acc-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.acc-default-tag {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    border-radius: 4px;
    background: var(--bb-accent);
    color: #fff;
    flex-shrink: 0;
}
.acc-type {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-top: 2px;
}
.acc-del {
    visibility: hidden;
    opacity: 0;
}
.account-card:hover .acc-del {
    visibility: visible;
    opacity: 1;
}
.acc-balance {
    font-family: var(--bb-font-mono);
    font-size: 24px;
    font-weight: var(--bb-weight-bold);
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
}
.acc-balance.negative {
    color: var(--bb-danger);
}
.acc-actions {
    margin-top: 10px;
}
.acc-remark {
    margin-top: 6px;
    font-size: 12px;
    color: var(--bb-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.create-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.form-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--bb-text-secondary);
}
.account-status {
    display: flex;
    min-height: 120px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--bb-text-tertiary);
    font-size: 13px;
}
.account-status.is-error {
    min-height: 52px;
    margin-bottom: 14px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.06);
    color: var(--bb-danger);
}
</style>
