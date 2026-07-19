import { describe, expect, it } from 'vitest'
import { toolRegistry } from '../../src/main/agent/tools/registry'

describe('本地工具注册中心', () => {
    it('运行时工具始终可见，业务工具按已启用 Skill 过滤', () => {
        const allTools = toolRegistry.getToolInfos()

        expect(allTools.map((tool) => tool.name)).toEqual([
            'getSkill',
            'readLocalMemory',
            'writeLocalMemory',
            'createAgentTasks',
            'updateAgentTaskStatus',
            'queryAgentTasks',
            'clearAgentTasks'
        ])

        const enabledSkillNames = new Set([
            'data-query',
            'calculator',
            'analysis',
            'transaction-write',
            'task-planning',
            'user-todo'
        ])
        const enabledTools = toolRegistry.getToolInfos(enabledSkillNames)

        expect(enabledTools.map((tool) => tool.name)).toContain('queryTransactions')
        expect(enabledTools.map((tool) => tool.name)).toContain('createTransaction')
        expect(enabledTools.every((tool) => tool.description.length > 0)).toBe(true)

        const executableTools = toolRegistry.createTools(
            { userId: 'tool-registry-user', conversationId: 'conv-1', emit: async () => undefined },
            enabledSkillNames
        )
        expect(Object.keys(executableTools).sort()).toEqual(
            enabledTools.map((tool) => tool.name).sort()
        )
        for (const toolInfo of enabledTools) {
            const executable = executableTools[toolInfo.name] as { description?: string }
            expect(executable.description).toBe(toolInfo.description)
        }
    })
})
