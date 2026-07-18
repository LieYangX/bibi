<template>
    <div class="agent-fields">
        <!-- 启用开关（立即保存） -->
        <div class="setting-field">
            <div class="setting-row">
                <div class="setting-info">
                    <div class="setting-title">启用小笔</div>
                    <div class="setting-desc">启用后可访问小笔智能体</div>
                </div>
                <BbSwitch
                    :model-value="localConfig.enabled"
                    :disabled="saving"
                    @change="onToggleEnabled"
                />
            </div>
        </div>

        <div class="setting-field">
            <div class="setting-row">
                <div class="setting-info">
                    <div class="setting-title">记忆提炼阈值</div>
                    <div class="setting-desc">累计达到该数量的用户消息后更新灵魂记忆</div>
                </div>
                <div class="memory-threshold-control">
                    <input
                        v-model.number="localConfig.memoryDistillationThreshold"
                        type="number"
                        class="bb-input memory-threshold-input"
                        :min="MIN_MEMORY_DISTILLATION_THRESHOLD"
                        :max="MAX_MEMORY_DISTILLATION_THRESHOLD"
                        :disabled="saving"
                        aria-label="记忆提炼阈值"
                        @change="saveMemoryDistillationThreshold"
                    />
                    <span>条</span>
                </div>
            </div>
        </div>

        <!-- API Key（独立保存） -->
        <div class="setting-field">
            <label class="setting-label">API Key</label>
            <div class="setting-input-row">
                <input
                    v-model="apiKeyInput"
                    type="password"
                    class="bb-input"
                    placeholder="sk-..."
                />
                <button
                    class="bb-btn bb-btn--primary"
                    :disabled="!apiKeyInput || saving"
                    @click="saveApiKey"
                >
                    保存
                </button>
                <button
                    v-if="localConfig.apiKey"
                    class="bb-btn bb-btn-danger"
                    :disabled="saving"
                    @click="clearApiKey"
                >
                    清除
                </button>
            </div>
            <p class="setting-desc">
                在
                <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek 控制台</a>
                获取 API Key
            </p>
        </div>

        <!-- 温度（变更立即保存） -->
        <div class="setting-field">
            <div class="setting-row">
                <div class="setting-info">
                    <div class="setting-title">温度 ({{ localConfig.temperature }})</div>
                    <div class="setting-desc">较低的值使回答更确定，较高的值使回答更具创造性</div>
                </div>
                <input
                    v-model.number="localConfig.temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    class="bb-range"
                    :disabled="saving"
                    @change="savePartial({ temperature: localConfig.temperature })"
                />
            </div>
        </div>

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
import { ref, onMounted, reactive } from 'vue'
import { useAgentStore } from '../../stores/agent.store'
import { BbSwitch } from '../../components/ui'
import type { AgentConfig } from '@shared/types'
import {
    DEFAULT_MEMORY_DISTILLATION_THRESHOLD,
    MAX_MEMORY_DISTILLATION_THRESHOLD,
    MIN_MEMORY_DISTILLATION_THRESHOLD
} from '../../../../shared/types/agent'

const agentStore = useAgentStore()

const localConfig = reactive<AgentConfig>({
    apiKey: '',
    model: 'deepseek-v4-flash',
    temperature: 0.7,
    maxTokens: 4096,
    memoryDistillationThreshold: DEFAULT_MEMORY_DISTILLATION_THRESHOLD,
    enabled: false
})

/** API Key 独立输入（不自动绑定到 localConfig，需手动保存） */
const apiKeyInput = ref('')

const saving = ref(false)
const feedback = ref('')
const feedbackOk = ref(false)

let feedbackTimer: ReturnType<typeof setTimeout> | null = null

function showFeedback(msg: string, ok: boolean): void {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedback.value = msg
    feedbackOk.value = ok
    feedbackTimer = setTimeout(() => {
        feedback.value = ''
    }, 3000)
}

onMounted(async () => {
    await agentStore.initialize()
    Object.assign(localConfig, agentStore.config)
    apiKeyInput.value = localConfig.apiKey
})

async function savePartial(patch: Partial<AgentConfig>): Promise<void> {
    saving.value = true
    const ok = await agentStore.saveConfig(patch)
    saving.value = false
    if (ok) {
        Object.assign(localConfig, patch)
        showFeedback('已保存', true)
    } else {
        showFeedback('保存失败', false)
    }
}

function onToggleEnabled(checked: boolean): void {
    localConfig.enabled = checked
    savePartial({ enabled: checked })
}

function saveMemoryDistillationThreshold(): void {
    const threshold = Math.min(
        MAX_MEMORY_DISTILLATION_THRESHOLD,
        Math.max(
            MIN_MEMORY_DISTILLATION_THRESHOLD,
            Math.round(
                localConfig.memoryDistillationThreshold || DEFAULT_MEMORY_DISTILLATION_THRESHOLD
            )
        )
    )
    localConfig.memoryDistillationThreshold = threshold
    void savePartial({ memoryDistillationThreshold: threshold })
}

async function saveApiKey(): Promise<void> {
    if (!apiKeyInput.value) return
    localConfig.apiKey = apiKeyInput.value
    await savePartial({ apiKey: apiKeyInput.value })
}

async function clearApiKey(): Promise<void> {
    localConfig.apiKey = ''
    apiKeyInput.value = ''
    await savePartial({ apiKey: '' })
}
</script>

<style scoped>
.agent-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
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

.setting-desc a {
    color: var(--bb-accent);
    text-decoration: none;
}
.setting-desc a:hover {
    text-decoration: underline;
}

.setting-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
}
.setting-input-row .bb-input {
    flex: 1;
}

.memory-threshold-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    color: var(--bb-text-secondary);
    font-size: 13px;
}

.memory-threshold-input {
    width: 76px;
    text-align: center;
}

.setting-feedback {
    font-size: 13px;
    padding: 8px 12px;
    border-radius: var(--bb-radius-sm);
    margin-top: 12px;
}
.feedback--ok {
    background: var(--bb-success-light);
    color: var(--bb-success);
}
.feedback--err {
    background: var(--bb-danger-light);
    color: var(--bb-danger);
}

.bb-range {
    width: 140px;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bb-border);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
}
.bb-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--bb-accent);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.bb-range::-webkit-slider-thumb:hover {
    transform: scale(1.15);
}
.bb-range::-moz-range-track {
    height: 6px;
    background: var(--bb-border);
    border-radius: 3px;
    border: none;
}
.bb-range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--bb-accent);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    cursor: pointer;
}
</style>
