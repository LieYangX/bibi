/**
 * 路由配置
 * 登录页为独立顶层路由；主应用（含侧栏）为父级路由，子路由按业务领域划分
 * 小笔主页为默认路由 /，功能页通过图标轨道进入
 * 全部懒加载，减小首屏体积
 * @author xiangwei
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '../stores/user.store'

const routes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/LoginView.vue')
    },
    {
        path: '/',
        component: () => import('../components/AppLayout.vue'),
        children: [
            { path: '', name: 'Home', component: () => import('../views/AgentChatView.vue') },
            {
                path: 'overview',
                name: 'Overview',
                component: () => import('../views/DashboardView.vue')
            },
            { path: 'detail', name: 'Detail', component: () => import('../views/DetailView.vue') },
            {
                path: 'accounts',
                name: 'Accounts',
                component: () => import('../views/AccountsView.vue')
            },
            {
                path: 'categories',
                name: 'Categories',
                component: () => import('../views/CategoriesView.vue')
            },
            { path: 'budget', name: 'Budget', component: () => import('../views/BudgetView.vue') },
            { path: 'import', name: 'Import', component: () => import('../views/ImportView.vue') },
            { path: 'agent', redirect: '/' },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('../views/SettingsView.vue')
            }
        ]
    }
]

const router = createRouter({ history: createWebHashHistory(), routes })

/** 未登录用户只能访问 /login */
router.beforeEach(async (to) => {
    const userStore = useUserStore()
    await userStore.bootstrap()
    if (!userStore.currentUserId && to.path !== '/login') {
        return '/login'
    }
    return true
})

export default router
