/**
 * 导入草稿共享状态
 * 持有当前渲染会话内的导入草稿快照，供 ContextPanel 展示待确认条数
 * 注意：草稿仅存在于当前渲染会话，刷新或重启后需要重新解析文件
 * @author xiangwei
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ImportDraftSnapshot } from '@shared/types'

export const useImportStore = defineStore('import', () => {
    /** 当前导入草稿快照，无草稿时为 null */
    const draft = ref<ImportDraftSnapshot | null>(null)

    /** 草稿中待确认的条目数量 */
    const draftItemCount = computed(() => draft.value?.items?.length ?? 0)

    /**
     * 写入或清空当前草稿快照
     *
     * @param value 草稿快照，传入 null 表示清空
     * @author xiangwei
     */
    function setDraft(value: ImportDraftSnapshot | null): void {
        draft.value = value
    }

    /** 清空当前草稿快照 */
    function clearDraft(): void {
        draft.value = null
    }

    /** 重置为初始状态（用户切换时调用） */
    function reset(): void {
        draft.value = null
    }

    return { draft, draftItemCount, setDraft, clearDraft, reset }
})
