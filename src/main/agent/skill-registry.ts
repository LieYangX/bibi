/**
 * Skill 注册中心
 * 管理所有内置 Skill 和自定义 Skill 的注册、查询、加载
 * 自定义 Skill 存储在应用运行数据目录下的 skills/ JSON 文件中
 * @author xiangwei
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { isAbsolute, join, relative, resolve } from 'path'
import type { SkillMeta } from '@shared/types'
import { getSetting, setSetting } from '../services/setting.service'
import { getAppDataPath } from '../utils/app-data-path'
import { logger } from '../utils/logger'

import { skillMarkdown as dataQueryMarkdown } from './capabilities/data-query'
import { skillMarkdown as calculatorMarkdown } from './capabilities/calculator'
import { skillMarkdown as reportMarkdown } from './capabilities/report'
import { skillMarkdown as analysisMarkdown } from './capabilities/analysis'
import { skillMarkdown as transactionWriteMarkdown } from './capabilities/transaction-write'

export interface SkillDefinition {
    meta: SkillMeta
    markdown: string
    isSystem: boolean
}

/** 自定义 Skill 的 JSON 文件结构 */
interface CustomSkillData {
    name: string
    displayName: string
    description: string
    markdown: string
    version?: string
    author?: string
}

const CUSTOM_SKILL_NAME_PATTERN = /^[a-z0-9-]+$/
const MAX_CUSTOM_SKILL_NAME_LENGTH = 50

const BUILTIN_SKILLS: Array<{
    name: string
    displayName: string
    description: string
    markdown: string
}> = [
    {
        name: 'data-query',
        displayName: '数据查询',
        description: '查询数据库中的流水、账户、预算、统计信息',
        markdown: dataQueryMarkdown
    },
    {
        name: 'calculator',
        displayName: '计算器',
        description: '执行精确的数学计算',
        markdown: calculatorMarkdown
    },
    {
        name: 'report',
        displayName: '报告生成',
        description: '生成周报、月报、年报等结构化财务报告',
        markdown: reportMarkdown
    },
    {
        name: 'analysis',
        displayName: '消费分析',
        description: '消费趋势分析、数据对比、异常检测、理财建议',
        markdown: analysisMarkdown
    },
    {
        name: 'transaction-write',
        displayName: '记账',
        description: '记录新的流水或删除已有流水，按账户名称和分类名称自动匹配',
        markdown: transactionWriteMarkdown
    }
]

export class SkillRegistry {
    private skills = new Map<string, SkillDefinition>()

    /** 自定义 Skill 存储目录 */
    private getCustomSkillsDir(): string {
        return getAppDataPath('skills')
    }

