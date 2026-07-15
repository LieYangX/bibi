<template>
    <div class="bb-page-container bb-page-container--medium">
        <PageHeader title="设置" />

        <div class="settings-card">
            <div class="settings-head">
                <Eye :size="18" />
                <span>显示设置</span>
            </div>
            <div class="settings-row">
                <div class="settings-info">
                    <div class="settings-title">金额脱敏</div>
                    <div class="settings-desc">
                        开启后金额旁会显示小眼睛，点击可切换当前金额是否显示
                    </div>
                </div>
                <BbSwitch
                    :model-value="settingStore.amountMaskEnabled"
                    @update:model-value="onMaskChange"
                />
            </div>
        </div>

        <div class="settings-card">
            <div class="settings-head">
                <Info :size="18" />
                <span>功能说明</span>
            </div>
            <div class="settings-row settings-row--clickable" @click="showFeatures = true">
                <div class="settings-info">
                    <div class="settings-title">主要功能</div>
                    <div class="settings-desc">了解笔笔的所有功能特性</div>
                </div>
                <ChevronRight :size="16" class="settings-row-arrow" />
            </div>
        </div>

        <!-- 智能体设置 -->
        <AgentSettings />

        <!-- 语音转文字设置 -->
        <SttSettings />

        <!-- 关于应用 -->
        <div class="settings-card">
            <div class="settings-head">
                <Info :size="18" />
                <span>关于应用</span>
            </div>
            <div class="settings-row settings-row--clickable" @click="showReleaseNotes">
                <div class="settings-info">
                    <div class="settings-title">更新内容</div>
                    <div class="settings-desc">查看当前版本新增内容与问题修复</div>
                </div>
                <ChevronRight :size="16" class="settings-row-arrow" />
            </div>
            <div class="settings-row settings-row--clickable" @click="showAbout = true">
                <div class="settings-info">
                    <div class="settings-title">应用介绍</div>
                    <div class="settings-desc">查看应用版本、开发者信息和联系方式</div>
                </div>
                <ChevronRight :size="16" class="settings-row-arrow" />
            </div>
        </div>

        <!-- 应用介绍弹窗 -->
        <BbModal
            :visible="showAbout"
            title="关于笔笔"
            width="420px"
            @update:visible="showAbout = $event"
        >
            <AboutSection />
            <template #footer>
                <button class="bb-btn bb-btn-primary" @click="showAbout = false">关闭</button>
            </template>
        </BbModal>

        <!-- 功能介绍弹窗 -->
        <BbModal
            :visible="showFeatures"
            title="主要功能"
            width="500px"
            @update:visible="showFeatures = $event"
        >
            <div class="feature-list">
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.dashboard"></div>
                    <div>
                        <strong>首页仪表盘</strong>
                        <span
                            >按月/按年查看收支概览、支出构成饼图、每日/月度趋势柱状图，以及分类支出与收入排行。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.list"></div>
                    <div>
                        <strong>流水明细</strong>
                        <span
                            >按类型、日期、账户、关键词筛选流水记录，支持金额脱敏，双击可编辑。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.bank"></div>
                    <div>
                        <strong>账户管理</strong>
                        <span
                            >管理银行卡、微信、支付宝、现金、信用卡等多种账户类型，支持还款操作。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.tag"></div>
                    <div>
                        <strong>分类管理</strong>
                        <span
                            >支出与收入分类独立管理，支持一级/二级分类树形结构，可自定义增删改。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.wallet"></div>
                    <div>
                        <strong>预算管理</strong>
                        <span>按月或按年设定各分类预算，实时跟踪执行进度，超支自动预警。</span>
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.import"></div>
                    <div>
                        <strong>账单导入</strong>
                        <span
                            >支持支付宝 CSV 和微信 XLSX
                            账单导入，草稿式预览与确认，分类与账户自动映射。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.agent"></div>
                    <div>
                        <strong>智能体</strong>
                        <span
                            >集成 DeepSeek AI
                            智能助手，可在应用内对话问答，辅助记账与数据分析。</span
                        >
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.mic"></div>
                    <div>
                        <strong>语音转文字</strong>
                        <span>集成本地语音模型，在智能体对话中可直接用语音输入，无需联网。</span>
                    </div>
                </div>
                <div class="feature-item">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div class="feature-icon" v-html="featureIcons.shield"></div>
                    <div>
                        <strong>数据安全</strong>
                        <span
                            >所有数据仅存储于本地 SQLite
                            数据库，无需联网，不收集任何个人隐私信息。</span
                        >
                    </div>
                </div>
            </div>
            <template #footer>
                <button class="bb-btn bb-btn-primary" @click="showFeatures = false">知道了</button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 设置页（独立路由）
 * 收纳关于信息、系统设置；用户管理仍由登录页承担
 * @author xiangwei
 */
import { inject, ref, onMounted } from 'vue'
import { PageHeader } from '../components/common'
import { useSettingStore } from '../stores/setting.store'
import { BbSwitch, BbModal, Message } from '../components/ui'
import AboutSection from './sections/AboutSection.vue'
import AgentSettings from './sections/AgentSettings.vue'
import SttSettings from './sections/SttSettings.vue'
import { openReleaseNotesKey } from '../app/release-notes-presenter'
import { Eye, Info, ChevronRight } from '@lucide/vue'

