/**
 * 渲染进程桌面能力适配器
 * 业务代码只通过此模块访问预加载桥接对象
 * @author xiangwei
 */

import type { ElectronAPI } from '@shared/types'

if (!window.electronAPI) {
    throw new Error('桌面能力初始化失败')
}

export const desktopApi: ElectronAPI = window.electronAPI
