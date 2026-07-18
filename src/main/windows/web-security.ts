/**
 * 渲染进程导航与外链安全策略
 * @author xiangwei
 */

import { shell, type BrowserWindow, type Event, type WebContents } from 'electron'
import { isApplicationNavigation, isSafeExternalUrl } from '@shared/security/url'
import { logger } from '../utils/logger'

/**
 * 交由系统浏览器打开外链并统一记录失败
 *
 * @param url 外链地址
 * @author xiangwei
 */
function openExternalUrl(url: string): void {
    void shell.openExternal(url).catch((error: unknown) => {
        logger.error('WebSecurity', '打开外部链接失败', {
            error: error instanceof Error ? error.message : String(error)
        })
    })
}

/**
 * 判断权限请求是否来自主窗口的应用主框架
 *
 * @param applicationWebContents 应用主窗口渲染进程
 * @param requestingWebContents 发起权限请求的渲染进程
 * @param requestingUrl 发起权限请求的页面地址
 * @param isMainFrame 是否为主框架
 * @returns 是否为可信应用主框架
 * @author xiangwei
 */
function isApplicationMainFrame(
    applicationWebContents: WebContents,
    requestingWebContents: WebContents | null,
    requestingUrl: string | undefined,
    isMainFrame: boolean
): boolean {
    return (
        requestingWebContents?.id === applicationWebContents.id &&
        isMainFrame &&
        Boolean(
            requestingUrl && isApplicationNavigation(applicationWebContents.getURL(), requestingUrl)
        )
    )
}

/**
 * 为主窗口配置默认拒绝的 WebContents 安全策略
 *
 * @param window 主窗口
 * @author xiangwei
 */
export function configureWebSecurity(window: BrowserWindow): void {
    const { webContents } = window

    webContents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) {
            openExternalUrl(url)
        }
        return { action: 'deny' }
    })

    const guardNavigation = (event: Event, url: string): void => {
        if (isApplicationNavigation(webContents.getURL(), url)) return
        event.preventDefault()
        if (isSafeExternalUrl(url)) {
            openExternalUrl(url)
        }
    }
    webContents.on('will-navigate', guardNavigation)
    webContents.on('will-redirect', guardNavigation)

    webContents.on('will-attach-webview', (event) => event.preventDefault())
    webContents.session.setPermissionRequestHandler(
        (requestingWebContents, permission, callback, details) => {
            // 剪贴板写入权限由用户手势触发，自动放行
            if (permission === 'clipboard-sanitized-write') {
                callback(true)
                return
            }
            const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
            const allowAudio =
                permission === 'media' &&
                mediaTypes?.length === 1 &&
                mediaTypes[0] === 'audio' &&
                isApplicationMainFrame(
                    webContents,
                    requestingWebContents,
                    details.requestingUrl,
                    details.isMainFrame
                )
            callback(allowAudio)
        }
    )
    webContents.session.setPermissionCheckHandler(
        (requestingWebContents, permission, requestingOrigin, details) => {
            if (permission === 'clipboard-sanitized-write') return true
            const requestingUrl = details.requestingUrl ?? requestingOrigin
            return (
                permission === 'media' &&
                details.mediaType === 'audio' &&
                isApplicationMainFrame(
                    webContents,
                    requestingWebContents,
                    requestingUrl,
                    details.isMainFrame
                )
            )
        }
    )
}
