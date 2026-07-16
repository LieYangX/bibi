/**
 * Skill 加载工具
 * 按名称动态获取 Skill 完整指令
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import { getPersistedCurrentUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import { skillRegistry } from '../skill-registry'

const SKILL_LOADER_DESCRIPTION =
    '按 Skill 名称获取完整指令。需要使用某个 Skill 时必须先调用本工具，再遵循返回的 Markdown 内容选择业务工具。'

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
 * 创建 Skill 加载工具
 *
 * @param userId 当前用户 ID
 * @returns getSkill 工具
 * @author xiangwei
 */
export function createSkillLoaderTool(userId: string): Tool {
    return tool({
        description: SKILL_LOADER_DESCRIPTION,
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
}

/** Skill 加载工具展示信息 */
export const skillLoaderInfo = {
    name: 'getSkill',
    description: SKILL_LOADER_DESCRIPTION
}
