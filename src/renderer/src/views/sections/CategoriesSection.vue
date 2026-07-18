<template>
    <div class="section-card">
        <div class="cat-header">
            <div class="cat-header__title">
                {{ categoryType === 'expense' ? '支出分类' : '收入分类' }}
            </div>
            <button class="bb-btn bb-btn-text cat-reset-btn" @click="handleResetDefaults">
                <RotateCcw :size="14" />恢复默认
            </button>
        </div>

        <!-- 添加一级分类 -->
        <div class="cat-create">
            <div class="cat-create__row">
                <div class="cat-color-picker-wrap">
                    <button
                        class="cat-color-dot"
                        :style="{ background: newCatColor }"
                        title="选择颜色"
                        @click.stop="toggleCreateColorPicker"
                    />
                    <div
                        v-if="showColorPickerFor === 'create'"
                        class="cat-color-palette"
                        @click.stop
                    >
                        <button
                            v-for="c in CATEGORY_COLORS"
                            :key="c"
                            class="cat-palette-swatch"
                            :class="{ active: c === newCatColor }"
                            :style="{ background: c }"
                            @click="selectCreateColor(c)"
                        />
                    </div>
                </div>
                <input
                    v-model="newCatName"
                    class="bb-input"
                    placeholder="输入新的一级分类名称"
                    :maxlength="20"
                    @keydown.enter="handleCreateCat"
                />
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="!newCatName.trim()"
                    @click="handleCreateCat"
                >
                    新增
                </button>
            </div>
        </div>

        <div v-if="currentCategories.length" class="cat-list">
            <div v-for="cat in currentCategories" :key="cat.id" class="cat-group">
                <!-- 一级分类头部 -->
                <div class="cat-group__head">
                    <div class="cat-group__info">
                        <span
                            class="cat-group__dot"
                            :style="{ background: cat.color || 'var(--bb-text-tertiary)' }"
                        />
                        <span class="cat-group__name">{{ cat.name }}</span>
                        <span v-if="cat.sub_categories.length" class="cat-group__count"
                            >{{ cat.sub_categories.length }}个二级</span
                        >
                        <span v-if="cat.is_system" class="cat-group__sys">系统</span>
                    </div>
                    <div class="cat-group__actions">
                        <button
                            class="bb-btn bb-btn-text cat-action-btn"
                            title="编辑名称"
                            @click="startEditCat(cat)"
                        >
                            <Pencil :size="13" />
                        </button>
                        <button
                            v-if="!cat.is_system"
                            class="bb-btn bb-btn-text cat-action-btn cat-action-btn--del"
                            title="删除分类"
                            @click="confirmDeleteCat(cat)"
                        >
                            <Trash2 :size="13" />
                        </button>
                    </div>
                </div>

                <!-- 编辑一级分类名称 -->
                <div v-if="editingCatId === cat.id" class="cat-edit-row">
                    <div class="cat-color-picker-wrap">
                        <button
                            class="cat-color-dot"
                            :style="{ background: editCatColor }"
                            title="选择颜色"
                            @click.stop="toggleEditColorPicker"
                        />
                        <div
                            v-if="showColorPickerFor === 'edit'"
                            class="cat-color-palette"
                            @click.stop
                        >
                            <button
                                v-for="c in CATEGORY_COLORS"
                                :key="c"
                                class="cat-palette-swatch"
                                :class="{ active: c === editCatColor }"
                                :style="{ background: c }"
                                @click="selectEditColor(c)"
                            />
                        </div>
                    </div>
                    <input
                        ref="catEditInputRef"
                        v-model="editCatName"
                        class="bb-input bb-input-sm"
                        :maxlength="20"
                        @keydown.enter="saveEditCat(cat.id)"
                        @keydown.escape="cancelEdit"
                    />
                    <button class="bb-btn bb-btn-sm bb-btn-primary" @click="saveEditCat(cat.id)">
                        保存
                    </button>
                    <button class="bb-btn bb-btn-sm" @click="cancelEdit">取消</button>
                </div>

                <!-- 二级分类列表 -->
                <div v-if="cat.sub_categories.length" class="cat-subs">
                    <div v-for="sub in cat.sub_categories" :key="sub.id" class="cat-sub-item">
                        <!-- 编辑态 -->
                        <template v-if="editingSubId === sub.id">
                            <input
                                v-model="editSubName"
                                class="bb-input bb-input-sm cat-sub-edit-input"
                                :maxlength="20"
                                @keydown.enter="saveEditSub(sub.id)"
                                @keydown.escape="cancelEdit"
                            />
                            <button
                                class="bb-btn bb-btn-sm bb-btn-primary"
                                @click="saveEditSub(sub.id)"
                            >
                                保存
                            </button>
                            <button class="bb-btn bb-btn-sm" @click="cancelEdit">取消</button>
                        </template>
                        <!-- 展示态 -->
                        <template v-else>
                            <span class="bb-tag cat-sub-tag">
                                {{ sub.name }}
                                <button
                                    class="cat-sub-tag__edit"
                                    title="编辑"
                                    @click.stop="startEditSub(sub)"
                                >
                                    <Pencil :size="11" />
                                </button>
                                <button
                                    class="cat-sub-tag__del"
                                    title="删除"
                                    @click.stop="confirmDeleteSub(sub)"
                                >
                                    <X :size="11" />
                                </button>
                            </span>
                        </template>
                    </div>
                </div>

                <!-- 添加二级分类 -->
                <div class="cat-add-sub">
                    <template v-if="addingSubCatId === cat.id">
                        <input
                            :ref="(el) => setSubInputRef(el as HTMLInputElement, cat.id)"
                            v-model="newSubName"
                            class="bb-input bb-input-sm cat-add-sub-input"
                            placeholder="输入二级分类名称"
                            :maxlength="20"
                            @keydown.enter="handleAddSub(cat.id)"
                            @keydown.escape="cancelAddSub"
                        />
                        <button
                            class="bb-btn bb-btn-sm bb-btn-primary"
                            @click="handleAddSub(cat.id)"
                        >
                            确定
                        </button>
                        <button class="bb-btn bb-btn-sm" @click="cancelAddSub">取消</button>
                    </template>
                    <button v-else class="cat-add-sub-btn" @click="startAddSub(cat.id)">
                        + 添加二级分类
                    </button>
                </div>
            </div>
        </div>

        <div v-else class="bb-empty">暂无分类</div>

        <!-- 删除确认弹窗 -->
        <BbModal
            :visible="deleteModal.visible"
            title="确认删除"
            width="400px"
            @update:visible="deleteModal.visible = $event"
        >
            <div class="delete-confirm">
                <p class="delete-confirm__text">{{ deleteModal.message }}</p>
                <p class="delete-confirm__warn">
                    删除后，关联的记账明细中的分类信息将被清除，流水记录本身保留。
                </p>
            </div>
            <template #footer>
                <button class="bb-btn" @click="deleteModal.visible = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    style="background: #ef4444; border-color: #ef4444"
                    @click="executeDelete"
                >
                    确定删除
                </button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 分类管理区段
 * 一级 / 二级分类的增删改，所有操作经 categoryStore 并依赖其写后重拉
 * @author xiangwei
 */

