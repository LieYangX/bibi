import { describe, expect, it } from 'vitest'
import type { ModelMessage } from 'ai'
import { buildMessages, buildSystemPrompt } from '../../src/main/agent/context-builder'
import type { SkillDefinition } from '../../src/main/agent/skill-registry'

function createSkill(name: string, description: string, markdown: string): SkillDefinition {
    return {
        meta: {
            name,
            displayName: name,
            description,
            version: '1.0',
            author: 'system',
            isSystem: true,
            isEnabled: true
        },
        markdown,
        isSystem: true
    }
}

function getText(message: ModelMessage): string {
    return typeof message.content === 'string' ? message.content : ''
}

const systemInfo = {
    operatingSystem: 'Windows',
    systemRelease: '10.0.26100',
    architecture: 'x64',
    appVersion: '3.0.5',
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai'
}

describe('智能体上下文构建', () => {
    it('System Prompt 只注入 Skill 名称和描述', () => {
        const prompt = buildSystemPrompt([
            createSkill('data-query', '查询财务数据', '这是不应进入固定上下文的完整内容')
        ])

        expect(prompt).toContain('- data-query: 查询财务数据')
        expect(prompt).not.toContain('这是不应进入固定上下文的完整内容')
        expect(prompt).not.toMatch(/当前时间|当前日期/)
        expect(prompt).not.toMatch(/## Skill 工作流程|## 工具工作流程|is_deleted/)
        expect(prompt.indexOf('## 可用 Skills')).toBeGreaterThan(
            prompt.indexOf('## 财务数据处理规范')
        )
    })

    it('System Prompt 要求温柔、具体且有边界地关心用户', () => {
        const prompt = buildSystemPrompt([])

        expect(prompt).toContain('可靠、温柔的个人记账助手')
        expect(prompt).toContain('用1-2句具体、真诚的话先回应他的情绪')
        expect(prompt).toContain('不评判、不说教、不堆砌模板化安慰')
        expect(prompt).toContain('关心要克制且尊重边界')
    })

    it('System Prompt 要求识别意图、规划任务并完成闭环', () => {
        const prompt = buildSystemPrompt([])

        expect(prompt).toContain('识别用户的真实意图')
        expect(prompt).toContain('任务目标、期望产出、约束和完成标准')
        expect(prompt).toContain('复杂任务先在内部拆解步骤、依赖和所需工具')
        expect(prompt).toContain('工具调用和中间结果只是过程，不代表任务已经完成')
        expect(prompt).toContain('结束前核对结果是否满足用户目标')
        expect(prompt).toContain('禁止虚假宣称完成')
    })

    it('按阈值保留最近用户轮次并在当前消息附带最新灵魂', () => {
        const messages = buildMessages({
            history: [
                { role: 'user', content: '用户一' },
                { role: 'assistant', content: '回答一' },
                { role: 'tool', content: '工具结果' },
                { role: 'user', content: '用户二' },
                { role: 'assistant', content: '回答二' },
                { role: 'user', content: '用户三' },
                { role: 'assistant', content: '回答三' }
            ],
            userMessage: '用户四',
            maxUserTurns: 3,
            soulMemory: '# 灵魂\n\n偏好简洁沟通',
            userName: ' 小 明 ',
            systemInfo,
            currentDate: '2026年7月15日'
        })

        expect(messages).toHaveLength(5)
        expect(getText(messages[0])).toBe('用户二')
        expect(messages.map(getText).join('\n')).not.toContain('用户一')
        expect(getText(messages.at(-1)!)).toContain('用户四')
        expect(getText(messages.at(-1)!)).toContain('偏好简洁沟通')
        expect(getText(messages.at(-1)!)).toContain('2026年7月15日')
        expect(getText(messages.at(-1)!)).toContain('操作系统：Windows 10.0.26100')
        expect(getText(messages.at(-1)!)).toContain('系统架构：x64')
        expect(getText(messages.at(-1)!)).toContain('应用版本：3.0.5')
        expect(getText(messages.at(-1)!)).toContain('语言区域：zh-CN')
        expect(getText(messages.at(-1)!)).toContain('时区：Asia/Shanghai')
        expect(getText(messages.at(-1)!)).toContain('用户名：小 明')
        expect(getText(messages.at(-1)!)).not.toMatch(/用户账户|账户余额|默认账户/)
    })

    it('阈值为一时只发送当前用户轮次', () => {
        const messages = buildMessages({
            history: [
                { role: 'user', content: '旧问题' },
                { role: 'assistant', content: '旧回答' }
            ],
            userMessage: '新问题',
            maxUserTurns: 1,
            soulMemory: '',
            userName: '小明',
            systemInfo,
            currentDate: '2026年7月15日'
        })

        expect(messages).toHaveLength(1)
        expect(getText(messages[0])).toContain('新问题')
        expect(getText(messages[0])).not.toContain('旧问题')
    })
})
