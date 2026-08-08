import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { tool } from 'ai'
import { exportToolInfos, executeTool } from '../../src/main/tool-server/tool-router'

const memoryStore = new Map<string, unknown>()

vi.mock('../../src/main/services/setting.service', () => ({
    getSetting: vi.fn(async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
        if (memoryStore.has(key)) {
            return memoryStore.get(key) as T
        }
        return defaultValue
    }),
    setSetting: vi.fn(async (key: string, value: unknown): Promise<void> => {
        memoryStore.set(key, value)
    })
}))

const mockExecute = vi.fn()

vi.mock('../../src/main/agent/tools/registry', () => ({
    toolRegistry: {
        getRawRegisteredTools: vi.fn(() => [
            {
                name: 'queryTransactions',
                group: 'data-query',
                tool: tool({
                    description: '查询流水',
                    inputSchema: z.object({
                        start_date: z.string().describe('开始日期')
                    }),
                    execute: mockExecute
                })
            }
        ]),
        createTools: vi.fn(() => ({
            queryTransactions: tool({
                description: '查询流水',
                inputSchema: z.object({
                    start_date: z.string().describe('开始日期')
                }),
                execute: mockExecute
            })
        }))
    }
}))

vi.mock('../../src/main/agent/skill-registry', () => ({
    skillRegistry: {
        getEnabledSkills: vi.fn(() => [
            { meta: { name: 'data-query', displayName: '数据查询', description: '' } }
        ])
    }
}))

describe('工具服务工具路由', () => {
    beforeEach(() => {
        memoryStore.clear()
        vi.clearAllMocks()
    })

    it('exportToolInfos 返回带 JSON Schema 的工具列表', () => {
        const infos = exportToolInfos()

        expect(infos).toHaveLength(1)
        expect(infos[0].name).toBe('queryTransactions')
        expect(infos[0].description).toBe('查询流水')
        expect(infos[0].parameters.type).toBe('object')
        expect(infos[0].parameters.properties).toBeDefined()
    })

    it('executeTool 对缺少 user_id 抛出异常', async () => {
        await expect(executeTool('queryTransactions', { start_date: '2026-07-01' }))
            .rejects.toThrow('缺少 user_id 参数')
    })

    it('executeTool 对不存在的工具抛出异常', async () => {
        await expect(executeTool('unknownTool', { user_id: 'user-1' }))
            .rejects.toThrow('工具 "unknownTool" 不存在或未启用')
    })

    it('executeTool 调用工具 execute 并返回结果', async () => {
        mockExecute.mockResolvedValueOnce({ total: 10 })

        const result = await executeTool('queryTransactions', {
            user_id: 'user-1',
            start_date: '2026-07-01'
        })

        expect(mockExecute).toHaveBeenCalledWith({ start_date: '2026-07-01' })
        expect(result).toEqual({ total: 10 })
    })
})