import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useCategoryStore } from '../../stores/category.store'
import { BbModal, Message } from '../../components/ui'
import { Trash2, Pencil, X, RotateCcw } from '@lucide/vue'
import type { CategoryInfo, SubCategoryInfo } from '../../stores/category.store'

/** 分类调色板 */
const CATEGORY_COLORS = [
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#14B8A6',
    '#06B6D4',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#D946EF',
    '#EC4899',
    '#F43F5E',
    '#059669',
    '#0284C7',
    '#7C3AED'
]

const props = defineProps<{ categoryType: 'expense' | 'income' }>()
const categoryStore = useCategoryStore()

// ---- 表单状态 ----
const newCatName = ref('')
const newCatColor = ref(CATEGORY_COLORS[0])
const newSubName = ref('')
const addingSubCatId = ref('')
const editingCatId = ref('')
const editCatName = ref('')
const editCatColor = ref(CATEGORY_COLORS[0])
const editingSubId = ref('')
const editSubName = ref('')
const showColorPickerFor = ref<'create' | 'edit' | null>(null)

// 模板 ref：每个分类的二级分类输入框独立存储，避免 v-for 中单一 ref 被覆盖
const subInputRefs = ref<Map<string, HTMLInputElement>>(new Map())
const catEditInputRef = ref<HTMLInputElement | null>(null)

function toggleCreateColorPicker(): void {
    showColorPickerFor.value = showColorPickerFor.value === 'create' ? null : 'create'
}
function selectCreateColor(color: string): void {
    newCatColor.value = color
    showColorPickerFor.value = null
}
function toggleEditColorPicker(): void {
    showColorPickerFor.value = showColorPickerFor.value === 'edit' ? null : 'edit'
}
function selectEditColor(color: string): void {
    editCatColor.value = color
    showColorPickerFor.value = null
}