const settingStore = useSettingStore()
const showFeatures = ref(false)
const showAbout = ref(false)
const openReleaseNotes = inject(openReleaseNotesKey)

/**
 * 打开当前版本更新公告
 *
 * @author xiangwei
 */
function showReleaseNotes(): void {
    void openReleaseNotes?.()
}

const featureIcons = {
    dashboard:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M3 12h4v9H3zm14-4h4v13h-4zm-7-6h4v19h-4z"/></svg>',
    list: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 22H5a3 3 0 0 1-3-3V3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12h4v4a3 3 0 0 1-3 3m-1-5v2a1 1 0 1 0 2 0v-2zM6 7v2h8V7zm0 4v2h8v-2zm0 4v2h5v-2z"/></svg>',
    bank: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 19h2V6l6.394 2.74a1 1 0 0 1 .606.92V19h2v2H1v-2h2V5.65a1 1 0 0 1 .594-.914l7.703-3.423a.5.5 0 0 1 .703.456z"/></svg>',
    tag: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m10.904 2.1l9.9 1.414l1.414 9.9l-9.192 9.192a1 1 0 0 1-1.415 0l-9.9-9.9a1 1 0 0 1 0-1.413zm2.829 8.486a2 2 0 1 0 2.828-2.829a2 2 0 0 0-2.828 2.829"/></svg>',
    wallet: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M22.005 6h-7a6 6 0 0 0 0 12h7v2a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1zm-7 2h8v8h-8a4 4 0 1 1 0-8m0 3v2h3v-2z"/></svg>',
    import: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16 2l5 5v14.008a.993.993 0 0 1-.993.992H3.993A1 1 0 0 1 3 21.008V2.992C3 2.444 3.445 2 3.993 2zm-3 10V8h-2v4H8l4 4l4-4z"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M3.783 2.826L12 1l8.217 1.826a1 1 0 0 1 .783.976v9.987a6 6 0 0 1-2.672 4.992L12 23l-6.328-4.219A6 6 0 0 1 3 13.79V3.802a1 1 0 0 1 .783-.976M12 11a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m-4.473 5h8.946a4.5 4.5 0 0 0-8.946 0"/></svg>',
    agent: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M14 4.438c-.305.837-.588 1.512-1.219 2.192C12.382 7.207 11.47 7.647 10 8c1.47.353 2.382.793 2.781 1.37c.631.68.914 1.355 1.219 2.192c.305-.837.588-1.512 1.219-2.192C15.618 8.793 16.53 8.353 18 8c-1.47-.353-2.382-.793-2.781-1.37C14.588 5.95 14.305 5.275 14 4.438M5 12c.823.197 1.335.444 1.557.767c.353.515.512 1.055.693 1.733c.18-.678.34-1.218.693-1.733C8.665 12.444 9.177 12.197 10 12c-.823-.197-1.335-.444-1.557-.767C8.09 10.718 7.93 10.178 7.75 9.5c-.18.678-.34 1.218-.693 1.733c-.222.323-.734.57-1.557.767m10 3c-.548.131-.89.296-1.038.512c-.235.343-.341.703-.462 1.155c-.12-.452-.227-.812-.462-1.155c-.148-.216-.49-.381-1.038-.512c.548-.131.89-.296 1.038-.512c.235-.343.341-.703.462-1.155c.12.452.227.812.462 1.155c.148.216.49.381 1.038.512"/></svg>',
    mic: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3m-1 16.06V20h2v-1.94A8.005 8.005 0 0 0 20 10h-2a6 6 0 0 1-12 0H4a8.005 8.005 0 0 0 7 7.94"/></svg>'
}

async function onMaskChange(enabled: boolean): Promise<void> {
    if (!(await settingStore.saveAmountMask(enabled))) {
        Message.error(settingStore.error || '保存金额脱敏设置失败')
    }
}

onMounted(async () => {
    if (!(await settingStore.loadAmountMask())) {
        Message.error(settingStore.error || '加载金额脱敏设置失败')
    }
})
</script>

<style scoped>
.settings-card {
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 16px;
}
.settings-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--bb-border);
}
.settings-head svg {
    color: var(--bb-accent);
}
.settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
.settings-info {
    flex: 1;
    min-width: 0;
}
.settings-title {
    font-size: 14px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
}
.settings-desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    margin-top: 2px;
    line-height: 1.4;
}

.settings-row--clickable {
    cursor: pointer;
    border-radius: 10px;
    padding: 10px 12px;
    margin: 0 -12px;
    transition: background var(--bb-duration-fast) var(--bb-ease);
}

.settings-row--clickable:hover {
    background: var(--bb-bg-hover);
}

.settings-row-arrow {
    color: var(--bb-text-tertiary);
    flex-shrink: 0;
}

.feature-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 0;
}

.feature-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-width: 36px;
    max-width: 36px;
    height: 36px;
    min-height: 36px;
    max-height: 36px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--bb-accent-light);
    color: var(--bb-accent);
    overflow: hidden;
}

.feature-item div {
    flex: 1;
    min-width: 0;
}

.feature-item strong {
    display: block;
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    margin-bottom: 3px;
}

.feature-item span {
    display: block;
    font-size: 12px;
    line-height: 1.6;
    color: var(--bb-text-tertiary);
}
</style>
