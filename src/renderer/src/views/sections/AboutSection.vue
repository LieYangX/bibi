<template>
    <div class="about-content">
        <div class="about-brand">
            <img class="about-logo" src="../../assets/app-icon.png" alt="笔笔" />
            <div class="about-name">笔笔</div>
            <div class="about-version">v{{ versions.app }}</div>
        </div>
        <div class="about-desc">一个简洁的桌面记账应用，帮助你轻松管理个人财务。</div>
        <div class="about-info">
            <div class="info-row">
                <span class="info-label">应用版本</span
                ><span class="info-value">v{{ versions.app }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Electron</span
                ><span class="info-value">{{ versions.electron }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Node.js</span
                ><span class="info-value">{{ versions.node }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Chrome</span
                ><span class="info-value">{{ versions.chrome }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">V8</span><span class="info-value">{{ versions.v8 }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">开发</span><span class="info-value">烈阳</span>
            </div>
            <div class="info-row">
                <span class="info-label">测试</span><span class="info-value">焦冻</span>
            </div>
            <div class="info-row">
                <span class="info-label">反馈联系 QQ</span>
                <span class="info-value">
                    <a
                        class="contact-link"
                        href="https://qm.qq.com/cgi-bin/qm/qr?k=956931131"
                        target="_blank"
                        rel="noopener"
                        >956931131</a
                    >
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">联系邮箱</span>
                <span class="info-value">
                    <a class="contact-link" href="mailto:956931131@qq.com">956931131@qq.com</a>
                </span>
            </div>
        </div>
        <div class="about-footer">
            <Shield :size="13" style="color: var(--bb-text-tertiary)" /><span
                >数据仅存储于本地，安全可靠</span
            >
        </div>
    </div>
</template>
<script setup lang="ts">
/**
 * 关于页面
 * @author xiangwei
 */

import { ref, onMounted } from 'vue'
import { Shield } from '@lucide/vue'
import type { AppVersions } from '@shared/types'
import { desktopApi } from '../../api/desktop-api'

const versions = ref<AppVersions>({
    electron: '',
    node: '',
    chrome: '',
    v8: '',
    app: '1.0.0'
})

onMounted(async () => {
    try {
        const result = await desktopApi.app.getVersions()
        if (result.ok) versions.value = result.data
    } catch {
        // 降级，使用默认值
    }
})
</script>
<style scoped>
.about-content {
    text-align: center;
}

.about-brand {
    margin-bottom: 20px;
}

.about-logo {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    margin: 0 auto 12px;
}

.about-name {
    font-size: 22px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
}

.about-version {
    font-size: 13px;
    color: var(--bb-text-tertiary);
    margin-top: 4px;
    font-family: var(--bb-font-mono);
}

.about-desc {
    font-size: 14px;
    color: var(--bb-text-secondary);
    max-width: 320px;
    margin: 0 auto 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--bb-border);
}

.about-info {
    text-align: left;
    max-width: 300px;
    margin: 0 auto 28px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
}

.info-row + .info-row {
    border-top: 1px solid var(--bb-border-light);
}

.info-label {
    font-size: 13px;
    color: var(--bb-text-tertiary);
}

.info-value {
    font-size: 13px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
}

.contact-link {
    color: var(--bb-accent-text);
    text-decoration: none;
    transition: opacity var(--bb-duration-fast) var(--bb-ease);
}

.contact-link:hover {
    opacity: 0.75;
}

.about-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: var(--bb-text-tertiary);
    padding-top: 20px;
    border-top: 1px solid var(--bb-border);
}
</style>