/** 点击任意位置关闭颜色选择器 */
function onDocumentClick(): void {
    showColorPickerFor.value = null
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

/**
 * 收集当前分类的二级分类输入框 DOM 引用
 */
function setSubInputRef(el: HTMLInputElement | null, catId: string): void {
    if (el) {
        subInputRefs.value.set(catId, el)
    } else {
        subInputRefs.value.delete(catId)
    }
}

// 删除确认弹窗
const deleteModal = ref<{
    visible: boolean
    message: string
    targetId: string
    targetType: 'cat' | 'sub'
}>({
    visible: false,
    message: '',
    targetId: '',
    targetType: 'cat'
})

const currentCategories = computed(() =>
    props.categoryType === 'expense'
        ? categoryStore.expenseCategories
        : categoryStore.incomeCategories
)

// ========== 一级分类 ==========

async function handleCreateCat(): Promise<void> {
    const name = newCatName.value.trim()
    if (!name) return
    const ok = await categoryStore.createCategory({
        name,
        type: props.categoryType,
        color: newCatColor.value
    })
    if (ok) {
        Message.success('已添加')
        newCatName.value = ''
        newCatColor.value = CATEGORY_COLORS[0]
    } else {
        Message.error('添加失败')
    }
}

function startEditCat(cat: CategoryInfo): void {
    editingSubId.value = ''
    editingCatId.value = cat.id
    editCatName.value = cat.name
    editCatColor.value = cat.color || CATEGORY_COLORS[0]
    showColorPickerFor.value = null
    nextTick(() => catEditInputRef.value?.focus())
}

async function saveEditCat(id: string): Promise<void> {
    const name = editCatName.value.trim()
    if (!name) return
    const ok = await categoryStore.updateCategory(id, {
        name,
        color: editCatColor.value
    })
    if (ok) Message.success('已更新')
    else Message.error('更新失败')
    cancelEdit()
}

// ========== 二级分类 ==========

function startAddSub(catId: string): void {
    addingSubCatId.value = catId
    newSubName.value = ''
    nextTick(() => subInputRefs.value.get(catId)?.focus())
}

function cancelAddSub(): void {
    addingSubCatId.value = ''
    newSubName.value = ''
}

async function handleAddSub(catId: string): Promise<void> {
    const name = newSubName.value.trim()
    if (!name) return
    const ok = await categoryStore.createSubCategory({ category_id: catId, name })
    if (ok) {
        Message.success('已添加')
    } else {
        Message.error('添加失败')
    }
    cancelAddSub()
}

function startEditSub(sub: SubCategoryInfo): void {
    editingCatId.value = ''
    editingSubId.value = sub.id
    editSubName.value = sub.name
}

async function saveEditSub(id: string): Promise<void> {
    const name = editSubName.value.trim()
    if (!name) return
    const ok = await categoryStore.updateSubCategory(id, { name })
    if (ok) Message.success('已更新')
    else Message.error('更新失败')
    cancelEdit()
}

function cancelEdit(): void {
    editingCatId.value = ''
    editingSubId.value = ''
    editCatName.value = ''
    editSubName.value = ''
    addingSubCatId.value = ''
    newSubName.value = ''
    showColorPickerFor.value = null
}

// ========== 删除 ==========

function confirmDeleteCat(cat: CategoryInfo): void {
    deleteModal.value = {
        visible: true,
        message: `确定删除一级分类「${cat.name}」及其所有二级分类吗？`,
        targetId: cat.id,
        targetType: 'cat'
    }
}

function confirmDeleteSub(sub: SubCategoryInfo): void {
    deleteModal.value = {
        visible: true,
        message: `确定删除二级分类「${sub.name}」吗？`,
        targetId: sub.id,
        targetType: 'sub'
    }
}

async function executeDelete(): Promise<void> {
    const { targetId, targetType } = deleteModal.value
    deleteModal.value.visible = false

    if (targetType === 'cat') {
        const r = await categoryStore.deleteCategory(targetId)
        if (r.ok) Message.success('已删除')
        else Message.error(r.error || '删除失败')
    } else {
        const r = await categoryStore.deleteSubCategory(targetId)
        if (r.ok) Message.success('已删除')
        else Message.error(r.error || '删除失败')
    }
}

/** 恢复系统默认分类 */
async function handleResetDefaults(): Promise<void> {
    const confirmed = window.confirm('确定恢复为系统默认分类？这将删除所有自定义分类和二级分类。')
    if (!confirmed) return
    const ok = await categoryStore.resetDefaults()
    if (ok) Message.success('已恢复默认分类')
    else Message.error('恢复失败')
}
</script>

<style scoped>
.section-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 14px;
    padding: 20px;
}

