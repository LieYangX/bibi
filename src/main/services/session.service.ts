/**
 * 当前用户会话服务
 * 会话持久化与用户领域逻辑分离
 * @author xiangwei
 */

import { AsyncLocalStorage } from 'async_hooks'
import { readFile, writeFile } from 'fs/promises'
import { getAppDataPath } from '../utils/app-data-path'

interface SessionData {
    lastUserId: string | null
}

const boundUserStorage = new AsyncLocalStorage<string>()

/**
 * 获取会话文件路径
 *
 * 开发环境使用项目根目录，打包后使用用户数据目录。
 *
 * @returns 会话文件绝对路径
 * @author xiangwei
 */
function getSessionPath(): string {
    return getAppDataPath('last-user.json')
}

/**
 * 获取当前用户 ID
 *
 * @returns 当前用户 ID，不存在时返回 null
 * @author xiangwei
 */
export async function getCurrentUserId(): Promise<string | null> {
    const boundUserId = boundUserStorage.getStore()
    if (boundUserId) return boundUserId
    return getPersistedCurrentUserId()
}

/**
 * 获取会话文件中当前选择的用户 ID
 *
 * 此方法忽略异步执行上下文，仅用于检测用户是否在任务执行期间发生切换。
 *
 * @returns 当前选择的用户 ID，不存在时返回 null
 * @author xiangwei
 */
export async function getPersistedCurrentUserId(): Promise<string | null> {
    try {
        const content = await readFile(getSessionPath(), 'utf-8')
        const data = JSON.parse(content) as Partial<SessionData>
        return typeof data.lastUserId === 'string' ? data.lastUserId : null
    } catch {
        return null
    }
}

/**
 * 在绑定到指定用户的异步上下文中执行任务
 *
 * @param userId 需要绑定的用户 ID
 * @param operation 任务函数
 * @returns 任务返回值
 * @author xiangwei
 */
export function runWithBoundUserId<TResult>(userId: string, operation: () => TResult): TResult {
    return boundUserStorage.run(userId, operation)
}

/**
 * 保存当前用户 ID
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function setCurrentUserId(userId: string): Promise<void> {
    await writeFile(getSessionPath(), JSON.stringify({ lastUserId: userId }), 'utf-8')
}

/**
 * 当前会话指向指定用户时清空会话
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function clearCurrentUserIfMatches(userId: string): Promise<void> {
    if ((await getPersistedCurrentUserId()) !== userId) return
    await writeFile(getSessionPath(), JSON.stringify({ lastUserId: null }), 'utf-8')
}
