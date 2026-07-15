/**
 * 本地长期记忆存储
 * 每位用户仅能访问自己的用户画像和灵魂 Markdown 文件。
 *
 * @author xiangwei
 */

import { createHash, randomUUID } from 'crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { getAppDataPath } from '../../utils/app-data-path'

/** 本地记忆类型 */
export type LocalMemoryType = 'profile' | 'soul'

/** 本地记忆文档 */
export interface LocalMemoryDocument {
    type: LocalMemoryType
    content: string
    updatedAt: string | null
    lastDistilledUserMessageCount: number
    exists: boolean
}

/** 写入本地记忆时的附加状态 */
export interface WriteMemoryOptions {
    lastDistilledUserMessageCount?: number
}

/** 本地记忆元数据 */
interface LocalMemoryMetadata {
    version: number
    type: LocalMemoryType
    updatedAt: string
    lastDistilledUserMessageCount: number
}

/** 单份记忆允许保存的最大字符数 */
export const MAX_LOCAL_MEMORY_CONTENT_LENGTH = 24_000

const MEMORY_METADATA_PREFIX = '<!-- bibi-memory-meta:'
const MEMORY_METADATA_SUFFIX = ' -->'

/**
 * 本地长期记忆存储器
 *
 * @author xiangwei
 */
export class LocalMemoryStore {
    /**
     * 创建本地记忆存储器
     *
     * @param baseDirectory 测试或特殊运行环境指定的根目录
     * @author xiangwei
     */
    constructor(private readonly baseDirectory?: string) {}

    /**
     * 读取指定用户的一份记忆
     *
     * @param userId 用户 ID
     * @param type 记忆类型
     * @returns 记忆文档
     * @author xiangwei
     */
    async readMemory(userId: string, type: LocalMemoryType): Promise<LocalMemoryDocument> {
        const filePath = this.getMemoryFilePath(userId, type)
        try {
            const raw = await readFile(filePath, 'utf-8')
            return this.parseMemoryDocument(type, raw)
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return {
                    type,
                    content: '',
                    updatedAt: null,
                    lastDistilledUserMessageCount: 0,
                    exists: false
                }
            }
            throw error
        }
    }

    /**
     * 原子写入指定用户的一份记忆
     *
     * @param userId 用户 ID
     * @param type 记忆类型
     * @param content 完整 Markdown 内容
     * @param options 附加状态
     * @returns 写入后的记忆文档
     * @author xiangwei
     */
    async writeMemory(
        userId: string,
        type: LocalMemoryType,
        content: string,
        options: WriteMemoryOptions = {}
    ): Promise<LocalMemoryDocument> {
        const normalizedContent = content.trim()
        if (!normalizedContent) throw new Error('记忆内容不能为空')
        if (normalizedContent.length > MAX_LOCAL_MEMORY_CONTENT_LENGTH) {
            throw new Error(`记忆内容不能超过 ${MAX_LOCAL_MEMORY_CONTENT_LENGTH} 个字符`)
        }

        const existing = await this.readMemory(userId, type)
        const updatedAt = new Date().toISOString()
        const metadata: LocalMemoryMetadata = {
            version: 1,
            type,
            updatedAt,
            lastDistilledUserMessageCount:
                options.lastDistilledUserMessageCount ?? existing.lastDistilledUserMessageCount
        }
        const serialized = `${MEMORY_METADATA_PREFIX}${JSON.stringify(metadata)}${MEMORY_METADATA_SUFFIX}\n\n${normalizedContent}\n`
        const filePath = this.getMemoryFilePath(userId, type)
        const directory = this.getUserMemoryDirectory(userId)
        const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

        await mkdir(directory, { recursive: true })
        try {
            await writeFile(temporaryPath, serialized, 'utf-8')
            await rename(temporaryPath, filePath)
        } finally {
            await rm(temporaryPath, { force: true }).catch(() => undefined)
        }

        return {
            type,
            content: normalizedContent,
            updatedAt,
            lastDistilledUserMessageCount: metadata.lastDistilledUserMessageCount,
            exists: true
        }
    }

    /**
     * 获取记忆根目录
     *
     * @returns 记忆根目录
     * @author xiangwei
     */
    private getBaseDirectory(): string {
        return this.baseDirectory ?? getAppDataPath('memories')
    }

    /**
     * 使用不可逆摘要生成用户目录名，避免路径穿越和用户 ID 泄漏。
     *
     * @param userId 用户 ID
     * @returns 用户记忆目录
     * @author xiangwei
     */
    private getUserMemoryDirectory(userId: string): string {
        if (!userId) throw new Error('用户 ID 不能为空')
        const userDirectory = createHash('sha256').update(userId).digest('hex').slice(0, 32)
        return join(this.getBaseDirectory(), userDirectory)
    }

    /**
     * 获取固定类型的 Markdown 文件路径
     *
     * @param userId 用户 ID
     * @param type 记忆类型
     * @returns 文件路径
     * @author xiangwei
     */
    private getMemoryFilePath(userId: string, type: LocalMemoryType): string {
        const fileName = type === 'profile' ? 'profile.md' : 'soul.md'
        return join(this.getUserMemoryDirectory(userId), fileName)
    }

    /**
     * 解析带元数据的 Markdown 记忆文件
     *
     * @param type 记忆类型
     * @param raw 文件原文
     * @returns 记忆文档
     * @author xiangwei
     */
    private parseMemoryDocument(type: LocalMemoryType, raw: string): LocalMemoryDocument {
        const firstLineEnd = raw.indexOf('\n')
        const firstLine = (firstLineEnd >= 0 ? raw.slice(0, firstLineEnd) : raw).trim()
        let metadata: LocalMemoryMetadata | null = null
        const hasMetadataLine =
            firstLine.startsWith(MEMORY_METADATA_PREFIX) &&
            firstLine.endsWith(MEMORY_METADATA_SUFFIX)

        if (hasMetadataLine) {
            const metadataText = firstLine.slice(
                MEMORY_METADATA_PREFIX.length,
                -MEMORY_METADATA_SUFFIX.length
            )
            try {
                const parsed = JSON.parse(metadataText) as Partial<LocalMemoryMetadata>
                if (
                    parsed.version === 1 &&
                    parsed.type === type &&
                    typeof parsed.updatedAt === 'string' &&
                    typeof parsed.lastDistilledUserMessageCount === 'number' &&
                    Number.isInteger(parsed.lastDistilledUserMessageCount) &&
                    parsed.lastDistilledUserMessageCount >= 0
                ) {
                    metadata = parsed as LocalMemoryMetadata
                }
            } catch {
                metadata = null
            }
        }

        const parsedContent =
            hasMetadataLine && firstLineEnd >= 0 ? raw.slice(firstLineEnd + 1).trim() : raw.trim()
        const content = parsedContent.slice(0, MAX_LOCAL_MEMORY_CONTENT_LENGTH)
        return {
            type,
            content,
            updatedAt: metadata?.updatedAt ?? null,
            lastDistilledUserMessageCount: metadata?.lastDistilledUserMessageCount ?? 0,
            exists: true
        }
    }
}

/** 全局本地记忆存储 */
export const localMemoryStore = new LocalMemoryStore()
