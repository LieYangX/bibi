/**
 * 本地工具注册中心
 * 独立管理工具发现、用途描述和用户边界，不依赖 Skill 启停状态。
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import type { AgentToolInfo } from '@shared/types'
import { getPersistedCurrentUserId, runWithBoundUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import { summarizeLogValue } from '../../utils/log-sanitizer'
import * as dataQueryTools from '../capabilities/data-query'
import * as calculatorTools from '../capabilities/calculator'
import * as analysisTools from '../capabilities/analysis'
import * as transactionTools from '../capabilities/transaction-write'
import { createRuntimeTools, getRuntimeToolInfos } from '../runtime'

/** 工具分组定义 */
interface ToolGroupDefinition {
    name: string
    tools: Record<string, unknown>
}

/** 已注册业务工具 */
interface RegisteredTool {
    name: string
    group: string
    tool: Tool
}

/** 工具分组展示信息，用于系统提示词 */
export interface ToolGroupInfo {
    label: string
    tools: { name: string; description: string }[]
}

const TOOL_GROUPS: ToolGroupDefinition[] = [
    { name: 'data-query', tools: dataQueryTools },
    { name: 'calculator', tools: calculatorTools },
    { name: 'analysis', tools: analysisTools },
    { name: 'transaction', tools: transactionTools }
]

/**
 * 本地工具注册中心
 *
 * @author xiangwei
 */
export class ToolRegistry {
    private readonly registeredTools: RegisteredTool[]

    /**
     * 扫描并校验所有内置业务工具
     *
     * @author xiangwei
     */
    constructor() {
        const registeredTools: RegisteredTool[] = []
        const names = new Set<string>()

        for (const group of TOOL_GROUPS) {
            for (const [exportName, toolImpl] of Object.entries(group.tools)) {
                if (!isTool(toolImpl)) continue
                const name = exportName.replace(/Tool$/, '')
                if (names.has(name)) throw new Error(`工具名称重复：${name}`)
                names.add(name)
                registeredTools.push({ name, group: group.name, tool: toolImpl })
            }
        }
        this.registeredTools = registeredTools
    }

    /**
     * 获取所有本地工具的用途说明
     *
     * @returns 工具展示信息
     * @author xiangwei
     */
    getToolInfos(): AgentToolInfo[] {
        const businessTools = this.registeredTools.map(({ name, tool: rawTool }) => {
            const raw = rawTool as Tool & { description?: string }
            return {
                name,
                description: raw.description ?? '',
                parameters: {}
            }
        })
        return [...getRuntimeToolInfos(), ...businessTools]
    }

    /**
     * 获取按分组组织的工具用途说明，用于系统提示词展示
     *
     * @returns 分组工具信息
     * @author xiangwei
     */
    getGroupedToolInfos(): ToolGroupInfo[] {
        const groupLabels: Record<string, string> = {
            'data-query': '数据查询',
            calculator: '数学计算',
            analysis: '消费分析',
            transaction: '记账操作'
        }
        const groups: ToolGroupInfo[] = []
        for (const [groupKey, label] of Object.entries(groupLabels)) {
            const tools = this.registeredTools
                .filter((registered) => registered.group === groupKey)
                .map(({ name, tool: rawTool }) => ({
                    name,
                    description: (rawTool as Tool & { description?: string }).description ?? ''
                }))
            if (tools.length > 0) {
                groups.push({ label, tools })
            }
        }
        groups.push({
            label: '运行时',
            tools: getRuntimeToolInfos().map((info) => ({
                name: info.name,
                description: info.description
            }))
        })
        return groups
    }

    /**
     * 为当前用户创建完整的本地工具集合
     *
     * @param userId 当前用户 ID
     * @returns AI SDK 工具字典
     * @author xiangwei
     */
    createTools(userId: string): Record<string, Tool> {
        const tools = createRuntimeTools(userId)
        for (const registered of this.registeredTools) {
            tools[registered.name] = wrapToolWithUser(registered, userId)
        }
        return tools
    }
}

/**
 * 判断对象是否为可执行 AI 工具
 *
 * @param value 待判断对象
 * @returns 是否为可执行工具
 * @author xiangwei
 */
function isTool(value: unknown): value is Tool {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    return typeof candidate.execute === 'function' && candidate.inputSchema != null
}

/**
 * 为业务工具绑定用户边界
 *
 * @param registered 已注册工具
 * @param userId 当前用户 ID
 * @returns 绑定后的工具
 * @author xiangwei
 */
function wrapToolWithUser(registered: RegisteredTool, userId: string): Tool {
    const raw = registered.tool as Tool & { description?: string; inputSchema?: unknown }

    return tool({
        description: raw.description ?? '',
        inputSchema: raw.inputSchema!,
        execute: async (args: Record<string, unknown>) => {
            const startedAt = Date.now()
            logger.info('AgentTool', '工具调用开始', {
                toolGroup: registered.group,
                toolName: registered.name,
                arguments: summarizeLogValue(args)
            })
            const currentUserId = await getPersistedCurrentUserId()
            if (!currentUserId || currentUserId !== userId) {
                logger.warn('AgentTool', '工具调用被用户会话变更中断', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt
                })
                throw new Error('用户会话已变更，请重新开始对话')
            }

            try {
                const result = await runWithBoundUserId(userId, () =>
                    (raw.execute as (input: Record<string, unknown>) => unknown)(args)
                )
                logger.info('AgentTool', '工具调用完成', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt,
                    result: summarizeLogValue(result)
                })
                return result
            } catch (error: unknown) {
                logger.error('AgentTool', '工具调用失败', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt,
                    error
                })
                return { error: error instanceof Error ? error.message : '工具执行失败' }
            }
        }
    })
}

/** 全局本地工具注册中心 */
export const toolRegistry = new ToolRegistry()
