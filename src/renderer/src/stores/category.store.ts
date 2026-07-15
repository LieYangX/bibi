/**
 * 分类状态管理
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
    Category,
    CategoryType,
    CreateCategoryDTO,
    CreateSubCategoryDTO,
    IpcResult,
    SubCategory,
    UpdateCategoryDTO
} from '@shared/types'
import { desktopApi } from '../api/desktop-api'
import {
    captureUserRequestGeneration,
    createStaleUserRequestResult,
    isUserRequestCurrent
} from '../app/session/user-request-generation'
import { emitRefresh } from '../composables/useRefreshBus'

export type SubCategoryInfo = SubCategory
export type CategoryInfo = Category & { sub_categories: SubCategoryInfo[] }

export const useCategoryStore = defineStore('category', () => {
    const expenseCategories = ref<CategoryInfo[]>([])
    const incomeCategories = ref<CategoryInfo[]>([])
    const loaded = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)
    let latestLoadRequestId = 0

    async function loadCategoriesForGeneration(
        force: boolean,
        generation: number
    ): Promise<boolean> {
        if (!isUserRequestCurrent(generation)) return false
        if (loaded.value && !force) return true

        const requestId = ++latestLoadRequestId
        loading.value = true
        error.value = null
        const [expenseResult, incomeResult] = await Promise.all([
            desktopApi.category.list('expense'),
            desktopApi.category.list('income')
        ])
        if (requestId !== latestLoadRequestId || !isUserRequestCurrent(generation)) return false

        if (expenseResult.ok) {
            expenseCategories.value = normalizeCategories(expenseResult.data)
        }
        if (incomeResult.ok) {
            incomeCategories.value = normalizeCategories(incomeResult.data)
        }
        loading.value = false
        loaded.value = expenseResult.ok && incomeResult.ok
        if (!expenseResult.ok) error.value = expenseResult.error
        else if (!incomeResult.ok) error.value = incomeResult.error
        return loaded.value
    }

    async function loadCategories(force = false): Promise<void> {
        await loadCategoriesForGeneration(force, captureUserRequestGeneration())
    }

    async function reloadAndNotify(generation: number): Promise<boolean> {
        if (!(await loadCategoriesForGeneration(true, generation))) return false
        if (!isUserRequestCurrent(generation)) return false

        emitRefresh('category')
        emitRefresh('transaction')
        return true
    }

    async function createCategory(data: CreateCategoryDTO): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.create(data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation)
    }

    async function createSubCategory(data: CreateSubCategoryDTO): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.createSub(data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation)
    }

    async function updateCategory(id: string, data: UpdateCategoryDTO): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.update(id, data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation)
    }

    async function deleteCategory(id: string): Promise<IpcResult> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.delete(id)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult()
        if (result.ok && !(await reloadAndNotify(generation))) {
            return createStaleUserRequestResult()
        }
        return result
    }

    async function updateSubCategory(id: string, data: { name: string }): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.updateSub(id, data)
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        return reloadAndNotify(generation)
    }

    async function deleteSubCategory(id: string): Promise<IpcResult> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.deleteSub(id)
        if (!isUserRequestCurrent(generation)) return createStaleUserRequestResult()
        if (result.ok && !(await reloadAndNotify(generation))) {
            return createStaleUserRequestResult()
        }
        return result
    }

    async function resetDefaults(): Promise<boolean> {
        const generation = captureUserRequestGeneration()
        const result = await desktopApi.category.resetDefaults()
        if (!result.ok || !isUserRequestCurrent(generation)) return false
        if (!(await loadCategoriesForGeneration(true, generation))) return false
        if (!isUserRequestCurrent(generation)) return false

        emitRefresh('category')
        emitRefresh('transaction')
        emitRefresh('budget')
        return true
    }

    function findCategoryId(name: string, type: CategoryType): string | null {
        const list = type === 'expense' ? expenseCategories.value : incomeCategories.value
        return list.find((category) => category.name === name)?.id || null
    }

    function reset(): void {
        latestLoadRequestId++
        expenseCategories.value = []
        incomeCategories.value = []
        loaded.value = false
        loading.value = false
        error.value = null
    }

    return {
        expenseCategories,
        incomeCategories,
        loaded,
        loading,
        error,
        loadCategories,
        createCategory,
        createSubCategory,
        updateCategory,
        deleteCategory,
        resetDefaults,
        findCategoryId,
        updateSubCategory,
        deleteSubCategory,
        reset
    }
})

function normalizeCategories(categories: Category[]): CategoryInfo[] {
    return categories.map((category) => ({
        ...category,
        sub_categories: category.sub_categories ?? []
    }))
}
