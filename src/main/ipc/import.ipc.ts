/**
 * 数据导入 IPC
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { dialog, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import type { ImportSource } from '@shared/types'
import {
    applyImportDraftOperation,
    getImportDraftSnapshot,
    type ImportDraftData
} from '../services/import-draft.service'
import { confirmImportDraft, createImportDraft } from '../services/import.service'
import { registerUserIpcHandler } from './handle-ipc'

const FILE_TOKEN_TTL_MS = 10 * 60 * 1000
const DRAFT_TTL_MS = 30 * 60 * 1000
const MAX_SELECTED_FILES = 20
const MAX_IMPORT_DRAFTS = 10

interface SelectedFile {
    filePath: string
    source: ImportSource
    userId: string
    senderId: number
    expiresAt: number
}

interface OwnedImportDraft {
    draft: ImportDraftData
    userId: string
    senderId: number
}

const selectedFiles = new Map<string, SelectedFile>()
const importDrafts = new Map<string, OwnedImportDraft>()
const trackedSenderIds = new Set<number>()

/**
 * 注册导入相关 IPC 处理器
 *
 * @author xiangwei
 */
export function registerImportIpc(): void {
    registerUserIpcHandler(
        IPC_CHANNELS.import.selectFile,
        IPC_SCHEMAS.import.selectFile,
        '选择文件失败',
        async (userId, event, source) => selectImportFile(userId, event, source)
    )

    registerUserIpcHandler(
        IPC_CHANNELS.import.parseFile,
        IPC_SCHEMAS.import.parseFile,
        '文件解析失败',
        async (userId, event, fileToken, source) => {
            pruneImportState()
            const selectedFile = selectedFiles.get(fileToken)
            if (
                !selectedFile ||
                selectedFile.userId !== userId ||
                selectedFile.senderId !== event.sender.id ||
                selectedFile.source !== source
            ) {
                throw new Error('文件选择已失效，请重新选择')
            }
            selectedFiles.delete(fileToken)

            const draft = await createImportDraft(
                selectedFile.filePath,
                source,
                userId,
                Date.now() + DRAFT_TTL_MS
            )
            pruneImportState()
            importDrafts.set(draft.draft_id, {
                draft,
                userId,
                senderId: event.sender.id
            })
            pruneImportState()
            return getImportDraftSnapshot(draft)
        }
    )

    registerUserIpcHandler(
        IPC_CHANNELS.import.updateDraft,
        IPC_SCHEMAS.import.updateDraft,
        '更新导入草稿失败',
        (userId, event, data) => {
            const draft = getOwnedDraft(userId, event, data.draft_id)
            assertDraftRevision(draft, data.revision)
            draft.expires_at = Date.now() + DRAFT_TTL_MS
            return applyImportDraftOperation(draft, userId, data.operation)
        }
    )

    registerUserIpcHandler(
        IPC_CHANNELS.import.confirmDraft,
        IPC_SCHEMAS.import.confirmDraft,
        '确认导入失败',
        async (userId, event, data) => {
            const draft = getOwnedDraft(userId, event, data.draft_id)
            assertDraftRevision(draft, data.revision)
            const result = await confirmImportDraft(userId, draft, data.remember_mappings)
            importDrafts.delete(data.draft_id)
            return result
        }
    )

    registerUserIpcHandler(
        IPC_CHANNELS.import.discardDraft,
        IPC_SCHEMAS.import.discardDraft,
        '取消导入失败',
        (userId, event, data) => {
            getOwnedDraft(userId, event, data.draft_id)
            importDrafts.delete(data.draft_id)
        }
    )
}

async function selectImportFile(
    userId: string,
    event: IpcMainInvokeEvent,
    source: ImportSource
): Promise<string | null> {
    const extension = source === 'alipay' ? 'csv' : 'xlsx'
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: `${source === 'alipay' ? '支付宝' : '微信'}账单`, extensions: [extension] }
        ]
    })
    const filePath = result.filePaths[0]
    if (!filePath) return null

    const fileToken = randomUUID()
    const senderId = event.sender.id
    pruneImportState()
    selectedFiles.set(fileToken, {
        filePath,
        source,
        userId,
        senderId,
        expiresAt: Date.now() + FILE_TOKEN_TTL_MS
    })
    pruneImportState()
    trackSender(event)
    return fileToken
}

function getOwnedDraft(
    userId: string,
    event: IpcMainInvokeEvent,
    draftId: string
): ImportDraftData {
    pruneImportState()
    const ownedDraft = importDrafts.get(draftId)
    if (!ownedDraft || ownedDraft.userId !== userId || ownedDraft.senderId !== event.sender.id) {
        throw new Error('导入草稿已失效，请重新选择文件')
    }
    return ownedDraft.draft
}

function assertDraftRevision(draft: ImportDraftData, revision: number): void {
    if (draft.revision !== revision) throw new Error('导入草稿已更新，请刷新后重试')
}

function trackSender(event: IpcMainInvokeEvent): void {
    const senderId = event.sender.id
    if (trackedSenderIds.has(senderId)) return
    trackedSenderIds.add(senderId)
    event.sender.once('destroyed', () => clearSenderImportState(senderId))
}

function clearSenderImportState(senderId: number): void {
    for (const [token, selectedFile] of selectedFiles) {
        if (selectedFile.senderId === senderId) selectedFiles.delete(token)
    }
    for (const [draftId, ownedDraft] of importDrafts) {
        if (ownedDraft.senderId === senderId) importDrafts.delete(draftId)
    }
    trackedSenderIds.delete(senderId)
}

function pruneImportState(now = Date.now()): void {
    for (const [token, selectedFile] of selectedFiles) {
        if (selectedFile.expiresAt <= now) selectedFiles.delete(token)
    }
    for (const [draftId, ownedDraft] of importDrafts) {
        if (ownedDraft.draft.expires_at <= now) importDrafts.delete(draftId)
    }
    while (selectedFiles.size > MAX_SELECTED_FILES) {
        const oldestToken = selectedFiles.keys().next().value
        if (!oldestToken) break
        selectedFiles.delete(oldestToken)
    }
    while (importDrafts.size > MAX_IMPORT_DRAFTS) {
        const oldestDraftId = importDrafts.keys().next().value
        if (!oldestDraftId) break
        importDrafts.delete(oldestDraftId)
    }
}
