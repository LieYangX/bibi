/**
 * Agent 运行时基础工具
 * 提供动态 Skill 获取和受限的本地记忆读写能力。
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import type { AgentToolInfo } from '@shared/types'
import { getPersistedCurrentUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import { skillRegistry } from '../skill-registry'
import {
    localMemoryStore,
    MAX_LOCAL_MEMORY_CONTENT_LENGTH,
    type LocalMemoryType
} from '../memory/local-memory'

const memoryTypeSchema = z.enum(['profile', 'soul'])

const RUNTIME_TOOL_DESCRIPTIONS = {
    getSkill:
        '按 Skill 名称获取完整指令。需要使用某个 Skill 时必须先调用本工具，再遵循返回的 Markdown 内容选择业务工具。',
    readLocalMemory:
        '读取当前用户的本地 Markdown 记忆。profile 是稳定的基本信息，soul 是情感、偏好和行为模式。',
    writeLocalMemory:
        '将当前用户的一类记忆完整覆盖为最新 Markdown。更新用户画像前先读取旧画像并合并；灵魂通常由系统自动提炼。'
} as const

/**
 * 获取运行时基础工具展示信息
 *
 * @returns 工具展示信息
 * @author xiangwei
 */
export function getRuntimeToolInfos(): AgentToolInfo[] {
    return Object.entries(RUNTIME_TOOL_DESCRIPTIONS).map(([name, description]) => ({
        name,
        description,
        parameters: {}
    }))
}

/**
 * 校验工具执行期间登录用户没有发生切换
 *
 * @param userId 对话绑定的用户 ID
 * @author xiangwei
 */
async function assertCurrentUser(userId: string): Promise<void> {
    const currentUserId = await getPersistedCurrentUserId()
    if (!currentUserId || currentUserId !== userId) {
        throw new Error('用户会话已变更，请重新开始对话')
    }
}

/**
 * 创建当前对话的运行时基础工具
 *
 * @param userId 当前用户 ID
 * @returns AI SDK 工具字典
 * @author xiangwei
 */
export function createRuntimeTools(userId: string): Record<string, Tool> {
    const getSkillTool = tool({
        description: RUNTIME_TOOL_DESCRIPTIONS.getSkill,
        inputSchema: z.object({
            name: z.string().trim().min(1).max(50).describe('System Prompt 中列出的 Skill 名称')
        }),
        execute: async ({ name }) => {
            await assertCurrentUser(userId)
            const definition = skillRegistry.getSkill(name)
            if (!definition || !definition.meta.isEnabled) {
                return { error: `Skill "${name}" 不存在或未启用` }
            }
            logger.info('AgentTool', '动态加载 Skill 完整内容', {
                skillName: name,
                contentLength: definition.markdown.length
            })
            return {
                name: definition.meta.name,
                displayName: definition.meta.displayName,
                description: definition.meta.description,
                content: definition.markdown
            }
        }
    })

    const readLocalMemoryTool = tool({
        description: RUNTIME_TOOL_DESCRIPTIONS.readLocalMemory,
        inputSchema: z.object({
            type: memoryTypeSchema.describe('要读取的记忆类型')
        }),
        execute: async ({ type }) => {
            await assertCurrentUser(userId)
            const document = await localMemoryStore.readMemory(userId, type)
            logger.info('AgentTool', '读取本地记忆', {
                memoryType: type,
                exists: document.exists,
                contentLength: document.content.length
            })
            return {
                type,
                exists: document.exists,
                updatedAt: document.updatedAt,
                content: document.content
            }
        }
    })

    const writeLocalMemoryTool = tool({
        description: RUNTIME_TOOL_DESCRIPTIONS.writeLocalMemory,
        inputSchema: z.object({
            type: memoryTypeSchema.describe('要写入的记忆类型'),
            content: z
                .string()
                .trim()
                .min(1)
                .max(MAX_LOCAL_MEMORY_CONTENT_LENGTH)
                .describe('合并后的完整 Markdown 内容，而不是局部增量')
        }),
        execute: async ({ type, content }) => {
            await assertCurrentUser(userId)
            const document = await localMemoryStore.writeMemory(
                userId,
                type as LocalMemoryType,
                content
            )
            logger.info('AgentTool', '写入本地记忆', {
                memoryType: type,
                contentLength: document.content.length
            })
            return {
                type,
                updatedAt: document.updatedAt,
                saved: true
            }
        }
    })

    return {
        getSkill: getSkillTool,
        readLocalMemory: readLocalMemoryTool,
        writeLocalMemory: writeLocalMemoryTool
    }
}
