/**
 * 结构化内容解析工具
 *
 * 从 AI 回复的 Markdown 文本中识别并提取 ```bibi-xxx 包裹的结构化数据块，
 * 将原始内容拆分为"纯文本段落 + 结构化数据条目"的有序列表，供前端分别渲染。
 *
 * @author xiangwei
 */

import type { StructuredDataEntry } from '@shared/types'

/** 解析结果片段——要么是文本，要么是结构化数据 */
export interface ContentSegment {
    type: 'text' | 'structured'
    /** text 类型时为此段落的 Markdown 文本 */
    text?: string
    /** structured 类型时为解析后的结构化条目 */
    entry?: StructuredDataEntry
}

/**
 * 从 Markdown 文本中提取所有 ```bibi-xxx 结构化块
 *
 * @param content 原始 Markdown 文本
 * @returns 按顺序排列的内容片段列表
 * @author xiangwei
 */
export function parseStructuredContent(content: string): ContentSegment[] {
    if (!content) return [{ type: 'text', text: '' }]

    const segments: ContentSegment[] = []
    // 匹配 ```bibi-table / ```bibi-chart / ```bibi-card / ```bibi-file 块
    const blockRegex = /```(bibi-table|bibi-chart|bibi-card|bibi-file)\s*\n([\s\S]*?)```/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = blockRegex.exec(content)) !== null) {
        // 前导文本
        const beforeText = content.slice(lastIndex, match.index)
        if (beforeText.trim()) {
            segments.push({ type: 'text', text: beforeText })
        }

        const langTag = match[1] as 'bibi-table' | 'bibi-chart' | 'bibi-card'
        const jsonStr = match[2].trim()
        const entry = parseBlock(langTag, jsonStr)
        if (entry) {
            segments.push({ type: 'structured', entry })
        } else {
            // 无法解析时作为普通文本保留
            segments.push({ type: 'text', text: match[0] })
        }

        lastIndex = match.index + match[0].length
    }

    // 尾部文本
    const afterText = content.slice(lastIndex)
    if (afterText.trim()) {
        segments.push({ type: 'text', text: afterText })
    }

    // 没有任何结构化块时原样返回
    if (segments.length === 0) {
        segments.push({ type: 'text', text: content })
    }

    return segments
}

/**
 * 将语言标签和 JSON 字符串解析为结构化条目
 *
 * @param langTag 代码块语言标签（bibi-table / bibi-chart / bibi-card）
 * @param jsonStr 代码块内的 JSON 字符串
 * @returns 解析成功的结构化条目，失败时返回 null
 * @author xiangwei
 */
function parseBlock(langTag: string, jsonStr: string): StructuredDataEntry | null {
    try {
        const parsed = JSON.parse(jsonStr)
        if (!parsed || typeof parsed !== 'object') return null

        switch (langTag) {
            case 'bibi-table':
                return parseTableBlock(parsed)
            case 'bibi-chart':
                return parseChartBlock(parsed)
            case 'bibi-card':
                return parseCardBlock(parsed)
            case 'bibi-file':
                return parseFileBlock(parsed)
            default:
                return null
        }
    } catch {
        return null
    }
}

/**
 * 解析文件块
 *
 * @param data 解析后的 JSON 对象
 * @returns 结构化条目
 * @author xiangwei
 */
function parseFileBlock(data: Record<string, unknown>): StructuredDataEntry | null {
    if (typeof data.path !== 'string' || !data.path) return null
    return {
        data_type: 'file',
        data: {
            path: data.path,
            action: typeof data.action === 'string' ? data.action : 'modified',
            size: typeof data.size === 'number' ? data.size : undefined
        }
    }
}

/**
 * 解析表格块
 *
 * @param data 解析后的 JSON 对象
 * @returns 结构化条目
 * @author xiangwei
 */
function parseTableBlock(data: Record<string, unknown>): StructuredDataEntry | null {
    if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) return null
    return {
        data_type: 'table',
        data: {
            title: typeof data.title === 'string' ? data.title : undefined,
            columns: data.columns as string[],
            rows: data.rows as string[][]
        }
    }
}

/**
 * 解析图表块
 *
 * @param data 解析后的 JSON 对象
 * @returns 结构化条目
 * @author xiangwei
 */
function parseChartBlock(data: Record<string, unknown>): StructuredDataEntry | null {
    const chartType = data.type
    if (chartType !== 'pie' && chartType !== 'bar' && chartType !== 'line') return null
    if (!Array.isArray(data.labels) || !Array.isArray(data.datasets)) return null
    return {
        data_type: 'chart',
        data: {
            title: typeof data.title === 'string' ? data.title : undefined,
            type: chartType,
            labels: data.labels as string[],
            datasets: data.datasets as Array<{ name: string; values: number[] }>
        }
    }
}

/**
 * 解析卡片块
 *
 * @param data 解析后的 JSON 对象
 * @returns 结构化条目
 * @author xiangwei
 */
function parseCardBlock(data: Record<string, unknown>): StructuredDataEntry | null {
    if (!Array.isArray(data.fields)) return null
    return {
        data_type: 'card',
        data: {
            title: typeof data.title === 'string' ? data.title : undefined,
            fields: data.fields as Array<{ label: string; value: string; color?: string }>
        }
    }
}
