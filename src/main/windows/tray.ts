/**
 * 系统托盘管理
 * @author xiangwei
 */

import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import icon from '../../../build/icon.png?asset'
import { logger } from '../utils/logger'

let trayInstance: Tray | null = null

/**
 * 显示主窗口并聚焦
 *
 * @param window 主窗口
 * @author xiangwei
 */
function showMainWindow(window: BrowserWindow): void {
    if (window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
}

/**
 * 创建托盘图标
 *
 * @returns 缩放后的图标
 * @author xiangwei
 */
function createTrayIcon(): Electron.NativeImage {
    const image = nativeImage.createFromPath(icon)
    // Windows 与 Linux 使用 16x16 托盘图标，macOS 使用模板图标
    if (process.platform === 'darwin') {
        image.setTemplateImage(true)
        return image.resize({ width: 18, height: 18 })
    }
    return image.resize({ width: 16, height: 16 })
}

/**
 * 创建系统托盘并绑定菜单
 *
 * @param window 主窗口
 * @returns 托盘实例
 * @author xiangwei
 */
export function createTray(window: BrowserWindow): Tray {
    destroyTray()

    const tray = new Tray(createTrayIcon())
    tray.setToolTip('笔笔')

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开界面',
            click: () => showMainWindow(window)
        },
        {
            label: '完全退出',
            click: () => {
                logger.info('Tray', '用户通过托盘菜单退出应用')
                app.quit()
            }
        }
    ])

    tray.setContextMenu(contextMenu)

    // 单击托盘图标显示窗口（macOS 与 Windows 行为统一）
    tray.on('click', () => showMainWindow(window))
    tray.on('double-click', () => showMainWindow(window))

    trayInstance = tray
    logger.info('Tray', '系统托盘已创建')
    return tray
}

/**
 * 销毁当前托盘实例
 *
 * @author xiangwei
 */
export function destroyTray(): void {
    if (!trayInstance) return
    trayInstance.removeAllListeners()
    trayInstance.destroy()
    trayInstance = null
    logger.info('Tray', '系统托盘已销毁')
}

/**
 * 获取当前托盘实例
 *
 * @returns 托盘实例或 null
 * @author xiangwei
 */
export function getTray(): Tray | null {
    return trayInstance
}
