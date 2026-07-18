import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../../src/main/agent/context/system-prompt'
import type { SkillDefinition } from '../../src/main/agent/skill-registry'

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
    it('要求先加载匹配的 Skill，再规划、执行和验证', () => {
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

        expect(prompt).toContain('- data-query（数据查询）：查询流水和账户数据')
        expect(prompt).toContain('必须先 getSkill 读完整内容才能调工具')
        expect(prompt).toContain('读 Skill 后再制定')
        expect(prompt).toContain('逐步调工具')
        expect(prompt).toContain('验证通过才确认完成')
        expect(prompt).toContain(
            '先匹配 Skill；命中后先 getSkill；读取完整内容后制定计划；按计划分步调用工具；最后验证结果。'
        )
        expect(prompt.indexOf('## 可用 Skills')).toBeLessThan(prompt.indexOf('## 可用工具（内置）'))
        expect(prompt).not.toContain('直接调用工具，不必先 getSkill')
    })

    it('没有启用 Skill 时明确展示空目录', () => {
        const prompt = buildSystemPrompt([], [], [])

        expect(prompt).toContain('- 暂无已启用 Skill')
        expect(prompt).toContain('无匹配 Skill 但有合适工具时')
    })
})