.cat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--bb-border);
}
.cat-header__title {
    font-size: 15px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.cat-reset-btn {
    color: var(--bb-text-tertiary);
    font-size: 12px;
    padding: 2px 8px;
}
.cat-reset-btn:hover {
    color: var(--bb-accent-text);
}

.cat-list {
    padding: 4px 0;
}
.cat-group {
    padding: 14px 0;
    border-bottom: 1px solid var(--bb-border);
}
.cat-group:last-child {
    border-bottom: none;
}

.cat-group__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.cat-group__info {
    display: flex;
    align-items: center;
    gap: 8px;
}
.cat-group__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.cat-group__name {
    font-size: 15px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.cat-group__count {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    background: var(--bb-bg-hover);
    padding: 1px 8px;
    border-radius: 8px;
}
.cat-group__sys {
    font-size: 10px;
    color: var(--bb-accent-text);
    background: var(--bb-accent-light);
    padding: 1px 6px;
    border-radius: 4px;
}
.cat-group__actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
}
.cat-group:hover .cat-group__actions {
    opacity: 1;
}
.cat-action-btn {
    padding: 2px 5px;
    color: var(--bb-text-tertiary);
}
.cat-action-btn:hover {
    color: var(--bb-accent-text);
}
.cat-action-btn--del:hover {
    color: var(--bb-danger);
}

.cat-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}
.cat-edit-row .bb-input {
    flex: 1;
}

/* 颜色选择器 */
.cat-color-picker-wrap {
    position: relative;
    flex-shrink: 0;
}
.cat-color-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--bb-border);
    cursor: pointer;
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
    display: flex;
    align-items: center;
    justify-content: center;
}
.cat-color-dot:hover {
    border-color: var(--bb-accent);
}
.cat-color-palette {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    padding: 8px;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    box-shadow: var(--bb-shadow-float);
    width: 170px;
}
.cat-palette-swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: transform var(--bb-duration-fast) var(--bb-ease);
}
.cat-palette-swatch:hover {
    transform: scale(1.18);
}
.cat-palette-swatch.active {
    border-color: var(--bb-text-primary);
    box-shadow: 0 0 0 1px var(--bb-bg-card);
}

.cat-subs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}
.cat-sub-item {
    display: flex;
    align-items: center;
    gap: 4px;
}
.cat-sub-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 12px;
    cursor: default;
}
.cat-sub-tag__edit,
.cat-sub-tag__del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    padding: 1px;
    border-radius: 3px;
    opacity: 0;
    transition:
        opacity var(--bb-duration-fast) var(--bb-ease),
        color var(--bb-duration-fast) var(--bb-ease);
}
.cat-sub-tag:hover .cat-sub-tag__edit,
.cat-sub-tag:hover .cat-sub-tag__del {
    opacity: 1;
}
.cat-sub-tag__edit:hover {
    color: var(--bb-accent-text);
}
.cat-sub-tag__del:hover {
    color: var(--bb-danger);
}

.cat-sub-edit-input {
    width: 140px;
}

.cat-add-sub {
    display: flex;
    align-items: center;
    gap: 6px;
}
.cat-add-sub-btn {
    border: 1px dashed var(--bb-border);
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    padding: 3px 10px;
    cursor: pointer;
    transition: all var(--bb-duration-fast) var(--bb-ease);
}
.cat-add-sub-btn:hover {
    border-color: var(--bb-accent);
    color: var(--bb-accent-text);
    background: var(--bb-accent-soft);
}
.cat-add-sub-input {
    width: 180px;
}

.cat-create {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
}
.cat-create__row {
    display: flex;
    gap: 10px;
    width: 100%;
    align-items: center;
}
.cat-create .bb-input {
    flex: 1;
}

.delete-confirm {
    padding: 4px 0;
}
.delete-confirm__text {
    font-size: 14px;
    color: var(--bb-text-primary);
    margin-bottom: 8px;
}
.delete-confirm__warn {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    line-height: 1.5;
}
</style>
