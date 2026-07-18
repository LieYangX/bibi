<template>
    <div class="stt-fields">
        <!-- 启用开关 -->
        <div class="setting-field">
            <div class="setting-row">
                <div class="setting-info">
                    <div class="setting-title">启用语音输入</div>
                    <div class="setting-desc">
                        在智能体对话页显示麦克风按钮，通过本地模型将语音转为文字
                    </div>
                </div>
                <BbSwitch
                    :model-value="enabled"
                    :disabled="downloading"
                    @change="onToggleEnabled"
                />
            </div>
        </div>

        <!-- 已启用：模型选择与下载管理 -->
        <template v-if="enabled">
            <!-- 模型选择 -->
            <div class="setting-field">
                <label class="setting-label">识别模型</label>
                <div class="setting-model-row">
                    <div class="setting-model-select">
                        <BbSelect
                            :model-value="selectedModel"
                            :options="modelOptions"
                            :disabled="downloading"
                            @update:model-value="selectedModel = $event as string"
                        />
                    </div>
                    <span class="setting-model-desc">{{ currentModelDesc }}</span>
                </div>
            </div>

            <!-- 状态：未下载 -->
            <div v-if="modelStatus === 'none' && !modelCached" class="setting-field">
                <div class="setting-hint setting-hint--warn">
                    <AlertCircle :size="14" />
                    模型尚未下载，点击下方按钮开始下载
                </div>
                <button class="bb-btn bb-btn-primary" :disabled="downloading" @click="onDownload">
                    <Download :size="14" />
                    下载模型（{{ currentModelSize }}）
                </button>
            </div>

            <!-- 状态：下载中 -->
            <div v-if="modelStatus === 'loading' || downloading" class="setting-field">
                <div class="setting-download">
                    <div class="setting-download__head">
                        <Loader :size="14" class="spin" />
                        <span>{{ downloadStatusText }}</span>
                        <span class="setting-download__pct">{{ downloadPercent }}%</span>
                    </div>
                    <div class="setting-download__bar">
                        <div
                            class="setting-download__fill"
                            :style="{ width: downloadPercent + '%' }"
                        />
                    </div>
                    <div v-if="downloadFile" class="setting-download__file">
                        正在下载：{{ downloadFile }}
                    </div>
                </div>
            </div>

            <!-- 状态：已下载或已加载 -->
            <div
                v-if="(modelStatus === 'ready' || modelCached) && !downloading"
                class="setting-field"
            >
                <div class="setting-hint setting-hint--ok">
                    <CheckCircle :size="14" />
                    {{
                        modelStatus === 'ready'
                            ? '模型已加载，可以直接使用语音输入'
                            : '模型已下载，使用语音输入时会自动加载'
                    }}
                </div>
                <div class="setting-model-actions">
                    <button class="bb-btn" @click="onReDownload">
                        <RefreshCw :size="14" />
                        重新下载
                    </button>
                    <button class="bb-btn bb-btn-danger" @click="onDelete">
                        <Trash2 :size="14" />
                        删除模型
                    </button>
                </div>
            </div>

            <!-- 状态：错误 -->
            <div v-if="modelStatus === 'error'" class="setting-field">
                <div class="setting-hint setting-hint--err">
                    <AlertCircle :size="14" />
                    模型加载失败：{{ modelError }}
                </div>
                <button class="bb-btn bb-btn-primary" @click="onDownload">
                    <RefreshCw :size="14" />
                    重新下载
                </button>
            </div>
        </template>

        <!-- 反馈消息 -->
        <div
            v-if="feedback"
            class="setting-feedback"
            :class="feedbackOk ? 'feedback--ok' : 'feedback--err'"
        >
            {{ feedback }}
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 语音转文字设置面板
 * @author xiangwei
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { desktopApi } from '../../api/desktop-api'
import { BbSwitch, BbSelect } from '../../components/ui'
import { Download, Trash2, RefreshCw, AlertCircle, CheckCircle, Loader } from '@lucide/vue'

/** 可用模型列表 */
interface SttModelInfo {
    id: string
    name: string
    size: string
    desc: string
}

