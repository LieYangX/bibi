/**
 * 应用运行数据路径
 *
 * 开发环境统一使用项目根目录，打包后统一使用用户数据目录。
 *
 * @author xiangwei
 */

import { app } from 'electron'
import { join } from 'path'

/** 应用运行环境路径参数 */
export interface AppDataRootOptions {
    isPackaged: boolean
    appPath: string
    userDataPath: string
}

/**
 * 按运行环境解析应用数据根目录
 *
 * @param options 运行环境路径参数
 * @returns 应用数据根目录
 * @author xiangwei
 */
export function resolveAppDataRoot(options: AppDataRootOptions): string {
    return options.isPackaged ? options.userDataPath : options.appPath
}

/**
 * 获取应用数据根目录
 *
 * @returns 开发环境的项目根目录或打包后的用户数据目录
 * @author xiangwei
 */
export function getAppDataRoot(): string {
    return resolveAppDataRoot({
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        userDataPath: app.getPath('userData')
    })
}

/**
 * 获取应用运行数据路径
 *
 * @param segments 相对于应用数据根目录的路径片段
 * @returns 应用运行数据绝对路径
 * @author xiangwei
 */
export function getAppDataPath(...segments: string[]): string {
    return join(getAppDataRoot(), ...segments)
}
