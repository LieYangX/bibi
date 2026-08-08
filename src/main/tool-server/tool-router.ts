/**
 * 工具路由核心
 *
 * 导出工具元信息（含 JSON Schema 参数定义）并执行指定工具。
 *
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import type { Tool } from 'ai'
import { toolRegistry } from '../agent/tools/registry'
import { skillRegistry } from '../agent/skill-registry'
import { type AgentRunContext } from '../agent/agent-run-context'
import { toolInputSchemaToJson } from './schema-serializer'
import { logger } from '../utils/logger'
import { summarizeLogValue } from '../utils/log-sanitizer'

/**
 * 工具信息
 */
interface ToolInfo {
    name: string
    description: string
    parameters: Record<string, unknown>
}

/**
 * 导出所有已启用工具的元信息（含 JSON Schema 参数定义）
 *
 * @returns 工具信息列表
 * @author xiangwei
 */
export function exportToolInfos(): ToolInfo[] {
    const enabledSkills = skillRegistry.getEnabledSkills()
    const enabledSkillNames = new Set(enabledSkills.map((skill) => skill.meta.name))

    const registeredTools = toolRegistry.getRawRegisteredTools(enabledSkillNames)

    return registeredTools.map(({ name, tool }) => {
        const rawTool = tool as Tool & { description?: string }

        return {
            name,
            description: rawTool.description ?? '',
            parameters: toolInputSchemaToJson(tool)
        }
    })
}

/**
 * 执行指定工具
 *
 * @param toolName 工具名
 * @param args 参数（含 user_id）
 * @returns 工具执行结果
 * @author xiangwei
 */
export async function executeTool(
    toolName: string,
    args: Record<string, unknown>
): Promise<unknown> {
    const { user_id: userId, ...toolArgs } = args

    if (!userId || typeof userId !== 'string') {
        throw new Error('缺少 user_id 参数')
    }

    // 构建适配的 AgentRunContext
    const runContext: AgentRunContext = {
        userId,
        conversationId: randomUUID(),
        emit: async () => {}
    }

    // 获取已启用工具
    const enabledSkills = skillRegistry.getEnabledSkills()
    const enabledSkillNames = new Set(enabledSkills.map((skill) => skill.meta.name))
    const tools = toolRegistry.createTools(runContext, enabledSkillNames)

    const tool = tools[toolName]
    if (!tool) {
        throw new Error(`工具 "${toolName}" 不存在或未启用`)
    }

    const startedAt = Date.now()
    logger.info('ToolServer', '工具调用开始', {
        toolName,
        arguments: summarizeLogValue(toolArgs)
    })

    try {
        const rawTool = tool as Tool & {
            execute: (input: Record<string, unknown>) => Promise<unknown>
        }

        const result = await rawTool.execute(toolArgs)

        logger.info('ToolServer', '工具调用完成', {
            toolName,
            durationMs: Date.now() - startedAt,
            result: summarizeLogValue(result)
        })

        return result
    } catch (error) {
        logger.error('ToolServer', '工具调用失败', {
            toolName,
            durationMs: Date.now() - startedAt,
            error
        })
        throw error
    }
}
