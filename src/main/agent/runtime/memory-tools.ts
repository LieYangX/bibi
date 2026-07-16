/**
 * 本地记忆工具
 * 读取和写入当前用户的 profile 与 soul 记忆
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import { getPersistedCurrentUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import {
    localMemoryStore,
    MAX_LOCAL_MEMORY_CONTENT_LENGTH,
    type LocalMemoryType
} from '../memory/local-memory'

const memoryTypeSchema = z.enum(['profile', 'soul'])

const MEMORY_TOOL_DESCRIPTIONS = {
    readLocalMemory:
        '读取当前用户的本地 Markdown 记忆。profile 是稳定的基本信息，soul 是情感、偏好和行为模式。',
    writeLocalMemory:
        '将当前用户的一类记忆完整覆盖为最新 Markdown。更新用户画像前先读取旧画像并合并；灵魂通常由系统自动提炼。'
} as const

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
 * 创建本地记忆工具集
 *
 * @param userId 当前用户 ID
 * @returns readLocalMemory 和 writeLocalMemory 工具
 * @author xiangwei
 */
export function createMemoryTools(userId: string): Record<string, Tool> {
    const readLocalMemoryTool = tool({
        description: MEMORY_TOOL_DESCRIPTIONS.readLocalMemory,
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
        description: MEMORY_TOOL_DESCRIPTIONS.writeLocalMemory,
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
        readLocalMemory: readLocalMemoryTool,
        writeLocalMemory: writeLocalMemoryTool
    }
}

/** 记忆工具展示信息 */
export const memoryToolInfos = [
    { name: 'readLocalMemory', description: MEMORY_TOOL_DESCRIPTIONS.readLocalMemory },
    { name: 'writeLocalMemory', description: MEMORY_TOOL_DESCRIPTIONS.writeLocalMemory }
]
