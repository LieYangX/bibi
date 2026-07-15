/**
 * 智能体配置读写
 * 统一维护默认值与设置键，避免主流程和 IPC 使用不同配置。
 *
 * @author xiangwei
 */

import {
    DEFAULT_MEMORY_DISTILLATION_THRESHOLD,
    MAX_MEMORY_DISTILLATION_THRESHOLD,
    MIN_MEMORY_DISTILLATION_THRESHOLD,
    type AgentConfig
} from '@shared/types'
import { getSetting, setSetting } from '../services/setting.service'

/**
 * 读取完整智能体配置
 *
 * @returns 智能体配置
 * @author xiangwei
 */
export async function loadAgentConfig(): Promise<AgentConfig> {
    const memoryDistillationThreshold = normalizeMemoryDistillationThreshold(
        await getSetting<number>('agent_memory_distillation_threshold')
    )
    return {
        apiKey: (await getSetting<string>('agent_api_key')) ?? '',
        model: (await getSetting<string>('agent_model')) ?? 'deepseek-v4-flash',
        temperature: (await getSetting<number>('agent_temperature')) ?? 0.7,
        maxTokens: (await getSetting<number>('agent_max_tokens')) ?? 4096,
        memoryDistillationThreshold,
        enabled: (await getSetting<boolean>('agent_enabled')) ?? false
    }
}

/**
 * 将持久化阈值收敛到公开配置允许的范围。
 *
 * @param value 持久化值
 * @returns 可用阈值
 * @author xiangwei
 */
function normalizeMemoryDistillationThreshold(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return DEFAULT_MEMORY_DISTILLATION_THRESHOLD
    }
    return Math.min(
        MAX_MEMORY_DISTILLATION_THRESHOLD,
        Math.max(MIN_MEMORY_DISTILLATION_THRESHOLD, value)
    )
}

/**
 * 更新智能体配置
 *
 * @param config 待更新的配置字段
 * @author xiangwei
 */
export async function updateAgentConfig(config: Partial<AgentConfig>): Promise<void> {
    if (config.apiKey !== undefined) await setSetting('agent_api_key', config.apiKey)
    if (config.model !== undefined) await setSetting('agent_model', config.model)
    if (config.temperature !== undefined) {
        await setSetting('agent_temperature', config.temperature)
    }
    if (config.maxTokens !== undefined) await setSetting('agent_max_tokens', config.maxTokens)
    if (config.memoryDistillationThreshold !== undefined) {
        await setSetting('agent_memory_distillation_threshold', config.memoryDistillationThreshold)
    }
    if (config.enabled !== undefined) await setSetting('agent_enabled', config.enabled)
}
