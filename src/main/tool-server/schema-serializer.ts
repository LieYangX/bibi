/**
 * Schema 序列化器
 *
 * 将 PC 端工具的 Zod inputSchema 转换为 JSON Schema，
 * 供 iOS 端构建 function calling 参数。
 *
 * @author xiangwei
 */

import type { Tool } from 'ai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { logger } from '../utils/logger'

/**
 * 判断对象是否提供 toJSONSchema 方法
 */
interface JSONSchemaProvider {
    toJSONSchema: () => Record<string, unknown>
}

function hasToJSONSchema(value: unknown): value is JSONSchemaProvider {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as JSONSchemaProvider).toJSONSchema === 'function'
    )
}

/**
 * 将 AI SDK Tool 的 inputSchema 转为 JSON Schema
 *
 * @param tool AI SDK 工具对象
 * @returns JSON Schema 对象，转换失败时返回空 schema
 * @author xiangwei
 */
export function toolInputSchemaToJson(tool: Tool): Record<string, unknown> {
    try {
        const rawTool = tool as Tool & { inputSchema?: unknown }

        if (!rawTool.inputSchema) {
            return { type: 'object', properties: {} }
        }

        let jsonSchema: Record<string, unknown>

        if (hasToJSONSchema(rawTool.inputSchema)) {
            // AI SDK 包装后的 schema 自带 toJSONSchema 方法
            jsonSchema = rawTool.inputSchema.toJSONSchema()
        } else {
            // 原始 Zod schema 使用 zod-to-json-schema 转换
            jsonSchema = zodToJsonSchema(rawTool.inputSchema as unknown as Parameters<typeof zodToJsonSchema>[0], {
                $refStrategy: 'none'
            }) as Record<string, unknown>
        }

        // 移除 $schema 字段（LLM 不需要）
        const { $schema, ...cleanSchema } = jsonSchema

        return cleanSchema
    } catch (error) {
        logger.warn('ToolServer', 'Zod schema 转 JSON Schema 失败', { error })
        return { type: 'object', properties: {} }
    }
}