const modelList = ref<SttModelInfo[]>([])
const selectedModel = ref('Xenova/whisper-base')
const enabled = ref(false)
const modelStatus = ref<'none' | 'loading' | 'ready' | 'error'>('none')
const modelCached = ref(false)
const modelError = ref<string | null>(null)
const downloading = ref(false)
const downloadPercent = ref(0)
const downloadFile = ref('')
const downloadStatusText = ref('')
/** 当前加载是否来自缓存（切换模型而非首次下载） */
const loadingFromCache = ref(false)
const feedback = ref('')
const feedbackOk = ref(false)

let cleanupProgress: (() => void) | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const currentModelDesc = computed(() => {
    const m = modelList.value.find((x) => x.id === selectedModel.value)
    return m ? m.desc : ''
})

const currentModelSize = computed(() => {
    const m = modelList.value.find((x) => x.id === selectedModel.value)
    return m ? m.size : ''
})

const modelOptions = computed(() =>
    modelList.value.map((m) => ({
        value: m.id,
        label: `${m.name}（${m.size}）`
    }))
)

function showFeedback(msg: string, ok: boolean): void {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedback.value = msg
    feedbackOk.value = ok
    feedbackTimer = setTimeout(() => {
        feedback.value = ''
    }, 4000)
}

async function refreshStatus(): Promise<void> {
    // 传入用户当前选中的模型 ID，后端会检查该特定模型是否就绪
    const result = await desktopApi.agent.sttModelStatus(selectedModel.value)
    if (!result.ok) return
    const data = result.data as {
        status: 'none' | 'loading' | 'ready' | 'error'
        currentModel: string | null
        error: string | null
        cached: boolean
        models: SttModelInfo[]
    }
    modelList.value = data.models
    // 注意：不覆盖 selectedModel，保持用户的选择
    modelStatus.value = data.status
    modelCached.value = data.cached
    modelError.value = data.error

    // 如果正在加载，订阅进度
    if (data.status === 'loading') {
        // 缓存存在说明是从磁盘加载（切换），否则是真下载
        loadingFromCache.value = data.cached
        downloadStatusText.value = data.cached ? '切换中…' : '正在下载模型…'
        downloading.value = true
        subscribeProgress()
    }
}

function subscribeProgress(): void {
    cleanupProgress?.()
    cleanupProgress = desktopApi.agent.onTranscribeProgress((event) => {
        if (event.status === 'progress' && event.progress !== undefined) {
            if (event.progress === -1) {
                downloadStatusText.value = '正在转录…'
                downloadPercent.value = 100
            } else {
                downloadPercent.value = event.progress
                downloadFile.value = event.file || ''
                // 缓存模型切换不走网络下载，显示切换中而非下载中
                downloadStatusText.value = loadingFromCache.value ? '切换中…' : '正在下载模型…'
            }
        } else if (event.status === 'initiate' || event.status === 'download') {
            downloadPercent.value = 0
            downloadFile.value = event.file || ''
            downloadStatusText.value = loadingFromCache.value ? '切换中…' : '准备下载…'
        } else if (event.status === 'ready') {
            downloadPercent.value = 100
            downloadFile.value = ''
            downloading.value = false
            modelStatus.value = 'ready'
            modelCached.value = true
            showFeedback(loadingFromCache.value ? '模型切换完成' : '模型下载完成', true)
            loadingFromCache.value = false
            cleanupProgress?.()
            cleanupProgress = null
        } else if (event.status === 'error') {
            downloading.value = false
            modelStatus.value = 'error'
            modelError.value = event.error || '下载失败'
            showFeedback(event.error || '下载失败', false)
            cleanupProgress?.()
            cleanupProgress = null
        }
    })
}

async function onToggleEnabled(checked: boolean): Promise<void> {
    const prev = enabled.value
    enabled.value = checked
    const r = await desktopApi.setting.set('stt_enabled', checked)
    if (!r.ok) {
        enabled.value = prev
        showFeedback('保存设置失败', false)
        return
    }
    if (checked) {
        await refreshStatus()
    }
}

