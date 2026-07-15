/**
 * 系统设置状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { desktopApi } from '../api/desktop-api'

export const SETTING_KEY_AMOUNT_MASK = 'amount_mask'

export const useSettingStore = defineStore('setting', () => {
    const amountMaskEnabled = ref(true)
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

    return {
        amountMaskEnabled,
        loading,
        error,
        loadAmountMask,
        saveAmountMask
    }
})