    /**
     * 获取自定义 Skill 文件路径并阻止目录穿越
     *
     * @param name Skill 名称
     * @returns Skill 文件绝对路径
     * @author xiangwei
     */
    private getCustomSkillPath(name: string): string {
        if (
            name.length === 0 ||
            name.length > MAX_CUSTOM_SKILL_NAME_LENGTH ||
            !CUSTOM_SKILL_NAME_PATTERN.test(name)
        ) {
            throw new Error('Skill 名称格式无效')
        }

        const directory = resolve(this.getCustomSkillsDir())
        const filePath = resolve(directory, `${name}.json`)
        const relativePath = relative(directory, filePath)
        if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
            throw new Error('Skill 文件路径无效')
        }
        return filePath
    }

    /** 从 settings 恢复的启停状态 */
    private async loadEnabledStates(): Promise<Record<string, boolean>> {
        const saved = await getSetting<string>('agent_skill_states')
        if (!saved) return {}
        try {
            return JSON.parse(saved) as Record<string, boolean>
        } catch {
            return {}
        }
    }

    private async saveEnabledStates(): Promise<void> {
        const states: Record<string, boolean> = {}
        for (const [name, def] of this.skills) {
            states[name] = def.meta.isEnabled
        }
        await setSetting('agent_skill_states', states)
    }

    /** 加载自定义 Skill（从应用运行数据目录下的 skills/ 读取 JSON 文件） */
    private async loadCustomSkills(): Promise<void> {
        const dir = this.getCustomSkillsDir()
        try {
            await mkdir(dir, { recursive: true })
            const files = await readdir(dir)
            const jsonFiles = files.filter((f) => f.endsWith('.json'))

            for (const file of jsonFiles) {
                try {
                    const content = await readFile(join(dir, file), 'utf-8')
                    const data = JSON.parse(content) as CustomSkillData
                    this.getCustomSkillPath(data.name)
                    const meta: SkillMeta = {
                        name: data.name,
                        displayName: data.displayName,
                        description: data.description,
                        version: data.version || '1.0',
                        author: data.author || 'user',
                        isSystem: false,
                        isEnabled: true
                    }
                    this.skills.set(data.name, {
                        meta,
                        markdown: data.markdown,
                        isSystem: false
                    })
                } catch (err) {
                    logger.error('SkillRegistry', '加载自定义 Skill 失败', { file, error: err })
                }
            }
        } catch (err) {
            logger.error('SkillRegistry', '读取自定义 Skill 目录失败', { error: err })
        }
    }

    async initialize(): Promise<void> {
        this.skills.clear()
        const states = await this.loadEnabledStates()

        for (const def of BUILTIN_SKILLS) {
            const isEnabled = states[def.name] ?? true

            const meta: SkillMeta = {
                name: def.name,
                displayName: def.displayName,
                description: def.description,
                version: '1.0',
                author: 'system',
                isSystem: true,
                isEnabled
            }
            this.skills.set(def.name, {
                meta,
                markdown: def.markdown,
                isSystem: true
            })
        }

        await this.loadCustomSkills()
        logger.info('SkillRegistry', 'Skill 注册完成', { skillCount: this.skills.size })
    }

    /**
     * 创建自定义 Skill
     * 写入 JSON 文件并注册到内存
     * @author xiangwei
     */
    async createCustomSkill(data: CustomSkillData): Promise<void> {
        if (this.skills.has(data.name)) {
            throw new Error(`Skill "${data.name}" 已存在`)
        }
        if (BUILTIN_SKILLS.some((s) => s.name === data.name)) {
            throw new Error(`"${data.name}" 是系统 Skill 名称，请使用其他名称`)
        }

        const dir = this.getCustomSkillsDir()
        await mkdir(dir, { recursive: true })
        const filePath = this.getCustomSkillPath(data.name)
        const payload: CustomSkillData = {
            ...data,
            version: data.version || '1.0',
            author: data.author || 'user'
        }
        await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')

        const meta: SkillMeta = {
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            version: payload.version!,
            author: payload.author!,
            isSystem: false,
            isEnabled: true
        }
        this.skills.set(data.name, { meta, markdown: data.markdown, isSystem: false })
    }

    /**
     * 删除自定义 Skill
     * 删除 JSON 文件并从内存移除
     * @author xiangwei
     */
    async deleteCustomSkill(name: string): Promise<void> {
        const def = this.skills.get(name)
        if (!def) throw new Error(`Skill "${name}" 不存在`)
        if (def.isSystem) throw new Error('不能删除系统 Skill')

        const filePath = this.getCustomSkillPath(name)
        await unlink(filePath)
        this.skills.delete(name)
    }

    getAllSkillMetas(): SkillMeta[] {
        return Array.from(this.skills.values()).map((def) => def.meta)
    }

    getSkill(name: string): SkillDefinition | undefined {
        return this.skills.get(name)
    }

    async toggleSkill(name: string, enabled: boolean): Promise<boolean> {
        const def = this.skills.get(name)
        if (!def) return false
        def.meta.isEnabled = enabled
        await this.saveEnabledStates()
        return true
    }

    getEnabledSkills(): SkillDefinition[] {
        return Array.from(this.skills.values()).filter((def) => def.meta.isEnabled)
    }
}

export const skillRegistry = new SkillRegistry()
