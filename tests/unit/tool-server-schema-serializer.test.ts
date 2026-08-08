import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { tool } from 'ai'
import { toolInputSchemaToJson } from '../../src/main/tool-server/schema-serializer'

describe('工具服务 Schema 序列化', () => {
    it('空 inputSchema 返回空对象 schema', () => {
        const emptyTool = tool({
            description: '空工具',
            inputSchema: z.object({}),
            execute: async () => ({ ok: true })
        })

        const schema = toolInputSchemaToJson(emptyTool)

        expect(schema.type).toBe('object')
        expect(schema.properties).toEqual({})
    })

    it('将 Zod 字符串参数转为 JSON Schema', () => {
        const stringTool = tool({
            description: '字符串工具',
            inputSchema: z.object({
                name: z.string().describe('名称')
            }),
            execute: async () => ({ ok: true })
        })

        const schema = toolInputSchemaToJson(stringTool)

        expect(schema.type).toBe('object')
        expect(schema.properties).toEqual({
            name: { type: 'string', description: '名称' }
        })
    })

    it('将 Zod 数字和布尔参数转为 JSON Schema', () => {
        const numberTool = tool({
            description: '数字工具',
            inputSchema: z.object({
                count: z.number().describe('数量'),
                enabled: z.boolean().describe('是否启用')
            }),
            execute: async () => ({ ok: true })
        })

        const schema = toolInputSchemaToJson(numberTool)

        expect(schema.properties).toEqual({
            count: { type: 'number', description: '数量' },
            enabled: { type: 'boolean', description: '是否启用' }
        })
    })

    it('将必填字段标记为 required', () => {
        const requiredTool = tool({
            description: '必填工具',
            inputSchema: z.object({
                start_date: z.string().describe('开始日期'),
                end_date: z.string().optional().describe('结束日期')
            }),
            execute: async () => ({ ok: true })
        })

        const schema = toolInputSchemaToJson(requiredTool)

        expect(schema.required).toEqual(['start_date'])
    })

    it('嵌套对象参数转为 JSON Schema', () => {
        const nestedTool = tool({
            description: '嵌套工具',
            inputSchema: z.object({
                filter: z.object({
                    type: z.string().describe('类型')
                }).describe('过滤条件')
            }),
            execute: async () => ({ ok: true })
        })

        const schema = toolInputSchemaToJson(nestedTool)

        expect(schema.type).toBe('object')
        expect((schema.properties as Record<string, unknown>).filter).toBeDefined()
    })

    it('转换失败时返回空对象 schema', () => {
        const invalidTool = {
            description: '无效工具',
            inputSchema: 'not-a-schema',
            execute: async () => ({ ok: true })
        } as unknown as Parameters<typeof tool>[0]

        const schema = toolInputSchemaToJson(invalidTool as ReturnType<typeof tool>)

        expect(schema.type).toBe('object')
        expect(schema.properties).toEqual({})
    })
})
