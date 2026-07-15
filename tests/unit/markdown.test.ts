import { describe, expect, it } from 'vitest'
import { renderSafeMarkdown } from '../../src/renderer/src/utils/markdown'

describe('Markdown 安全渲染', () => {
    it('转义原始 HTML 并移除危险链接和图片', () => {
        const html = renderSafeMarkdown(
            '<img src=x onerror=alert(1)>\n\n[危险链接](javascript:alert(1))\n\n![远程图片](https://evil.example/a.png)'
        )

        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
        expect(html).not.toContain('<img')
        expect(html).not.toContain('javascript:')
        expect(html).not.toContain('evil.example')
    })

    it('保留安全外链并增加隔离属性', () => {
        const html = renderSafeMarkdown('[官网](https://example.com/path)')

        expect(html).toContain('href="https://example.com/path"')
        expect(html).toContain('rel="noopener noreferrer"')
    })
})
