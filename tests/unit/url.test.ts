import { describe, expect, it } from 'vitest'
import { isApplicationNavigation, isSafeExternalUrl } from '../../src/shared/security/url'

describe('导航安全策略', () => {
    it('只允许 http 与 https 外链', () => {
        expect(isSafeExternalUrl('https://example.com')).toBe(true)
        expect(isSafeExternalUrl('http://example.com')).toBe(true)
        expect(isSafeExternalUrl('file:///tmp/app')).toBe(false)
        expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    })

    it('只允许同源或同一 file 页面导航', () => {
        expect(
            isApplicationNavigation('https://app.example/index', 'https://app.example/#/home')
        ).toBe(true)
        expect(isApplicationNavigation('https://app.example/index', 'https://evil.example/')).toBe(
            false
        )
        expect(
            isApplicationNavigation('file:///app/index.html', 'file:///app/index.html#/home')
        ).toBe(true)
    })
})
