/**
 * 渲染进程入口
 * 挂载 Vue 应用，注册 Pinia、Vue Router
 * 先初始化用户状态再启动路由，确保导航守卫能正确判断登录态
 * @author xiangwei
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import './assets/ui.css'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user.store'
import { useSettingStore } from './stores/setting.store'
import { desktopApi } from './api/desktop-api'
import type { RendererErrorReport } from '@shared/types'

const pinia = createPinia()
const app = createApp(App)

/**
 * 将渲染进程异常上报到主进程日志
 *
 * @param report 异常信息
 * @author xiangwei
 */
function reportRendererError(report: RendererErrorReport): void {
    void desktopApi.app.reportRendererError(report).catch((error: unknown) => {
        console.error('渲染进程异常上报失败', error)
    })
}

window.addEventListener('error', (event) => {
    reportRendererError({
        kind: 'error',
        message: event.message || '渲染进程脚本异常',
        stack: event.error instanceof Error ? event.error.stack : undefined,
        source: event.filename || undefined
    })
})

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportRendererError({
        kind: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
    })
})

app.config.errorHandler = (error, instance, info) => {
    reportRendererError({
        kind: 'vue',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        source: `${instance?.$options.name ?? 'anonymous'}:${info}`
    })
    console.error('Vue 组件异常', error)
}

app.use(pinia)
app.use(router)
app.mount('#app')

/**
 * 初始化会话后再启动路由
 *
 * @author xiangwei
 */
async function bootstrapRenderer(): Promise<void> {
    const userStore = useUserStore()
    const settingStore = useSettingStore()
    try {
        await userStore.bootstrap()
    } catch (error: unknown) {
        console.error('用户会话初始化失败', error)
    }
    void settingStore.loadAmountMask()
}

void bootstrapRenderer().catch((error: unknown) => {
    console.error('渲染进程初始化失败', error)
})
