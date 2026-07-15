/**
 * 预加载类型声明
 * @author xiangwei
 */

import type { ElectronAPI } from '@shared/types'

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
