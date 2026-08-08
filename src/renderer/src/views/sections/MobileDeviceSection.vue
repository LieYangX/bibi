<template>
    <div class="settings-card">
        <div class="settings-head">
            <Smartphone :size="18" />
            <span>移动设备联动</span>
        </div>

        <!-- 开关 -->
        <div class="settings-row">
            <div class="settings-info">
                <div class="settings-title">允许移动设备连接</div>
                <div class="settings-desc">
                    开启后，同一 WiFi 下的 iOS 设备可连接本机记账数据
                </div>
            </div>
            <BbSwitch
                :model-value="enabled"
                :loading="toggling"
                @update:model-value="onToggle"
            />
        </div>

        <!-- 开关开启后才显示以下内容 -->
        <template v-if="enabled">
            <div class="settings-divider"></div>

            <!-- 服务状态 -->
            <div class="settings-row">
                <div class="settings-info">
                    <div class="settings-title">服务状态</div>
                    <div class="settings-desc">
                        <span v-if="serverRunning" class="status-indicator status-indicator--online"></span>
                        <span v-else class="status-indicator status-indicator--offline"></span>
                        <span v-if="serverRunning">运行中 端口 19878</span>
                        <span v-else>已停止</span>
                    </div>
                </div>
            </div>

            <!-- 生成配对码 -->
            <div class="settings-row">
                <div class="settings-info">
                    <div class="settings-title">配对码</div>
                    <div class="settings-desc">
                        <template v-if="pairingCode">
                            配对码：<strong class="pairing-code">{{ pairingCode }}</strong>
                            <span class="pairing-countdown">（{{ countdown }}秒后过期）</span>
                        </template>
                        <template v-else>
                            在 iOS 端输入配对码进行连接
                        </template>
                    </div>
                </div>
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="generatingCode"
                    @click="onGenerateCode"
                >
                    {{ generatingCode ? '生成中...' : pairingCode ? '重新生成' : '生成配对码' }}
                </button>
            </div>

            <!-- 已配对设备列表 -->
            <div class="settings-row">
                <div class="settings-info">
                    <div class="settings-title">已配对设备</div>
                    <div class="settings-desc">
                        <div v-if="pairedDevices.length === 0" class="settings-empty">暂无设备</div>
                        <div
                            v-for="device in pairedDevices"
                            :key="device.token"
                            class="paired-device-row"
                        >
                            <span class="paired-device-name">{{ device.deviceName }}</span>
                            <span class="paired-device-date">{{ formatDate(device.pairedAt) }}</span>
                            <button
                                class="bb-btn bb-btn-text bb-btn-text--danger"
                                :disabled="revokingDevice === device.token"
                                @click="onRevokeDevice(device.token)"
                            >
                                {{ revokingDevice === device.token ? '撤销中...' : '撤销' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * 移动设备联动设置
 *
 * @author xiangwei
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { BbSwitch, Message } from '../../components/ui'
import { desktopApi } from '../../api/desktop-api'
import { Smartphone } from '@lucide/vue'

/** 开关状态 */
const enabled = ref(false)
const toggling = ref(false)

/** 服务运行状态 */
const serverRunning = ref(false)

/** 配对码 */
const pairingCode = ref('')
const countdown = ref(0)
const generatingCode = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 已配对设备 */
interface PairedDevice {
    token: string
    deviceName: string
    pairedAt: string
    lastSeenAt: string
}
const pairedDevices = ref<PairedDevice[]>([])
const revokingDevice = ref('')

/** 加载开关状态 */
async function loadStatus(): Promise<void> {
    const result = await desktopApi.toolServer.getStatus()
    if (result.ok) {
        enabled.value = result.data.enabled
        serverRunning.value = result.data.enabled
    }
}

/** 切换开关 */
async function onToggle(enable: boolean): Promise<void> {
    toggling.value = true
    try {
        const result = await desktopApi.toolServer.toggle(enable)
        if (result.ok) {
            enabled.value = result.data.enabled
            serverRunning.value = result.data.enabled
        } else {
            Message.error(result.error || '切换失败')
            // 恢复开关状态
            enabled.value = !enable
        }
    } catch {
        Message.error('切换失败')
        enabled.value = !enable
    } finally {
        toggling.value = false
    }
}

/** 生成配对码 */
async function onGenerateCode(): Promise<void> {
    generatingCode.value = true
    try {
        const result = await desktopApi.toolServer.generateCode()
        if (result.ok) {
            pairingCode.value = result.data.code
            countdown.value = result.data.expiresIn
            startCountdown()
        } else {
            Message.error(result.error || '生成配对码失败')
        }
    } catch {
        Message.error('生成配对码失败')
    } finally {
        generatingCode.value = false
    }
}

/** 倒计时 */
function startCountdown(): void {
    if (countdownTimer) {
        clearInterval(countdownTimer)
    }
    countdownTimer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
            pairingCode.value = ''
            countdown.value = 0
            if (countdownTimer) {
                clearInterval(countdownTimer)
                countdownTimer = null
            }
        }
    }, 1000)
}

/** 撤销设备 */
async function onRevokeDevice(token: string): Promise<void> {
    revokingDevice.value = token
    try {
        const result = await desktopApi.toolServer.revokeDevice(token)
        if (result.ok) {
            pairedDevices.value = pairedDevices.value.filter(d => d.token !== token)
        } else {
            Message.error(result.error || '撤销设备失败')
        }
    } catch {
        Message.error('撤销设备失败')
    } finally {
        revokingDevice.value = ''
    }
}

/** 加载已配对设备 */
async function loadDevices(): Promise<void> {
    const result = await desktopApi.toolServer.listDevices()
    if (result.ok) {
        pairedDevices.value = result.data
    }
}

/** 格式化日期 */
function formatDate(isoString: string): string {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

onMounted(() => {
    void loadStatus()
    void loadDevices()
})

onUnmounted(() => {
    if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
    }
})
</script>

<style scoped>
.settings-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 16px;
}
.settings-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--bb-border);
}
.settings-head svg {
    color: var(--bb-accent);
}
.settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
.settings-row + .settings-row {
    margin-top: 14px;
}
.settings-info {
    flex: 1;
    min-width: 0;
}
.settings-title {
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
}
.settings-desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-top: 2px;
    line-height: 1.4;
}
.settings-divider {
    height: 1px;
    background: var(--bb-border);
    margin: 16px 0;
}
.settings-empty {
    color: var(--bb-text-quaternary);
    font-style: italic;
}
.status-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
}
.status-indicator--online {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}
.status-indicator--offline {
    background: #ef4444;
}
.pairing-code {
    font-family: var(--bb-font-mono, 'SF Mono', 'Fira Code', monospace);
    font-size: 18px;
    letter-spacing: 4px;
    color: var(--bb-text-primary);
}
.pairing-countdown {
    color: var(--bb-text-quaternary);
    font-size: 12px;
    margin-left: 8px;
}
.paired-device-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
}
.paired-device-row:first-child {
    margin-top: 4px;
}
.paired-device-name {
    font-size: 13px;
    color: var(--bb-text-primary);
    flex: 1;
}
.paired-device-date {
    font-size: 11px;
    color: var(--bb-text-quaternary);
}
</style>
