<template>
    <div class="bb-page-container bb-page-container--medium">
        <PageHeader title="分类管理" subtitle="管理收入 / 支出的分类与二级分类" />

        <div class="cat-switch" role="group" aria-label="分类类型">
            <button
                class="cat-switch__btn"
                :class="{ active: mode === 'expense' }"
                @click="mode = 'expense'"
            >
                支出分类
            </button>
            <button
                class="cat-switch__btn"
                :class="{ active: mode === 'income' }"
                @click="mode = 'income'"
            >
                收入分类
            </button>
        </div>

        <div v-if="categoryStore.loading && !categoryStore.loaded" class="category-status">
            正在加载分类…
        </div>
        <div
            v-else-if="categoryStore.error && !categoryStore.loaded"
            class="category-status is-error"
        >
            <span>{{ categoryStore.error }}</span>
            <button class="bb-btn bb-btn-sm" @click="categoryStore.loadCategories(true)">
                重试
            </button>
        </div>
        <CategoriesSection v-else :category-type="mode" />
    </div>
</template>

<script setup lang="ts">
/**
 * 分类管理页（独立路由）
 * @author xiangwei
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { PageHeader } from '../components/common'
import { useCategoryStore } from '../stores/category.store'
import { onRefresh } from '../composables/useRefreshBus'
import CategoriesSection from './sections/CategoriesSection.vue'

const mode = ref<'expense' | 'income'>('expense')
const categoryStore = useCategoryStore()

let offRefresh: () => void
onMounted(() => {
    // 进入页面时确保分类已加载（写操作也会触发 store reload，但首屏需主动拉一次）
    categoryStore.loadCategories(true)
    offRefresh = onRefresh('category', () => categoryStore.loadCategories(true))
})
onUnmounted(() => offRefresh?.())
</script>

<style scoped>
.cat-switch {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
    margin-bottom: 18px;
}

.cat-switch__btn {
    display: inline-flex;
    min-width: 88px;
    min-height: 30px;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}

.cat-switch__btn.active {
    background: var(--bb-bg-elevated);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-sm);
}
.category-status {
    display: flex;
    min-height: 160px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--bb-text-tertiary);
    font-size: 13px;
}
.category-status.is-error {
    color: var(--bb-danger);
}
</style>
