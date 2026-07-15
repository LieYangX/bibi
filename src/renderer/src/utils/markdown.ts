/**
 * Markdown 安全渲染工具
 * @author xiangwei
 */

import { marked, Renderer } from 'marked'
import { isSafeExternalUrl } from '../../../shared/security/url'

const renderer = new Renderer()

/**
 * 转义 HTML 文本和属性值
 *
 * @param value 原始文本
 * @returns 转义后的文本
 * @author xiangwei
 */
function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

renderer.html = ({ text }) => escapeHtml(text)

renderer.link = ({ href, title, tokens }) => {
    const content = renderer.parser.parseInline(tokens)
    if (!isSafeExternalUrl(href)) return content

    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
    return `<a href="${escapeHtml(href)}"${titleAttribute} rel="noopener noreferrer">${content}</a>`
}

renderer.image = ({ text }) => escapeHtml(text)

/**
 * 将不受信任的 Markdown 渲染为安全 HTML
 *
 * 原始 HTML 和图片不会进入 DOM，链接仅允许 HTTP/HTTPS 协议。
 *
 * @param content Markdown 文本
 * @returns 可安全写入页面的 HTML
 * @author xiangwei
 */
export function renderSafeMarkdown(content: string): string {
    if (!content) return ''
    return marked.parse(content, { breaks: true, gfm: true, renderer }) as string
}
