/**
 * 分类管理 IPC
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import {
    createCategory,
    createSubCategory,
    deleteCategory,
    deleteSubCategory,
    listCategories,
    resetDefaults,
    updateCategory,
    updateSubCategory
} from '../services/category.service'
import { registerUserIpcHandler } from './handle-ipc'

export function registerCategoryIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.category.list,
        IPC_SCHEMAS.category.list,
        '获取分类列表失败',
        (userId, _event, type) => listCategories(userId, type)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.create,
        IPC_SCHEMAS.category.create,
        '创建分类失败',
        (userId, _event, data) => createCategory(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.createSub,
        IPC_SCHEMAS.category.createSub,
        '创建子分类失败',
        (userId, _event, data) => createSubCategory(data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.update,
        IPC_SCHEMAS.category.update,
        '更新分类失败',
        (userId, _event, id, data) => updateCategory(id, data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.delete,
        IPC_SCHEMAS.category.delete,
        '删除分类失败',
        (userId, _event, id) => deleteCategory(id, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.resetDefaults,
        IPC_SCHEMAS.none,
        '重置分类失败',
        (userId) => resetDefaults(userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.updateSub,
        IPC_SCHEMAS.category.updateSub,
        '更新子分类失败',
        (userId, _event, id, data) => updateSubCategory(id, data, userId)
    )
    registerUserIpcHandler(
        IPC_CHANNELS.category.deleteSub,
        IPC_SCHEMAS.category.deleteSub,
        '删除子分类失败',
        (userId, _event, id) => deleteSubCategory(id, userId)
    )
}
