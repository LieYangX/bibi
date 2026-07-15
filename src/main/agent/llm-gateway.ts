/**
 * LLM 网关 - DeepSeek API 调用封装
 * 基于 Vercel AI SDK，通过 @ai-sdk/deepseek 调用 DeepSeek 模型
 * @author xiangwei
 */

import { createDeepSeek, deepSeek } from '@ai-sdk/deepseek'
import type { DeepSeekProvider } from '@ai-sdk/deepseek'

export type LlmModel = ReturnType<DeepSeekProvider>

/**
 * 创建 DeepSeek 模型实例
 *
 * @param apiKey API Key（可选，不传则使用默认 deepSeek provider）
 * @param modelName 模型名称，默认 deepseek-chat
 * @returns AI SDK 模型实例
 * @author xiangwei
 */
export function createModel(apiKey?: string, modelName: string = 'deepseek-v4-flash'): LlmModel {
    if (apiKey) {
        return createDeepSeek({ apiKey })(modelName)
    }
    return deepSeek(modelName)
}
