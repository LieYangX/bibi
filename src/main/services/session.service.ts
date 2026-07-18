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
    /** 退出确认弹窗中"最小化到系统托盘"勾选框的上次选择 */
    minimizeToTrayPreference?: boolean
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
 * 读取整个会话文件内容
 *
 * 文件不存在或解析失败时返回初始结构，保证调用方总能拿到合法对象。
 *
 * @returns 会话数据对象
 * @author xiangwei
 */
async function readSessionData(): Promise<SessionData> {
    try {
        const content = await readFile(getSessionPath(), 'utf-8')
        const data = JSON.parse(content) as Partial<SessionData>
        return {
            lastUserId: typeof data.lastUserId === 'string' ? data.lastUserId : null,
            minimizeToTrayPreference:
                typeof data.minimizeToTrayPreference === 'boolean'
                    ? data.minimizeToTrayPreference
                    : undefined
        }
    } catch {
        return { lastUserId: null }
    }
}

/**
 * 写入整个会话文件内容
 *
 * @param data 会话数据对象
 * @author xiangwei
 */
async function writeSessionData(data: SessionData): Promise<void> {
    await writeFile(getSessionPath(), JSON.stringify(data), 'utf-8')
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
    const data = await readSessionData()
    return data.lastUserId
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
 * 采用读-改-写模式，保留会话文件中的其他字段（如最小化偏好）。
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function setCurrentUserId(userId: string): Promise<void> {
    const data = await readSessionData()
    data.lastUserId = userId
    await writeSessionData(data)
}

/**
 * 当前会话指向指定用户时清空会话
 *
 * 采用读-改-写模式，保留会话文件中的其他字段（如最小化偏好）。
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function clearCurrentUserIfMatches(userId: string): Promise<void> {
    if ((await getPersistedCurrentUserId()) !== userId) return
    const data = await readSessionData()
    data.lastUserId = null
    await writeSessionData(data)
}

/**
 * 读取退出确认弹窗中"最小化到系统托盘"勾选框的上次选择
 *
 * 未保存过时默认返回 false，与未勾选语义保持一致。
 *
 * @returns 上次保存的勾选状态
 * @author xiangwei
 */
export async function getMinimizeToTrayPreference(): Promise<boolean> {
    const data = await readSessionData()
    return data.minimizeToTrayPreference === true
}

/**
 * 保存退出确认弹窗中"最小化到系统托盘"勾选框的选择
 *
 * 采用读-改-写模式，保留会话文件中的其他字段（如当前用户 ID）。
 *
 * @param value 勾选状态
 * @author xiangwei
 */
export async function setMinimizeToTrayPreference(value: boolean): Promise<void> {
    const data = await readSessionData()
    data.minimizeToTrayPreference = value
    await writeSessionData(data)
}
