/**
 * 系统设置状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { desktopApi } from '../api/desktop-api'

export const SETTING_KEY_AMOUNT_MASK = 'amount_mask'

/** 主题设置键：取值 'light' | 'dark' | 'system' */
export const SETTING_KEY_THEME = 'theme'

/** 主题模式：浅色 / 深色 / 跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 合法的主题模式集合，用于校验后端返回值 */
const VALID_THEME_MODES: ReadonlySet<ThemeMode> = new Set(['light', 'dark', 'system'])

/** 主题模式默认值：跟随系统 */
export const DEFAULT_THEME_MODE: ThemeMode = 'system'

export const useSettingStore = defineStore('setting', () => {
    const amountMaskEnabled = ref(true)
    const theme = ref<ThemeMode>(DEFAULT_THEME_MODE)
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function loadAmountMask(): Promise<boolean> {
        loading.value = true
        error.value = null
        try {
            const result = await desktopApi.setting.get(SETTING_KEY_AMOUNT_MASK, true)
            if (!result.ok) {
                error.value = result.error
                return false
            }
            amountMaskEnabled.value = result.data === true
            return true
        } finally {
            loading.value = false
        }
    }

    async function saveAmountMask(enabled: boolean): Promise<boolean> {
        const previous = amountMaskEnabled.value
        amountMaskEnabled.value = enabled
        error.value = null

        const result = await desktopApi.setting.set(SETTING_KEY_AMOUNT_MASK, enabled)
        if (result.ok) return true

        amountMaskEnabled.value = previous
        error.value = result.error
        return false
    }

    /**
     * 从后端加载主题设置，非法或缺失时回退到默认值
     *
     * @returns 是否加载成功
     * @author xiangwei
     */
    async function loadTheme(): Promise<boolean> {
        loading.value = true
        error.value = null
        try {
            const result = await desktopApi.setting.get<ThemeMode>(
                SETTING_KEY_THEME,
                DEFAULT_THEME_MODE
            )
            if (!result.ok) {
                error.value = result.error
                return false
            }
            const value = result.data
            theme.value = value && VALID_THEME_MODES.has(value) ? value : DEFAULT_THEME_MODE
            return true
        } finally {
            loading.value = false
        }
    }

    /**
     * 保存主题设置到后端，失败时回滚到先前值
     *
     * @param mode 目标主题模式
     * @returns 是否保存成功
     * @author xiangwei
     */
    async function saveTheme(mode: ThemeMode): Promise<boolean> {
        const previous = theme.value
        theme.value = mode
        error.value = null

        const result = await desktopApi.setting.set(SETTING_KEY_THEME, mode)
        if (result.ok) return true

        theme.value = previous
        error.value = result.error
        return false
    }

    return {
        amountMaskEnabled,
        theme,
        loading,
        error,
        loadAmountMask,
        saveAmountMask,
        loadTheme,
        saveTheme
    }
})