async function onDownload(): Promise<void> {
    loadingFromCache.value = false
    modelCached.value = false
    downloading.value = true
    downloadPercent.value = 0
    downloadFile.value = ''
    downloadStatusText.value = '正在下载模型…'
    subscribeProgress()

    const result = await desktopApi.agent.sttDownloadModel(selectedModel.value)
    if (!result.ok) {
        downloading.value = false
        modelStatus.value = 'error'
        modelError.value = result.error || '下载失败'
        showFeedback(result.error || '下载失败', false)
        cleanupProgress?.()
        cleanupProgress = null
    }
    // 进度由 onTranscribeProgress 驱动
}

async function onReDownload(): Promise<void> {
    // 先删除旧模型再重新下载
    const del = await desktopApi.agent.sttDeleteModel(selectedModel.value)
    if (!del.ok) {
        showFeedback('删除旧模型失败', false)
        return
    }
    modelStatus.value = 'none'
    modelCached.value = false
    await onDownload()
}

async function onDelete(): Promise<void> {
    const del = await desktopApi.agent.sttDeleteModel(selectedModel.value)
    if (!del.ok) {
        showFeedback('删除模型失败', false)
        return
    }
    modelStatus.value = 'none'
    modelCached.value = false
    modelError.value = null
    showFeedback('模型已删除', true)
}

// 切换模型时重新检查状态
watch(selectedModel, async () => {
    if (enabled.value) {
        // 保存用户选择的模型
        await desktopApi.setting.set('stt_model', selectedModel.value)
        await refreshStatus()
    }
})

onMounted(async () => {
    // 读取保存的设置
    const enabledResult = await desktopApi.setting.get<boolean>('stt_enabled', false)
    if (enabledResult.ok) {
        enabled.value = enabledResult.data === true
    }
    const modelResult = await desktopApi.setting.get<string>('stt_model', 'Xenova/whisper-base')
    if (modelResult.ok && modelResult.data) {
        selectedModel.value = modelResult.data
    }
    if (enabled.value) {
        await refreshStatus()
    } else {
        // 不带状态地加载模型列表
        const result = await desktopApi.agent.sttModelStatus()
        if (result.ok) {
            const data = result.data as { status: string; models: SttModelInfo[] }
            modelList.value = data.models
        }
    }
})

onUnmounted(() => {
    cleanupProgress?.()
    if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<style scoped>
.stt-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.setting-field {
    margin-bottom: 0;
}

.setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.setting-info {
    flex: 1;
    min-width: 0;
}

.setting-title {
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
}

.setting-desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-top: 2px;
    line-height: 1.4;
}

.setting-label {
    display: block;
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-tertiary);
    margin-bottom: 6px;
}

.setting-model-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.setting-model-select {
    width: 200px;
    flex-shrink: 0;
}
.setting-model-desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    flex: 1;
    min-width: 0;
}

/* 提示条 */
.setting-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 8px 12px;
    border-radius: var(--bb-radius-sm);
    margin-bottom: 10px;
}
.setting-hint--warn {
    background: var(--bb-warning-light);
    color: var(--bb-warning);
}
.setting-hint--ok {
    background: rgba(34, 197, 94, 0.08);
    color: #16a34a;
}
.setting-hint--err {
    background: rgba(229, 62, 62, 0.08);
    color: #c53030;
}

/* 下载进度 */
.setting-download {
    background: var(--bb-bg-input);
    border-radius: var(--bb-radius-sm);
    padding: 12px;
}
.setting-download__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--bb-text-secondary);
    margin-bottom: 8px;
}
.setting-download__pct {
    margin-left: auto;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-accent);
}
.setting-download__bar {
    height: 6px;
    background: var(--bb-border-light);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
}
.setting-download__fill {
    height: 100%;
    background: var(--bb-accent);
    border-radius: 3px;
    transition: width 0.3s var(--bb-ease);
}
.setting-download__file {
    font-size: 11px;
    color: var(--bb-text-disabled);
    word-break: break-all;
}

/* 操作按钮组 */
.setting-model-actions {
    display: flex;
    gap: 8px;
}

/* 反馈消息 */
.setting-feedback {
    font-size: 13px;
    padding: 8px 12px;
    border-radius: var(--bb-radius-sm);
    margin-top: 12px;
}
.feedback--ok {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
}
.feedback--err {
    background: rgba(229, 62, 62, 0.1);
    color: #c53030;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
.spin {
    animation: spin 1s linear infinite;
}
</style>
