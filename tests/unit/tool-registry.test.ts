import { describe, expect, it } from 'vitest'
import { toolRegistry } from '../../src/main/agent/tools/registry'

describe('本地工具注册中心', () => {
    it('独立公开全部工具及用途描述', () => {
        const tools = toolRegistry.getToolInfos()

        expect(tools.slice(0, 3).map((tool) => tool.name)).toEqual([
            'getSkill',
            'readLocalMemory',
            'writeLocalMemory'
        ])
        expect(tools.map((tool) => tool.name)).toContain('queryTransactions')
        expect(tools.map((tool) => tool.name)).toContain('createTransaction')
        expect(tools.every((tool) => tool.description.length > 0)).toBe(true)

        const executableTools = toolRegistry.createTools('tool-registry-user')
        expect(Object.keys(executableTools)).toEqual(tools.map((tool) => tool.name))
        for (const toolInfo of tools) {
            const executable = executableTools[toolInfo.name] as { description?: string }
            expect(executable.description).toBe(toolInfo.description)
        }
    })
})
