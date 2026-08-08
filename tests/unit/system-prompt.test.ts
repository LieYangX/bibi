import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../../src/main/agent/context/system-prompt'
import type { SkillDefinition } from '../../src/main/agent/skill-registry'
import { toolRegistry } from '../../src/main/agent/tools/registry'

const skillDefinitions: SkillDefinition[] = [
    {
        meta: {
            name: 'data-query',
            displayName: '数据查询',
            description: '查询流水和账户数据',
            version: '1.0',
            author: 'system',
            isSystem: true,
            isEnabled: true
        },
        markdown: '# 数据查询 Skill',
        isSystem: true
    }
]

describe('Agent 系统提示词', () => {
    it('按 Role → Capabilities → Tools → Output → Examples → Guardrails → Recap 分层', () => {
        const prompt = buildSystemPrompt(
            skillDefinitions,
            [
                {
                    label: '数据查询',
                    tools: [{ name: 'queryTransactions', description: '查询流水' }]
                }
            ],
            []
        )

        expect(prompt).toContain('<role>')
        expect(prompt).toContain('<capabilities>')
        expect(prompt).toContain('<tool_policies>')
        expect(prompt).toContain('<tools>')
        expect(prompt).toContain('<output_format>')
        expect(prompt).toContain('<examples>')
        expect(prompt).toContain('<guardrails>')
        expect(prompt).toContain('<recap>')
        // 运行时上下文、执行协议、结构化输出指令已移至桌面端用户消息
        expect(prompt).not.toContain('<context>')
        expect(prompt).not.toContain('<execution_protocol>')
        expect(prompt).not.toContain('<structured_output>')
    })

    it('区分原子型与流程型 Skill，并正确展示能力域', () => {
        const prompt = buildSystemPrompt(
            skillDefinitions,
            [
                {
                    label: '数据查询',
                    tools: [{ name: 'queryTransactions', description: '查询流水' }]
                }
            ],
            []
        )

        expect(prompt).toContain('[数据查询] 查询流水和账户数据')
        expect(prompt).toContain('原子型：工具之间无强依赖，可直接调用，无需先 getSkill')
        expect(prompt).toContain('流程型：涉及确认步骤或模板结构，必须先 getSkill 读取完整流程')
    })

    it('没有启用 Skill 时明确展示空目录', () => {
        const prompt = buildSystemPrompt([], [], [])

        expect(prompt).toContain('- 暂无已启用能力域')
    })

    it('任务规划工具出现在 tools 目录中且描述清晰', () => {
        const enabledSkillNames = new Set([
            'data-query',
            'calculator',
            'analysis',
            'transaction-write',
            'task-planning',
            'user-todo'
        ])
        const groupedTools = toolRegistry.getGroupedToolInfos(enabledSkillNames)
        const prompt = buildSystemPrompt(skillDefinitions, groupedTools, [])

        // 任务规划工具必须在 system prompt 的 tools 段出现
        expect(prompt).toContain('任务规划')
        expect(prompt).toContain('创建任务清单')
        expect(prompt).toContain('更新任务状态')
        expect(prompt).toContain('查询任务进度')
        expect(prompt).toContain('清空任务清单')
    })
})
