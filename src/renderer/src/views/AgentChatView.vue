<template>
    <div class="agent-home" :class="{ 'agent-home--empty': !hasMessages }">
        <div class="agent-chat-col">
            <!-- 有消息时：简约顶栏 -->
            <header v-if="hasMessages" class="agent-bar">
                <div class="agent-bar__left">
                    <button
                        class="agent-bar__tab"
                        :class="{ active: activePanel === 'skills' }"
                        @click="togglePanel('skills')"
                    >
                        <Puzzle :size="14" /> Skills
                        <span v-if="enabledSkillCount" class="agent-bar__badge">{{
                            enabledSkillCount
                        }}</span>
                    </button>
                    <button
                        class="agent-bar__tab"
                        :class="{ active: activePanel === 'tools' }"
                        @click="togglePanel('tools')"
                    >
                        <Zap :size="14" /> 工具 / MCP
                        <span v-if="totalToolCount" class="agent-bar__badge">{{
                            totalToolCount
                        }}</span>
                    </button>
                    <button
                        class="agent-bar__tab"
                        :class="{ active: activePanel === 'convs' }"
                        @click="togglePanel('convs')"
                    >
                        <MessageCircle :size="14" /> 对话
                        <span v-if="agentStore.conversations.length" class="agent-bar__badge">{{
                            agentStore.conversations.length
                        }}</span>
                    </button>
                </div>
                <div class="agent-bar__right">
                    <button
                        class="agent-bar__toggle"
                        :class="{ 'agent-bar__toggle--off': showContextPanel === false }"
                        title="速览面板"
                        @click="toggleContextPanel"
                    >
                        <PanelRight :size="16" />
                    </button>
                    <button
                        class="agent-bar__new"
                        title="新对话"
                        :disabled="agentStore.isProcessing"
                        @click="onNewConv"
                    >
                        <Plus :size="16" />
                    </button>
                </div>
            </header>

            <!-- ══════ 消息区 ══════ -->
            <main
                ref="messagesRef"
                class="agent-scroll-area"
                :class="{
                    'agent-scroll-area--empty': !hasMessages
                }"
                tabindex="-1"
                @keydown="handleKeydown"
            >
                <div v-if="agentStore.loading && !hasMessages" class="agent-hero">
                    <div class="agent-page-loader"><span /><span /><span /></div>
                    <p class="agent-hero__desc">正在准备小笔…</p>
                </div>

                <div v-else-if="agentStore.error && !hasMessages" class="agent-hero">
                    <p class="agent-hero__desc">{{ agentStore.error }}</p>
                    <button class="bb-btn bb-btn-sm" @click="agentStore.initialize()">
                        重新加载
                    </button>
                </div>

                <!-- 未配置 -->
                <div v-else-if="!agentStore.hasConfig && !hasMessages" class="agent-hero">
                    <div class="empty-hero__logo">
                        <img
                            class="empty-hero__img"
                            src="../assets/app-icon.png"
                            alt="小笔"
                            draggable="false"
                        />
                    </div>
                    <h1 class="empty-hero__greeting">小笔</h1>
                    <p class="agent-hero__desc">请先在设置中配置 DeepSeek API Key 并启用小笔功能</p>
                </div>

                <!-- 空对话 -- 居中英雄区 -->
                <div v-else-if="!hasMessages" class="agent-empty-hero">
                    <div class="empty-hero__logo">
                        <img
                            class="empty-hero__img"
                            src="../assets/app-icon.png"
                            alt="小笔"
                            draggable="false"
                        />
                    </div>
                    <h1 class="empty-hero__greeting">{{ greeting }}，{{ userName }}</h1>
                    <p class="empty-hero__subtitle">
                        {{ modeSubtitle }}
                    </p>

                    <!-- 模式切换 -->
                    <div class="agent-mode-switch">
                        <button
                            class="agent-mode-btn"
                            :class="{ active: currentMode === 'fast' }"
                            @click="switchMode('fast')"
                        >
                            <Zap :size="14" /> 快速
                        </button>
                        <button
                            class="agent-mode-btn"
                            :class="{ active: currentMode === 'expert' }"
                            @click="switchMode('expert')"
                        >
                            <Gem :size="14" /> 专家
                        </button>
                    </div>

                    <!-- 微信与历史对话状态 -->
                    <div class="agent-status-area">
                        <div class="agent-wechat-bridge">
                            <button
                                v-if="agentStore.wechatStatus?.phase === 'connected'"
                                class="agent-status-chip agent-status-chip--success"
                                @click="openWechatConversation"
                            >
                                <MessageCircle :size="13" />
                                <span class="agent-status-dot" />
                                微信已连接
                            </button>
                            <button
                                v-else-if="isWechatConnecting"
                                class="agent-status-chip"
                                @click="showWechatDialog = true"
                            >
                                <QrCode :size="13" /> 查看微信二维码
                            </button>
                            <button v-else class="agent-status-chip" @click="connectWechat">
                                <QrCode :size="13" /> 连接微信
                            </button>
                            <button
                                v-if="agentStore.wechatStatus?.phase === 'connected'"
                                class="agent-wechat-disconnect"
                                title="断开微信"
                                aria-label="断开微信"
                                @click="disconnectWechat"
                            >
                                <Unplug :size="14" />
                            </button>
                        </div>
                        <button
                            v-if="agentStore.conversations.length"
                            class="agent-status-chip"
                            @click="togglePanel('convs')"
                        >
                            <History :size="13" />
                            历史对话 {{ agentStore.conversations.length }}
                        </button>
                    </div>
                </div>

                <!-- 有消息时的消息时间线 -->
                <template v-else>
                    <div
                        v-if="agentStore.currentConversationId && agentStore.isLoadingMessages"
                        class="agent-history-status"
                    >
                        正在加载更早消息…
                    </div>
                    <button
                        v-else-if="agentStore.messageError && agentStore.currentConversationId"
                        class="agent-history-status agent-history-status--error"
                        @click="loadOlderAndPreserve"
                    >
                        {{ agentStore.messageError }}，点击重试
                    </button>

                    <AgentMessage
                        v-for="msg in displayMessages"
                        :key="msg.id"
                        :message="msg"
                        @edit="handleEditMessage"
                    />

                    <!-- 等待首个响应指示 -->
                    <div v-if="agentStore.isAwaitingResponse && hasMessages" class="agent-thinking">
                        <span /><span /><span />
                    </div>

                    <!-- 一键回到底部 -->
                    <button
                        class="agent-scroll-btn"
                        :class="{ 'agent-scroll-btn--hidden': !showScrollBtn }"
                        @click="scrollToBottom"
                    >
                        <ChevronDown :size="18" />
                    </button>
                </template>
            </main>

            <!-- ══════ 输入区 ══════ -->
            <footer class="agent-input-area" :class="{ 'agent-input-area--empty': !hasMessages }">
                <div v-if="hasMessages && agentStore.queuedMessages.length" class="agent-queue">
                    <div
                        v-for="(queuedMessage, index) in agentStore.queuedMessages"
                        :key="queuedMessage.id"
                        class="agent-queue__item"
                    >
                        <span class="agent-queue__index">队列 {{ index + 1 }}</span>
                        <span class="agent-queue__content" :title="queuedMessage.content">
                            {{ queuedMessage.content }}
                        </span>
                        <button
                            class="agent-queue__guide"
                            title="打断当前回答并发送此消息"
                            :disabled="agentStore.isStopping"
                            @click="guideQueuedMessage(queuedMessage.id)"
                        >
                            <CornerDownRight :size="13" /> 引导
                        </button>
                        <button
                            class="agent-queue__delete"
                            title="删除队列消息"
                            :aria-label="`删除队列消息：${queuedMessage.content}`"
                            @click="agentStore.removeQueuedMessage(queuedMessage.id)"
                        >
                            <Trash2 :size="14" />
                        </button>
                    </div>
                </div>
                <div class="agent-input-card">
                    <textarea
                        ref="inputRef"
                        v-model="inputMessage"
                        class="agent-textarea"
                        placeholder="给小笔发消息....."
                        rows="1"
                        :disabled="!agentStore.hasConfig"
                        @keydown.enter.exact.prevent="send"
                        @input="autoResize"
                    />

                    <!-- 底部功能区 -->
                    <div class="agent-input-foot">
                        <div class="agent-input-foot__left">
                            <button
                                class="agent-foot-btn"
                                :class="{ 'agent-foot-btn--active': agentStore.deepThink }"
                                :disabled="agentStore.isWechatConversation"
                                :title="
                                    agentStore.isWechatConversation
                                        ? '微信会话默认开启深度思考'
                                        : '深度思考'
                                "
                                @click="agentStore.deepThink = !agentStore.deepThink"
                            >
                                <BrainCircuit :size="15" /> 深度思考
                            </button>
                            <button
                                class="agent-foot-btn"
                                :class="{ 'agent-foot-btn--danger': agentStore.sessionTrusted }"
                                :title="
                                    agentStore.sessionTrusted
                                        ? '已授权，本会话不再弹确认窗'
                                        : '完全授权本会话，跳过所有操作确认'
                                "
                                @click="agentStore.sessionTrusted = !agentStore.sessionTrusted"
                            >
                                <ShieldCheck v-if="agentStore.sessionTrusted" :size="15" />
                                <ShieldOff v-else :size="15" />
                                {{ agentStore.sessionTrusted ? '已授权' : '完全授权' }}
                            </button>
                            <button
                                v-if="sttEnabled"
                                class="agent-foot-btn agent-mic-btn"
                                :class="{
                                    'agent-mic-btn--recording': isRecording,
                                    'agent-mic-btn--loading': isModelStarting || isTranscribing
                                }"
                                :title="
                                    isRecording
                                        ? '点击停止录音'
                                        : isModelStarting
                                          ? '语音模型启动中'
                                          : isTranscribing
                                            ? '识别中…'
                                            : '点击开始录音'
                                "
                                :disabled="
                                    isModelStarting || isTranscribing || agentStore.isProcessing
                                "
                                @click="toggleRecording"
                            >
                                <Mic :size="15" />
                                <span class="agent-mic-label">{{
                                    isModelStarting
                                        ? '启动中'
                                        : isTranscribing
                                          ? '识别中'
                                          : isRecording
                                            ? '录音中'
                                            : '语音'
                                }}</span>
                                <span
                                    v-if="
                                        (isModelStarting || isTranscribing) &&
                                        modelProgress &&
                                        modelProgress.pct > 0 &&
                                        modelProgress.pct < 100
                                    "
                                    class="agent-mic-progress"
                                >
                                    <span
                                        class="agent-mic-progress__bar"
                                        :style="{ width: modelProgress.pct + '%' }"
                                    />
                                </span>
                            </button>
                        </div>
                        <div class="agent-input-foot__right">
                            <button
                                v-if="agentStore.isProcessing"
                                class="agent-input-stop"
                                title="停止回答"
                                :disabled="agentStore.isStopping"
                                @click="stopResponse"
                            >
                                <Square
                                    :size="13"
                                    :fill="agentStore.isStopping ? 'none' : 'currentColor'"
                                />
                            </button>
                            <button
                                v-else
                                class="agent-input-send"
                                title="发送"
                                :disabled="!inputMessage.trim() || !agentStore.hasConfig"
                                @click="send"
                            >
                                <ArrowUp :size="18" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 空状态：快捷操作卡片 -->
                <div v-if="!hasMessages && agentStore.hasConfig" class="agent-quick-actions">
                    <button
                        class="qa-card"
                        type="button"
                        :disabled="agentStore.isProcessing"
                        @click="onQuickAction('record')"
                    >
                        <span class="qa-icon"><Pencil :size="18" /></span>
                        <span class="qa-title">记一笔</span>
                        <span class="qa-desc">语音或文字随手记</span>
                    </button>
                    <button
                        class="qa-card"
                        type="button"
                        :disabled="agentStore.isProcessing"
                        @click="onQuickAction('query')"
                    >
                        <span class="qa-icon"><BarChart3 :size="18" /></span>
                        <span class="qa-title">查账单</span>
                        <span class="qa-desc">这个月花了多少</span>
                    </button>
                    <button
                        class="qa-card"
                        type="button"
                        :disabled="agentStore.isProcessing"
                        @click="onQuickAction('report')"
                    >
                        <span class="qa-icon"><ReceiptText :size="18" /></span>
                        <span class="qa-title">出报表</span>
                        <span class="qa-desc">生成月度消费报告</span>
                    </button>
                    <button
                        class="qa-card"
                        type="button"
                        :disabled="agentStore.isProcessing"
                        @click="onQuickAction('budget')"
                    >
                        <span class="qa-icon"><PiggyBank :size="18" /></span>
                        <span class="qa-title">看预算</span>
                        <span class="qa-desc">预算还剩多少</span>
                    </button>
                </div>
            </footer>
        </div>

        <!-- ══════ 右侧速览面板 ══════ -->
        <Transition name="context-panel">
            <ContextPanel v-if="showContextPanel === true" />
        </Transition>

        <!-- ══════ 统一右侧抽屉（保持不变） ══════ -->
        <Teleport to="body">
            <Transition name="drawer">
                <div v-if="activePanel !== null" class="drawer-overlay" @click.self="closePanel">
                    <aside class="drawer-panel">
                        <div class="drawer-panel__head">
                            <span class="drawer-panel__title">{{ panelTitle }}</span>
                            <button class="drawer-panel__close" @click="closePanel">
                                <X :size="18" />
                            </button>
                        </div>
                        <div class="drawer-panel__body">
                            <!-- Skills 面板 -->
                            <template v-if="activePanel === 'skills'">
                                <template v-if="!skillDetailTarget">
                                    <div class="drawer-actions">
                                        <button
                                            class="bb-btn bb-btn-primary bb-btn-sm"
                                            @click="onAddSkill"
                                        >
                                            <Plus :size="14" /> 新增
                                        </button>
                                    </div>
                                    <div class="drawer-skills">
                                        <div
                                            v-for="skill in agentStore.skills"
                                            :key="skill.name"
                                            class="drawer-card"
                                            :class="{ 'is-off': !skill.isEnabled }"
                                        >
                                            <div class="drawer-skill-card__head">
                                                <div class="drawer-skill-card__name">
                                                    <Zap
                                                        :size="14"
                                                        class="drawer-skill-card__sysicon"
                                                    />
                                                    <strong>{{ skill.displayName }}</strong>
                                                    <span class="drawer-skill-card__tag">{{
                                                        skill.isSystem ? '系统' : '自定义'
                                                    }}</span>
                                                </div>
                                                <div class="drawer-skill-card__actions">
                                                    <button
                                                        v-if="!skill.isSystem"
                                                        class="drawer-skill-card__del"
                                                        title="删除"
                                                        @click.stop="onDeleteSkill(skill.name)"
                                                    >
                                                        <Trash2 :size="13" />
                                                    </button>
                                                    <button
                                                        class="skill-toggle-btn"
                                                        :class="{ active: skill.isEnabled }"
                                                        @click="
                                                            onSkillToggle(
                                                                skill.name,
                                                                !skill.isEnabled
                                                            )
                                                        "
                                                    >
                                                        <span class="skill-toggle-track"
                                                            ><span class="skill-toggle-thumb"
                                                        /></span>
                                                    </button>
                                                </div>
                                            </div>
                                            <p class="drawer-skill-card__desc">
                                                {{ skill.description }}
                                            </p>
                                            <div class="drawer-skill-card__foot">
                                                <button
                                                    class="drawer-skill-card__detail"
                                                    @click="openSkillDetail(skill.name)"
                                                >
                                                    查看 Skill 指令 · v{{ skill.version }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    <button class="drawer-back" @click="skillDetailTarget = null">
                                        <ChevronLeft :size="16" />
                                        {{ skillDetailTarget.meta.displayName }}
                                    </button>
                                    <p class="drawer-detail-desc">
                                        {{ skillDetailTarget.meta.description }}
                                    </p>
                                    <div class="drawer-section">
                                        <div class="drawer-section__title">Skill 指令</div>
                                        <pre class="drawer-md">{{
                                            skillDetailTarget.markdown
                                        }}</pre>
                                    </div>
                                </template>
                            </template>

                            <!-- 工具面板 -->
                            <template v-if="activePanel === 'tools'">
                                <div class="drawer-actions drawer-actions--between">
                                    <button
                                        class="bb-btn bb-btn-primary bb-btn-sm"
                                        @click="onAddMcpServer"
                                    >
                                        <Plus :size="14" /> 新增 MCP
                                    </button>
                                    <button
                                        class="drawer-icon-btn"
                                        title="刷新工具与 MCP"
                                        :disabled="toolsLoading"
                                        @click="loadTools(true)"
                                    >
                                        <RefreshCw :size="14" :class="{ spinning: toolsLoading }" />
                                    </button>
                                </div>

                                <section class="drawer-resource-section">
                                    <div class="drawer-resource-title">
                                        MCP 服务
                                        <span>{{ agentStore.mcpServers.length }}</span>
                                    </div>
                                    <div
                                        v-if="!agentStore.mcpServers.length"
                                        class="drawer-empty-inline"
                                    >
                                        暂无 MCP 服务
                                    </div>
                                    <div class="drawer-mcp-list">
                                        <div
                                            v-for="server in agentStore.mcpServers"
                                            :key="server.name"
                                            class="drawer-card drawer-mcp-card"
                                            :class="{ 'is-off': !server.enabled }"
                                        >
                                            <div class="drawer-mcp-card__head">
                                                <div class="drawer-mcp-card__identity">
                                                    <Server :size="15" aria-hidden="true" />
                                                    <strong>{{ server.name }}</strong>
                                                    <span
                                                        v-if="server.isDefault"
                                                        class="drawer-skill-card__tag"
                                                        >默认</span
                                                    >
                                                </div>
                                                <div class="drawer-mcp-card__actions">
                                                    <button
                                                        class="drawer-icon-btn"
                                                        title="检测连接"
                                                        :disabled="isMcpInspecting(server.name)"
                                                        @click="inspectMcpServer(server.name)"
                                                    >
                                                        <RefreshCw
                                                            :size="13"
                                                            :class="{
                                                                spinning: isMcpInspecting(
                                                                    server.name
                                                                )
                                                            }"
                                                        />
                                                    </button>
                                                    <button
                                                        class="drawer-icon-btn"
                                                        title="编辑 MCP"
                                                        @click="onEditMcpServer(server)"
                                                    >
                                                        <Pencil :size="13" />
                                                    </button>
                                                    <BbPopconfirm
                                                        v-if="!server.isDefault"
                                                        content="确定删除这个 MCP 服务吗？"
                                                        @ok="onDeleteMcpServer(server.name)"
                                                    >
                                                        <template #reference>
                                                            <button
                                                                class="drawer-icon-btn drawer-icon-btn--danger"
                                                                title="删除 MCP"
                                                            >
                                                                <Trash2 :size="13" />
                                                            </button>
                                                        </template>
                                                    </BbPopconfirm>
                                                    <button
                                                        class="skill-toggle-btn"
                                                        :class="{ active: server.enabled }"
                                                        :title="
                                                            server.enabled ? '禁用 MCP' : '启用 MCP'
                                                        "
                                                        @click="
                                                            onMcpToggle(
                                                                server.name,
                                                                !server.enabled
                                                            )
                                                        "
                                                    >
                                                        <span class="skill-toggle-track"
                                                            ><span class="skill-toggle-thumb"
                                                        /></span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="drawer-mcp-card__url">{{ server.url }}</div>
                                            <div
                                                class="drawer-mcp-status"
                                                :class="{
                                                    'drawer-mcp-status--error':
                                                        agentStore.mcpConnectionErrors[server.name],
                                                    'drawer-mcp-status--ok':
                                                        agentStore.mcpConnectionResults[server.name]
                                                }"
                                            >
                                                {{ getMcpStatusText(server) }}
                                            </div>
                                            <div
                                                v-if="
                                                    agentStore.mcpConnectionResults[server.name]
                                                        ?.tools.length
                                                "
                                                class="drawer-mcp-tools"
                                            >
                                                <div
                                                    v-for="tool in agentStore.mcpConnectionResults[
                                                        server.name
                                                    ].tools"
                                                    :key="tool.name"
                                                    class="drawer-mcp-tool"
                                                >
                                                    <span>{{ tool.name }}</span>
                                                    <small>{{
                                                        tool.description || '无描述'
                                                    }}</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section class="drawer-resource-section">
                                    <div class="drawer-resource-title">
                                        本地工具
                                        <span>{{ agentStore.localTools.length }}</span>
                                    </div>
                                    <div
                                        v-if="!agentStore.localTools.length && toolsLoading"
                                        class="drawer-empty-inline"
                                    >
                                        加载中…
                                    </div>
                                    <div
                                        v-else-if="!agentStore.localTools.length"
                                        class="drawer-empty-inline"
                                    >
                                        暂无本地工具
                                    </div>
                                    <div class="drawer-tools">
                                        <div
                                            v-for="t in agentStore.localTools"
                                            :key="t.name"
                                            class="drawer-card"
                                        >
                                            <div class="drawer-card__title">
                                                <span>{{ toolDisplayName(t.name) }}</span>
                                                <span
                                                    v-if="
                                                        (agentStore.toolCallCounts[
                                                            toolDisplayName(t.name)
                                                        ] || 0) > 0
                                                    "
                                                    class="drawer-tool-count"
                                                >
                                                    {{
                                                        agentStore.toolCallCounts[
                                                            toolDisplayName(t.name)
                                                        ]
                                                    }}
                                                    次
                                                </span>
                                                <span
                                                    v-else
                                                    class="drawer-tool-count drawer-tool-count--idle"
                                                    >0 次</span
                                                >
                                            </div>
                                            <div class="drawer-card__desc">
                                                {{ t.description || '无描述' }}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </template>

                            <!-- 对话面板 -->
                            <template v-if="activePanel === 'convs'">
                                <div class="drawer-convs">
                                    <div
                                        v-for="conv in sortedConvs"
                                        :key="conv.id"
                                        class="drawer-card"
                                        :class="{
                                            'drawer-card--active':
                                                conv.id === agentStore.currentConversationId,
                                            'drawer-card--disabled': agentStore.isProcessing
                                        }"
                                        @click="onSelectConv(conv.id)"
                                    >
                                        <div class="drawer-conv-main">
                                            <span
                                                v-if="editingConvId !== conv.id"
                                                class="drawer-conv-title"
                                                ><span
                                                    v-if="conv.source === 'wechat'"
                                                    class="drawer-conv-wechat-tag"
                                                    >微信会话</span
                                                >{{ conv.title }}</span
                                            >
                                            <div v-else class="drawer-conv-edit-row">
                                                <input
                                                    v-model="editingTitle"
                                                    class="drawer-conv-title-input"
                                                    @keydown.enter.prevent="saveEditConv(conv.id)"
                                                    @keydown.escape="editingConvId = null"
                                                    @blur="saveEditConv(conv.id)"
                                                    @click.stop
                                                />
                                                <button
                                                    class="drawer-conv-title-ok"
                                                    @click.stop="saveEditConv(conv.id)"
                                                >
                                                    <Check :size="14" />
                                                </button>
                                            </div>
                                            <div class="drawer-conv-tags">
                                                <span class="drawer-conv-tag"
                                                    >{{ conv.message_count }}条</span
                                                >
                                                <span
                                                    class="drawer-conv-tag drawer-conv-tag--tokens"
                                                    >{{ conv.total_tokens }} tokens</span
                                                >
                                                <span
                                                    v-if="conv.model"
                                                    class="drawer-conv-tag"
                                                    :class="
                                                        conv.model === 'deepseek-v4-pro'
                                                            ? 'drawer-conv-tag--pro'
                                                            : 'drawer-conv-tag--flash'
                                                    "
                                                    >{{
                                                        conv.model === 'deepseek-v4-pro'
                                                            ? '专家'
                                                            : '快速'
                                                    }}</span
                                                >
                                            </div>
                                        </div>
                                        <div class="drawer-conv-actions">
                                            <button
                                                class="drawer-conv-edit"
                                                title="修改标题"
                                                @click.stop="startEditConv(conv)"
                                            >
                                                <Pencil :size="13" />
                                            </button>
                                            <button
                                                class="drawer-conv-del"
                                                title="删除"
                                                @click.stop="onDeleteConv(conv.id)"
                                            >
                                                <Trash2 :size="14" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    v-if="agentStore.nextConversationCursor"
                                    class="drawer-load-more"
                                    :disabled="agentStore.loadingMoreConversations"
                                    @click="agentStore.loadMoreConversations()"
                                >
                                    {{
                                        agentStore.loadingMoreConversations
                                            ? '正在加载…'
                                            : '加载更多对话'
                                    }}
                                </button>
                                <div v-if="!agentStore.conversations.length" class="drawer-empty">
                                    暂无历史对话
                                </div>
                            </template>
                        </div>
                    </aside>
                </div>
            </Transition>
        </Teleport>

        <!-- 微信扫码连接 -->
        <BbModal
            :visible="showWechatDialog"
            title="连接微信"
            width="360px"
            @update:visible="updateWechatDialogVisible"
        >
            <div class="wechat-connect">
                <div v-if="wechatPhase === 'connecting'" class="wechat-connect__pending">
                    <span class="wechat-connect__spinner" />
                    <span>正在获取二维码…</span>
                </div>
                <template v-else-if="wechatPhase === 'awaiting_scan' || wechatPhase === 'scanned'">
                    <div class="wechat-connect__qr-frame">
                        <img
                            v-if="agentStore.wechatStatus?.qrCodeDataUrl"
                            class="wechat-connect__qr"
                            :src="agentStore.wechatStatus.qrCodeDataUrl"
                            alt="微信连接二维码"
                        />
                    </div>
                    <strong class="wechat-connect__title">
                        {{ wechatPhase === 'scanned' ? '已扫码，请在微信中确认' : '使用微信扫码' }}
                    </strong>
                </template>
                <div v-else-if="wechatPhase === 'error'" class="wechat-connect__error">
                    <span>{{ agentStore.wechatStatus?.error || '微信连接失败' }}</span>
                    <button class="bb-btn bb-btn-primary bb-btn-sm" @click="connectWechat">
                        重新连接
                    </button>
                </div>
            </div>
            <template v-if="isWechatConnecting" #footer>
                <button class="bb-btn" @click="cancelWechatConnection">取消连接</button>
            </template>
        </BbModal>

        <!-- 创建自定义 Skill 弹窗 -->
        <BbModal
            :visible="showCreateSkill"
            title="创建自定义 Skill"
            width="520px"
            @update:visible="showCreateSkill = $event"
        >
            <div class="create-skill-form">
                <div class="create-skill-field">
                    <label class="create-skill-label">标识名称（英文）</label>
                    <input
                        v-model="createSkillName"
                        class="bb-input"
                        placeholder="如 my-skill"
                        maxlength="50"
                    />
                    <p class="create-skill-hint">只能包含小写字母、数字和连字符</p>
                </div>
                <div class="create-skill-field">
                    <label class="create-skill-label">显示名称</label>
                    <input
                        v-model="createSkillDisplayName"
                        class="bb-input"
                        placeholder="如 我的技能"
                        maxlength="50"
                    />
                </div>
                <div class="create-skill-field">
                    <label class="create-skill-label">描述</label>
                    <input
                        v-model="createSkillDesc"
                        class="bb-input"
                        placeholder="简要描述这个 Skill 的功能"
                        maxlength="200"
                    />
                </div>
                <div class="create-skill-field">
                    <label class="create-skill-label">指令（Markdown）</label>
                    <textarea
                        v-model="createSkillMarkdown"
                        class="create-skill-textarea"
                        placeholder="编写 Skill 的完整指令，告诉 AI 如何使用现有工具完成特定任务"
                        rows="8"
                    />
                </div>
            </div>
            <template #footer>
                <button class="bb-btn" @click="showCreateSkill = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="creatingSkill"
                    @click="onSubmitSkill"
                >
                    {{ creatingSkill ? '创建中…' : '创建' }}
                </button>
            </template>
        </BbModal>

        <!-- MCP 服务配置弹窗 -->
        <BbModal
            :visible="showMcpEditor"
            :title="editingMcpName ? '编辑 MCP 服务' : '新增 MCP 服务'"
            width="520px"
            @update:visible="showMcpEditor = $event"
        >
            <div class="create-skill-form">
                <div class="create-skill-field">
                    <label class="create-skill-label">服务名称</label>
                    <input
                        v-model="mcpForm.name"
                        class="bb-input"
                        placeholder="如 exa"
                        maxlength="50"
                        :disabled="editingMcpIsDefault"
                    />
                    <p class="create-skill-hint">
                        {{
                            editingMcpIsDefault
                                ? '系统默认服务名称不可修改'
                                : '用于区分工具来源，可使用字母、数字、下划线和连字符'
                        }}
                    </p>
                </div>
                <div class="create-skill-field">
                    <label class="create-skill-label">服务地址</label>
                    <input
                        v-model="mcpForm.url"
                        class="bb-input"
                        placeholder="https://example.com/mcp"
                    />
                </div>
                <div class="create-skill-field">
                    <label class="create-skill-label">HTTP 请求头（JSON）</label>
                    <textarea
                        v-model="mcpForm.headersText"
                        class="create-skill-textarea create-skill-textarea--compact"
                        placeholder='{ "Authorization": "Bearer ..." }'
                        rows="5"
                    />
                    <p class="create-skill-hint">无需鉴权时保留为空对象</p>
                </div>
                <div class="mcp-enabled-row">
                    <div>
                        <div class="create-skill-label">启用服务</div>
                        <p class="create-skill-hint">启用后，小笔可在对话中调用该服务的工具</p>
                    </div>
                    <BbSwitch v-model="mcpForm.enabled" />
                </div>
            </div>
            <template #footer>
                <button class="bb-btn" @click="showMcpEditor = false">取消</button>
                <button
                    class="bb-btn bb-btn-primary"
                    :disabled="savingMcpServer"
                    @click="onSubmitMcpServer"
                >
                    {{ savingMcpServer ? '保存中…' : '保存' }}
                </button>
            </template>
        </BbModal>

        <!-- 危险操作确认弹窗 -->
        <BbModal
            :visible="!!agentStore.pendingConfirmation"
            :title="agentStore.pendingConfirmation?.detail.title || '确认操作'"
            width="480px"
            @update:visible="onCloseConfirm"
        >
            <div class="bb-confirm-body">
                <p class="bb-confirm-desc">
                    {{ agentStore.pendingConfirmation?.detail.description }}
                </p>
                <pre
                    v-if="agentStore.pendingConfirmation?.detail.command"
                    class="bb-confirm-code"
                    >{{ agentStore.pendingConfirmation?.detail.command }}</pre>
                <pre
                    v-if="agentStore.pendingConfirmation?.detail.filePath"
                    class="bb-confirm-code"
                    >{{ agentStore.pendingConfirmation?.detail.filePath }}</pre>
            </div>
            <template #footer>
                <button class="bb-btn" @click="agentStore.confirmTool(false)">拒绝</button>
                <button class="bb-btn bb-btn-primary" @click="agentStore.confirmTool(true)">
                    确认执行
                </button>
            </template>
        </BbModal>
    </div>
</template>

<script setup lang="ts">
/**
 * 智能体对话页面 -- 小笔主页
 * 空状态居中英雄区引导交互，对话开始后输入框停靠底部
 * 右侧速览面板可折叠，所有技能/工具/对话抽屉保持不变
 * @author xiangwei
 */

import { ref, reactive, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useAgentStore } from '../stores/agent.store'
import { useUserStore } from '../stores/user.store'
import AgentMessage from '../components/AgentMessage.vue'
import ContextPanel from '../components/ContextPanel.vue'
import { BbModal, BbPopconfirm, BbSwitch, Message } from '../components/ui'
import {
    Plus,
    X,
    ChevronLeft,
    ChevronDown,
    Trash2,
    Check,
    Puzzle,
    Zap,
    MessageCircle,
    ArrowUp,
    BrainCircuit,
    Gem,
    Mic,
    Pencil,
    RefreshCw,
    Server,
    Square,
    CornerDownRight,
    QrCode,
    Unplug,
    BarChart3,
    ReceiptText,
    PiggyBank,
    PanelRight,
    History,
    ShieldCheck,
    ShieldOff
} from '@lucide/vue'
import { desktopApi } from '../api/desktop-api'
import type { McpServerConfig, SkillDetail, SttProgressEvent } from '@shared/types'
import type { AgentMsg } from '../stores/agent.store'

const STT_SAMPLE_RATE = 16_000
const STT_AUDIO_MIME_TYPE = 'audio/webm;codecs=opus'

const agentStore = useAgentStore()
const userStore = useUserStore()
const inputMessage = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)

type PanelType = 'skills' | 'tools' | 'convs'
const activePanel = ref<PanelType | null>(null)
const skillDetailTarget = ref<SkillDetail | null>(null)
const toolsLoading = ref(false)
const inspectingMcpNames = ref<string[]>([])
/** 当前模式 */
const currentMode = ref<'fast' | 'expert'>('fast')
/** 根据当前模式展示对应模型能力的小标题 */
const modeSubtitle = computed(() => {
    return currentMode.value === 'fast'
        ? '快速模式：轻量快速，适合日常记账、简单查账和快速问答'
        : '专家模式：深度推理，擅长复杂分析、多步计算和详细报表'
})
/** 一键回到底部按钮显示状态 */
const showScrollBtn = ref(false)
const showWechatDialog = ref(false)
/** 右侧速览面板展开状态，null 表示尚未从设置恢复，避免关闭时闪烁 */
const showContextPanel = ref<boolean | null>(null)
const CONTEXT_PANEL_SETTING_KEY = 'agent_context_panel_visible'
let shouldStickToBottom = true
let loadingOlderMessages = false

/** 是否已有消息（控制空状态与对话态切换） */
const hasMessages = computed(() => agentStore.messages.length > 0)

/** 根据当前时间生成问候语 */
const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    return '晚上好'
})

/** 当前用户名称，缺失时回退到首字母 */
const userName = computed(() => userStore.currentUser?.name || userStore.userInitial)

/** 语音输入状态 */
const isRecording = ref(false)
const isTranscribing = ref(false)
const isModelStarting = ref(false)
const sttEnabled = ref(false)
/** 模型启动或语音识别进度 */
const modelProgress = ref<{ pct: number; file: string } | null>(null)
/** 录音相关 */
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let pendingRecordingStart = false
let viewMounted = false
/** 进度事件监听清理函数 */
let cleanupTranscribeProgress: (() => void) | null = null

/**
 * 停止当前录音并释放麦克风
 *
 * @author xiangwei
 */
function stopRecording(): void {
    const recorder = mediaRecorder
    if (!recorder) return

    isRecording.value = false
    if (recorder.state !== 'inactive') recorder.stop()
    recorder.stream.getTracks().forEach((track) => track.stop())
}

/**
 * 将录音内容转换并提交语音识别
 *
 * @author xiangwei
 */
async function transcribeRecordedAudio(): Promise<void> {
    const chunks = audioChunks
    audioChunks = []
    if (chunks.length === 0) return

    isTranscribing.value = true
    modelProgress.value = { pct: 0, file: '' }
    try {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        const pcmBuffer = await convertTo16kHzMono(audioBlob)
        const result = await desktopApi.agent.transcribeAudio(pcmBuffer)
        if (!viewMounted) return

        if (result.ok) {
            const text = result.data || ''
            if (inputMessage.value && text) {
                inputMessage.value += ' ' + text
            } else {
                inputMessage.value = text
            }
            await nextTick()
            inputRef.value?.dispatchEvent(new Event('input'))
            inputRef.value?.focus()
        } else {
            Message.warning(result.error || '语音识别失败')
        }
    } catch (error: unknown) {
        if (viewMounted) {
            const message = error instanceof Error ? error.message : '语音识别失败'
            Message.warning(message)
        }
    } finally {
        isTranscribing.value = false
        modelProgress.value = null
    }
}

/**
 * 获取麦克风并开始录音
 *
 * @author xiangwei
 */
async function startRecording(): Promise<void> {
    if (!viewMounted || isRecording.value || isTranscribing.value) return

    let stream: MediaStream | null = null
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: STT_SAMPLE_RATE,
                echoCancellation: true,
                noiseSuppression: true
            }
        })
        if (!viewMounted) {
            stream.getTracks().forEach((track) => track.stop())
            return
        }

        audioChunks = []
        const recorder = MediaRecorder.isTypeSupported(STT_AUDIO_MIME_TYPE)
            ? new MediaRecorder(stream, { mimeType: STT_AUDIO_MIME_TYPE })
            : new MediaRecorder(stream)
        mediaRecorder = recorder
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data)
        }
        recorder.onstop = () => {
            mediaRecorder = null
            void transcribeRecordedAudio()
        }

        recorder.start()
        isRecording.value = true
    } catch (error: unknown) {
        stream?.getTracks().forEach((track) => track.stop())
        const message = error instanceof Error ? error.message : '无法访问麦克风'
        Message.warning(message)
    }
}

/**
 * 处理模型启动和语音识别进度
 *
 * @param event STT 进度事件
 * @author xiangwei
 */
function handleTranscribeProgress(event: SttProgressEvent): void {
    if (event.status === 'error') {
        const shouldNotify = pendingRecordingStart || isModelStarting.value
        pendingRecordingStart = false
        isModelStarting.value = false
        modelProgress.value = null
        if (shouldNotify && viewMounted) {
            Message.warning(event.error || '语音模型启动失败')
        }
        return
    }

    if (event.status === 'ready') {
        const shouldStartRecording = pendingRecordingStart && viewMounted
        pendingRecordingStart = false
        isModelStarting.value = false
        modelProgress.value = null
        if (shouldStartRecording) void startRecording()
        return
    }

    if (isTranscribing.value && event.status === 'progress') {
        modelProgress.value = {
            pct: event.progress === -1 ? 100 : Math.max(0, event.progress ?? 0),
            file: event.file || ''
        }
        return
    }

    if (!pendingRecordingStart) return

    if (event.status === 'initiate' || event.status === 'download' || event.status === 'progress') {
        isModelStarting.value = true
        modelProgress.value = {
            pct: Math.max(0, event.progress ?? 0),
            file: event.file || ''
        }
    }
}

/**
 * 切换录音状态，模型启动完成后自动开始录音
 *
 * @author xiangwei
 */
async function toggleRecording(): Promise<void> {
    if (isRecording.value) {
        stopRecording()
        return
    }
    if (isModelStarting.value || isTranscribing.value) return

    pendingRecordingStart = true
    isModelStarting.value = true
    modelProgress.value = { pct: 0, file: '' }

    try {
        const statusResult = await desktopApi.agent.sttModelStatus()
        if (!pendingRecordingStart || !viewMounted) return

        if (!statusResult.ok) {
            pendingRecordingStart = false
            isModelStarting.value = false
            modelProgress.value = null
            Message.warning(statusResult.error || '查询语音模型状态失败')
            return
        }

        if (statusResult.data.status === 'loading') return
        if (statusResult.data.status === 'ready') {
            pendingRecordingStart = false
            isModelStarting.value = false
            modelProgress.value = null
            await startRecording()
            return
        }

        pendingRecordingStart = false
        isModelStarting.value = false
        modelProgress.value = null
        Message.warning(statusResult.data.error || '语音模型未就绪，请前往设置页面下载模型')
    } catch (error: unknown) {
        if (viewMounted) {
            const message = error instanceof Error ? error.message : '查询语音模型状态失败'
            Message.warning(message)
        }
        pendingRecordingStart = false
        isModelStarting.value = false
        modelProgress.value = null
    }
}

/**
 * 清理页面持有的语音资源
 *
 * @author xiangwei
 */
function cleanupSttResources(): void {
    pendingRecordingStart = false
    isModelStarting.value = false
    cleanupTranscribeProgress?.()
    cleanupTranscribeProgress = null

    const recorder = mediaRecorder
    if (recorder) {
        recorder.onstop = null
        if (recorder.state !== 'inactive') recorder.stop()
        recorder.stream.getTracks().forEach((track) => track.stop())
        mediaRecorder = null
        isRecording.value = false
        audioChunks = []
    }
}

/**
 * 将 webm 音频 Blob 转换为 16kHz 单声道 PCM ArrayBuffer
 * @param blob webm 音频 Blob
 * @returns Float32Array 的底层 ArrayBuffer（16kHz 单声道）
 * @author xiangwei
 */
async function convertTo16kHzMono(blob: Blob): Promise<ArrayBuffer> {
    const audioCtx = new AudioContext()
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    // 取第一个声道
    const channelData = audioBuffer.getChannelData(0)
    const sourceRate = audioBuffer.sampleRate
    const targetRate = STT_SAMPLE_RATE

    // 重采样到 16kHz
    if (sourceRate === targetRate) {
        const copy = new Float32Array(channelData)
        return copy.buffer as ArrayBuffer
    }

    const ratio = sourceRate / targetRate
    const newLength = Math.round(channelData.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
        const srcIndex = Math.round(i * ratio)
        result[i] = channelData[Math.min(srcIndex, channelData.length - 1)]
    }

    return result.buffer as ArrayBuffer
}

/** 编辑会话标题 */
const editingConvId = ref<string | null>(null)
const editingTitle = ref('')

/** 创建自定义 Skill 表单 */
const showCreateSkill = ref(false)
const createSkillName = ref('')
const createSkillDisplayName = ref('')
const createSkillDesc = ref('')
const createSkillMarkdown = ref('')
const creatingSkill = ref(false)

/** MCP 服务编辑表单 */
const showMcpEditor = ref(false)
const editingMcpName = ref<string | null>(null)
const editingMcpIsDefault = ref(false)
const savingMcpServer = ref(false)
const mcpForm = reactive({
    name: '',
    url: '',
    headersText: '{}',
    enabled: true
})

function startEditConv(conv: { id: string; title: string }): void {
    editingConvId.value = conv.id
    editingTitle.value = conv.title
    nextTick(() => {
        const input = document.querySelector('.drawer-conv-title-input') as HTMLInputElement
        if (input) input.select()
    })
}

async function saveEditConv(id: string): Promise<void> {
    if (!editingTitle.value.trim()) {
        editingConvId.value = null
        return
    }
    await agentStore.renameConversation(id, editingTitle.value.trim())
    editingConvId.value = null
}

const TOOL_CN_MAP: Record<string, string> = {
    queryTransactions: '流水查询',
    queryRecentTransactions: '最近流水',
    queryAccountBalance: '账户余额',
    queryMonthlySummary: '月度汇总',
    queryYearlySummary: '年度汇总',
    queryCategorySummary: '分类统计',
    queryBudgetProgress: '预算进度',
    evaluate: '表达式计算',
    summarize: '数据汇总',
    compareValues: '数值对比',
    convertCentsToYuan: '单位换算',
    analyzeTrend: '趋势分析',
    detectAnomalies: '异常检测',
    comparePeriods: '周期对比',
    createTransaction: '记账',
    deleteTransaction: '删除流水',
    queryAllAccounts: '账户列表',
    queryAllCategories: '分类列表',
    getSkill: '加载 Skill',
    readLocalMemory: '读取本地记忆',
    writeLocalMemory: '写入本地记忆',
    createAgentTasks: '创建任务清单',
    updateAgentTaskStatus: '更新任务状态',
    queryAgentTasks: '查询任务进度',
    clearAgentTasks: '清空任务清单',
    createUserTodo: '创建待办',
    deleteUserTodo: '删除待办',
    queryUserTodos: '查询待办',
    updateUserTodo: '修改待办',
    executeCommand: '执行命令',
    editFile: '编辑文件'
}
function toolDisplayName(name: string): string {
    return TOOL_CN_MAP[name] || name
}

const enabledSkillCount = computed(() => agentStore.skills.filter((s) => s.isEnabled).length)
const totalToolCount = computed(() => {
    const mcpCount = Object.values(agentStore.mcpConnectionResults).reduce(
        (sum, result) => sum + result.tools.length,
        0
    )
    return agentStore.localTools.length + mcpCount
})
const wechatPhase = computed(() => agentStore.wechatStatus?.phase || 'disconnected')
const isWechatConnecting = computed(() =>
    ['connecting', 'awaiting_scan', 'scanned'].includes(wechatPhase.value)
)
const sortedConvs = computed(() =>
    [...agentStore.conversations].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
)
const panelTitle = computed(() => {
    switch (activePanel.value) {
        case 'skills':
            return skillDetailTarget.value ? skillDetailTarget.value.meta.displayName : 'Skill 管理'
        case 'tools':
            return `工具 / MCP（${totalToolCount.value}）`
        case 'convs':
            return `历史对话（${agentStore.conversations.length}）`
        default:
            return ''
    }
})

/** 合并连续 tool 消息为分组展示 */
const displayMessages = computed(() => {
    const src = agentStore.messages
    const out: Array<
        | AgentMsg
        | { role: 'tool-group'; tools: AgentMsg[]; id: string; content: string; toolName: string }
    > = []
    for (let i = 0; i < src.length; i++) {
        const m = src[i]
        if (m.role !== 'tool') {
            out.push(m)
            continue
        }
        // 收集连续的 tool 消息
        const tools: AgentMsg[] = [m]
        while (i + 1 < src.length && src[i + 1].role === 'tool') {
            tools.push(src[++i])
        }
        if (tools.length === 1) {
            out.push(m)
        } else {
            const names = [...new Set(tools.map((t) => t.toolName || '工具').filter(Boolean))]
            out.push({
                role: 'tool-group',
                id: m.id,
                tools,
                content: `调用 ${names.join('、')}`,
                toolName: names.join(' · ')
            } as (typeof out)[number])
        }
    }
    return out
})

function togglePanel(panel: PanelType): void {
    if (activePanel.value === panel) {
        closePanel()
        return
    }
    activePanel.value = panel
    skillDetailTarget.value = null
    if (panel === 'tools') loadTools()
}
function closePanel(): void {
    activePanel.value = null
    skillDetailTarget.value = null
}
function onNewConv(): void {
    if (agentStore.isProcessing) return
    closePanel()
    agentStore.newConversation()
}

/** 切换右侧速览面板展开状态 */
function toggleContextPanel(): void {
    if (showContextPanel.value === null) return
    showContextPanel.value = !showContextPanel.value
}

async function openSkillDetail(name: string): Promise<void> {
    const d = await agentStore.loadSkillDetail(name)
    if (d) skillDetailTarget.value = d
}
function onSkillToggle(name: string, enabled: boolean): void {
    agentStore.toggleSkill(name, enabled)
}
function onAddSkill(): void {
    createSkillName.value = ''
    createSkillDisplayName.value = ''
    createSkillDesc.value = ''
    createSkillMarkdown.value = ''
    showCreateSkill.value = true
}

async function onSubmitSkill(): Promise<void> {
    if (
        !createSkillName.value.trim() ||
        !createSkillDisplayName.value.trim() ||
        !createSkillDesc.value.trim() ||
        !createSkillMarkdown.value.trim()
    ) {
        Message.warning('请填写完整信息')
        return
    }
    creatingSkill.value = true
    const ok = await agentStore.createSkill({
        name: createSkillName.value.trim(),
        displayName: createSkillDisplayName.value.trim(),
        description: createSkillDesc.value.trim(),
        markdown: createSkillMarkdown.value.trim()
    })
    creatingSkill.value = false
    if (ok) {
        Message.success('Skill 创建成功')
        showCreateSkill.value = false
    } else {
        Message.error('创建失败，请检查名称是否已存在')
    }
}

async function onDeleteSkill(name: string): Promise<void> {
    const ok = await agentStore.deleteSkill(name)
    if (ok) {
        Message.success('已删除')
    } else {
        Message.error('删除失败')
    }
}

async function loadTools(force: boolean = false): Promise<void> {
    if (toolsLoading.value) return
    toolsLoading.value = true
    try {
        if (force) {
            await Promise.all([agentStore.refreshLocalTools(), agentStore.refreshMcpServers()])
        }
        const servers = agentStore.mcpServers.filter(
            (server) => server.enabled && (force || !agentStore.mcpConnectionResults[server.name])
        )
        await Promise.all(servers.map((server) => inspectMcpServer(server.name)))
    } finally {
        toolsLoading.value = false
    }
}

/**
 * 判断 MCP 服务是否正在检测连接
 *
 * @param name 服务名称
 * @returns 是否正在检测
 * @author xiangwei
 */
function isMcpInspecting(name: string): boolean {
    return inspectingMcpNames.value.includes(name)
}

/**
 * 检测 MCP 服务并发现工具
 *
 * @param name 服务名称
 * @author xiangwei
 */
async function inspectMcpServer(name: string, silent: boolean = false): Promise<void> {
    if (isMcpInspecting(name)) return
    inspectingMcpNames.value = [...inspectingMcpNames.value, name]
    const result = await agentStore.inspectMcpServer(name)
    inspectingMcpNames.value = inspectingMcpNames.value.filter((item) => item !== name)
    if (!result && !silent && !toolsLoading.value) Message.error('MCP 服务连接失败')
}

/**
 * 后台预检已启用的 MCP 服务，使顶栏工具数量在进入页面时即时准确
 *
 * @author xiangwei
 */
async function preInspectMcpServers(): Promise<void> {
    const servers = agentStore.mcpServers.filter(
        (server) => server.enabled && !agentStore.mcpConnectionResults[server.name]
    )
    await Promise.all(servers.map((server) => inspectMcpServer(server.name, true)))
}

/**
 * 获取 MCP 服务状态文案
 *
 * @param server MCP 服务配置
 * @returns 状态文案
 * @author xiangwei
 */
function getMcpStatusText(server: McpServerConfig): string {
    if (!server.enabled) return '已停用，不会加入 AI 工具列表'
    if (isMcpInspecting(server.name)) return '正在连接并发现工具…'
    const error = agentStore.mcpConnectionErrors[server.name]
    if (error) return error
    const connection = agentStore.mcpConnectionResults[server.name]
    if (!connection) return '等待连接检测'
    const version = connection.serverVersion ? ` · v${connection.serverVersion}` : ''
    return `已连接 · ${connection.tools.length} 个工具${version}`
}

/**
 * 打开新增 MCP 服务弹窗
 *
 * @author xiangwei
 */
function onAddMcpServer(): void {
    editingMcpName.value = null
    editingMcpIsDefault.value = false
    Object.assign(mcpForm, {
        name: '',
        url: '',
        headersText: '{}',
        enabled: true
    })
    showMcpEditor.value = true
}

/**
 * 打开 MCP 服务编辑弹窗
 *
 * @param server MCP 服务配置
 * @author xiangwei
 */
function onEditMcpServer(server: McpServerConfig): void {
    editingMcpName.value = server.name
    editingMcpIsDefault.value = server.isDefault
    Object.assign(mcpForm, {
        name: server.name,
        url: server.url,
        headersText: JSON.stringify(server.headers, null, 2),
        enabled: server.enabled
    })
    showMcpEditor.value = true
}

/**
 * 解析 MCP 请求头 JSON
 *
 * @returns 请求头对象，格式错误时返回 null
 * @author xiangwei
 */
function parseMcpHeaders(): Record<string, string> | null {
    try {
        const parsed = JSON.parse(mcpForm.headersText || '{}') as unknown
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null
        const entries = Object.entries(parsed)
        if (entries.some(([key, value]) => !key.trim() || typeof value !== 'string')) return null
        return Object.fromEntries(entries) as Record<string, string>
    } catch {
        return null
    }
}

/**
 * 保存 MCP 服务配置
 *
 * @author xiangwei
 */
async function onSubmitMcpServer(): Promise<void> {
    const name = mcpForm.name.trim()
    const url = mcpForm.url.trim()
    if (!name || !url) {
        Message.warning('请填写服务名称和地址')
        return
    }
    const headers = parseMcpHeaders()
    if (!headers) {
        Message.warning('HTTP 请求头必须是字符串键值组成的 JSON 对象')
        return
    }
    savingMcpServer.value = true
    const ok = await agentStore.saveMcpServer({
        previousName: editingMcpName.value ?? undefined,
        name,
        url,
        headers,
        enabled: mcpForm.enabled
    })
    savingMcpServer.value = false
    if (!ok) {
        Message.error('MCP 服务保存失败，请检查名称和地址')
        return
    }
    showMcpEditor.value = false
    Message.success('MCP 服务已保存')
    if (mcpForm.enabled) await inspectMcpServer(name)
}

/**
 * 删除 MCP 服务
 *
 * @param name 服务名称
 * @author xiangwei
 */
async function onDeleteMcpServer(name: string): Promise<void> {
    if (await agentStore.deleteMcpServer(name)) {
        Message.success('MCP 服务已删除')
    } else {
        Message.error('MCP 服务删除失败')
    }
}

/**
 * 更新 MCP 服务启用状态
 *
 * @param name 服务名称
 * @param enabled 是否启用
 * @author xiangwei
 */
async function onMcpToggle(name: string, enabled: boolean): Promise<void> {
    if (!(await agentStore.toggleMcpServer(name, enabled))) {
        Message.error('MCP 服务状态保存失败')
        return
    }
    if (enabled) await inspectMcpServer(name)
}

async function onSelectConv(id: string): Promise<void> {
    if (agentStore.isProcessing) {
        Message.warning('当前回复完成后才能切换对话')
        return
    }
    closePanel()
    if (await agentStore.loadConversation(id)) {
        await scrollToBottom()
    }
}

/**
 * 发起微信扫码连接并打开二维码弹窗
 *
 * @author xiangwei
 */
async function connectWechat(): Promise<void> {
    showWechatDialog.value = true
    if (!(await agentStore.connectWechat())) {
        showWechatDialog.value = false
        Message.error('微信连接失败，请重试')
    }
}

/**
 * 取消正在进行的微信扫码连接
 *
 * @author xiangwei
 */
async function cancelWechatConnection(): Promise<void> {
    await agentStore.disconnectWechat()
    showWechatDialog.value = false
}

/**
 * 断开已连接的微信渠道
 *
 * @author xiangwei
 */
async function disconnectWechat(): Promise<void> {
    if (await agentStore.disconnectWechat()) {
        Message.success('微信已断开')
    } else {
        Message.error('断开微信失败')
    }
}

/**
 * 进入微信专属会话
 *
 * @author xiangwei
 */
async function openWechatConversation(): Promise<void> {
    const conversationId = agentStore.wechatStatus?.conversationId
    if (!conversationId || conversationId === agentStore.currentConversationId) return
    await agentStore.loadConversation(conversationId)
}

/**
 * 更新微信二维码弹窗状态，关闭待扫码弹窗时同步取消连接
 *
 * @param visible 是否显示
 * @author xiangwei
 */
function updateWechatDialogVisible(visible: boolean): void {
    showWechatDialog.value = visible
    if (!visible && isWechatConnecting.value) void agentStore.disconnectWechat()
}
async function onDeleteConv(id: string): Promise<void> {
    await agentStore.deleteConversation(id)
}

/** 切换快速/专家模式（同步更新模型配置） */
async function switchMode(mode: string): Promise<void> {
    if (mode !== 'fast' && mode !== 'expert') return
    currentMode.value = mode
    await agentStore.saveConfig({
        model: mode === 'fast' ? 'deepseek-v4-flash' : 'deepseek-v4-pro'
    })
}

async function send(): Promise<void> {
    const msg = inputMessage.value.trim()
    if (!msg) return
    inputMessage.value = ''
    if (inputRef.value) inputRef.value.style.height = 'auto'
    if (agentStore.isProcessing) {
        agentStore.enqueueMessage(msg)
        await nextTick()
        inputRef.value?.focus()
        return
    }
    await agentStore.sendMessage(msg)
    await scrollToBottom()
}

/** 编辑用户消息：将消息内容回填到输入框 */
function handleEditMessage(messageId: string): void {
    const msg = agentStore.findMessageById(messageId)
    if (msg && msg.role === 'user') {
        inputMessage.value = msg.content
        inputRef.value?.focus()
    }
}

/** Ctrl+A 仅在消息区内全选，避免选中页面其他文字 */
function handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        const el = messagesRef.value
        if (el && el.contains(document.activeElement)) {
            event.preventDefault()
            const range = document.createRange()
            range.selectNodeContents(el)
            const selection = window.getSelection()
            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }
    }
}

/**
 * 停止当前智能体回答
 * @author xiangwei
 */
async function stopResponse(): Promise<void> {
    if (!(await agentStore.stopResponse())) {
        Message.error('停止回答失败，请重试')
    }
}

/**
 * 使用队列消息打断并引导当前回答
 *
 * @param id 队列消息 ID
 * @author xiangwei
 */
async function guideQueuedMessage(id: string): Promise<void> {
    if (!(await agentStore.guideQueuedMessage(id))) {
        Message.error('引导消息发送失败，请重试')
    }
}
function autoResize(e: Event): void {
    const ta = e.target as HTMLTextAreaElement
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
}
async function askQuickQuestion(text: string): Promise<void> {
    if (agentStore.isProcessing) return
    inputMessage.value = text
    await send()
}

/**
 * 空状态快捷操作卡片点击处理
 *
 * @param action 操作类型：record 记一笔 / query 查账单 / report 出报表 / budget 看预算
 * @author xiangwei
 */
function onQuickAction(action: 'record' | 'query' | 'report' | 'budget'): void {
    if (agentStore.isProcessing) return
    switch (action) {
        case 'record':
            // 记一笔：填入前缀并聚焦输入框，等待用户补充详情后发送
            inputMessage.value = '记一笔：'
            nextTick(() => inputRef.value?.focus())
            break
        case 'query':
            void askQuickQuestion('我这个月花了多少钱？')
            break
        case 'report':
            void askQuickQuestion('生成本月消费报表')
            break
        case 'budget':
            void askQuickQuestion('预算执行情况如何？')
            break
    }
}

async function scrollToBottom(): Promise<void> {
    await nextTick()
    if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
    shouldStickToBottom = true
    showScrollBtn.value = false
}

/**
 * 加载更早消息并保持用户当前看到的消息位置
 *
 * @author xiangwei
 */
async function loadOlderAndPreserve(): Promise<void> {
    const element = messagesRef.value
    if (!element || loadingOlderMessages || !agentStore.nextMessageCursor) return

    loadingOlderMessages = true
    const previousHeight = element.scrollHeight
    const previousTop = element.scrollTop
    const addedCount = await agentStore.loadOlderMessages()
    await nextTick()
    if (addedCount > 0 && messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight - previousHeight + previousTop
    }
    loadingOlderMessages = false
}

/** 关闭确认弹窗视为拒绝 */
function onCloseConfirm(): void {
    if (agentStore.pendingConfirmation) {
        agentStore.confirmTool(false)
    }
}

function onMessagesScroll(): void {
    if (!messagesRef.value) return
    const el = messagesRef.value
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldStickToBottom = dist <= 80
    showScrollBtn.value = dist > 80
    if (el.scrollTop < 64) void loadOlderAndPreserve()
}

watch(
    () => {
        const lastMessage = agentStore.messages.at(-1)
        return [agentStore.messages.length, lastMessage?.content, agentStore.isProcessing]
    },
    async () => {
        if (shouldStickToBottom) await scrollToBottom()
    }
)

watch(wechatPhase, (phase) => {
    if (phase === 'awaiting_scan' || phase === 'scanned') showWechatDialog.value = true
    if (phase === 'connected') showWechatDialog.value = false
})

onMounted(async () => {
    viewMounted = true
    await agentStore.initialize()
    if (!viewMounted) return
    // 恢复上次打开的会话
    await agentStore.restoreLastConversation()
    if (!viewMounted) return
    // 后台预检已启用的 MCP 服务，使顶栏工具数量在进入页面时即时准确
    void preInspectMcpServers()
    // 从当前配置同步模式
    if (agentStore.config.model === 'deepseek-v4-pro') {
        currentMode.value = 'expert'
    } else {
        currentMode.value = 'fast'
    }
    // 读取 STT 功能开关
    const sttResult = await desktopApi.setting.get<boolean>('stt_enabled', false)
    if (!viewMounted) return
    if (sttResult.ok && viewMounted) {
        sttEnabled.value = sttResult.data === true
        if (sttEnabled.value) {
            cleanupTranscribeProgress =
                desktopApi.agent.onTranscribeProgress(handleTranscribeProgress)
        }
    }
    // 读取右侧速览面板展开状态
    const panelResult = await desktopApi.setting.get<boolean>(CONTEXT_PANEL_SETTING_KEY, true)
    if (panelResult.ok && viewMounted) {
        showContextPanel.value = panelResult.data === true
    }
    // 监听滚动以控制回底按钮
    messagesRef.value?.addEventListener('scroll', onMessagesScroll)
    if (agentStore.messages.length) await scrollToBottom()
})

// 速览面板展开状态持久化（初始 null 时不保存）
watch(showContextPanel, (visible) => {
    if (visible === null) return
    void desktopApi.setting.set(CONTEXT_PANEL_SETTING_KEY, visible)
})

onUnmounted(() => {
    viewMounted = false
    messagesRef.value?.removeEventListener('scroll', onMessagesScroll)
    cleanupSttResources()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════
   智能体主页 - 小笔主场布局
   ═══════════════════════════════════════════ */

.agent-home {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

/* 右侧速览面板显隐动画 */
.context-panel-enter-active,
.context-panel-leave-active {
    transition:
        transform 0.25s var(--bb-ease),
        opacity 0.25s var(--bb-ease);
}
.context-panel-enter-from,
.context-panel-leave-to {
    transform: translateX(20px);
    opacity: 0;
}

.agent-chat-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* ===== 有消息时的简约顶栏 ===== */
.agent-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    border-bottom: 1px solid var(--bb-border-light);
    background: var(--bb-glass-bg);
    gap: 8px;
    flex-shrink: 0;
}
.agent-bar__left {
    display: flex;
    align-items: center;
    gap: 4px;
}
.agent-bar__tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
    white-space: nowrap;
    font-family: var(--bb-font);
}
.agent-bar__tab:hover {
    color: var(--bb-text-primary);
    background: var(--bb-bg-hover);
}
.agent-bar__tab.active {
    color: var(--bb-accent-text);
    background: var(--bb-bg-elevated);
    box-shadow: var(--bb-shadow-sm);
}
.agent-bar__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--bb-accent);
    color: #fff;
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
    line-height: 1;
}
.agent-bar__right {
    display: flex;
    align-items: center;
    gap: 6px;
}
.agent-bar__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: var(--bb-accent-soft);
    color: var(--bb-accent-text);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.agent-bar__toggle:hover {
    background: var(--bb-accent-light);
}
.agent-bar__toggle--off {
    background: transparent;
    color: var(--bb-text-tertiary);
}
.agent-bar__new {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.agent-bar__new:hover {
    background: var(--bb-accent-soft);
    color: var(--bb-accent);
}
.agent-bar__new:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

/* ===== 消息区 ===== */
.agent-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    min-height: 0;
    position: relative;
}
.agent-scroll-area--empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    padding: 0;
}
.agent-scroll-area--empty .agent-scroll-btn {
    display: none;
}

/* 空状态英雄区 */
.agent-empty-hero {
    width: 100%;
    max-width: 900px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
    padding: 0 20px;
}
.empty-hero__logo {
    display: flex;
    align-items: center;
    justify-content: center;
}
.empty-hero__img {
    width: 60px;
    height: 60px;
    object-fit: contain;
    transition: transform var(--bb-duration) var(--bb-ease-spring);
    -webkit-user-drag: none;
    user-select: none;
}
.empty-hero__logo:hover .empty-hero__img {
    transform: rotate(-8deg) scale(1.05);
}
.empty-hero__greeting {
    font-size: 26px;
    font-weight: var(--bb-weight-bold);
    color: var(--bb-text-primary);
    letter-spacing: -0.02em;
    margin: 0;
}
.empty-hero__subtitle {
    font-size: 14px;
    color: var(--bb-text-secondary);
    line-height: 1.6;
    margin: 0;
}

/* 模式切换 */
.agent-mode-switch {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-input);
}
.agent-mode-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 16px;
    min-height: 30px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--bb-text-secondary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
    white-space: nowrap;
    font-family: var(--bb-font);
    line-height: 1.4;
}
.agent-mode-btn.active {
    background: var(--bb-bg-elevated);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
    box-shadow: var(--bb-shadow-sm);
}
.agent-mode-btn:hover:not(.active) {
    color: var(--bb-text-primary);
}

/* 状态区：微信与历史对话 */
.agent-status-area {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
}
.agent-wechat-bridge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.agent-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1px solid var(--bb-border);
    border-radius: 20px;
    background: var(--bb-bg-card);
    color: var(--bb-text-secondary);
    font-family: var(--bb-font);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.agent-status-chip:hover {
    border-color: var(--bb-accent);
    color: var(--bb-accent-text);
    background: var(--bb-accent-soft);
}
.agent-status-chip--success {
    border-color: rgba(22, 163, 74, 0.24);
    color: var(--bb-success);
    background: var(--bb-success-light);
}
.agent-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bb-success);
}
.agent-wechat-disconnect {
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--bb-border);
    border-radius: 50%;
    background: var(--bb-bg-card);
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.agent-wechat-disconnect:hover {
    border-color: var(--bb-danger);
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

/* 加载/错误/未配置状态 */
.agent-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px 24px 0;
    gap: 14px;
}
.agent-hero__desc {
    font-size: 14px;
    color: var(--bb-text-tertiary);
    line-height: 1.6;
}
.agent-page-loader {
    display: flex;
    gap: 5px;
    align-items: center;
    justify-content: center;
    min-height: 32px;
}
.agent-page-loader span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bb-accent);
    animation: dotBounce 1.2s ease-in-out infinite;
}
.agent-page-loader span:nth-child(2) {
    animation-delay: 0.15s;
}
.agent-page-loader span:nth-child(3) {
    animation-delay: 0.3s;
}
.agent-history-status {
    align-self: center;
    min-height: 28px;
    padding: 5px 12px;
    border: 0;
    background: transparent;
    color: var(--bb-text-tertiary);
    font-family: var(--bb-font);
    font-size: 12px;
}
.agent-history-status--error {
    cursor: pointer;
    color: var(--bb-danger);
}

/* 思考动画 */
.agent-thinking {
    display: flex;
    gap: 4px;
    padding: 12px 0 16px;
}
.agent-thinking span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--bb-accent);
    opacity: 0.3;
    animation: dotBounce 1.3s infinite ease-in-out;
}
.agent-thinking span:nth-child(2) {
    animation-delay: 0.2s;
}
.agent-thinking span:nth-child(3) {
    animation-delay: 0.4s;
}
@keyframes dotBounce {
    0%,
    80%,
    100% {
        opacity: 0.2;
        transform: scale(0.8);
    }
    40% {
        opacity: 1;
        transform: scale(1.2);
    }
}

/* 一键回到底部 */
.agent-scroll-btn {
    position: sticky;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 36px;
    border: 1px solid var(--bb-border);
    border-radius: 50%;
    background: var(--bb-bg-card);
    color: var(--bb-text-tertiary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--bb-shadow-md);
    transition:
        opacity 0.15s var(--bb-ease),
        box-shadow 0.15s var(--bb-ease);
    z-index: 10;
    opacity: 1;
    pointer-events: auto;
    flex-shrink: 0;
}
.agent-scroll-btn--hidden {
    opacity: 0;
    pointer-events: none;
}
.agent-scroll-btn:hover {
    border-color: var(--bb-accent);
    color: var(--bb-accent);
    box-shadow: var(--bb-shadow-lg);
}
.agent-scroll-btn:active {
    transform: translateX(-50%) scale(0.92);
}

/* ===== 输入区 ===== */
.agent-input-area {
    flex-shrink: 0;
    padding: 12px 24px 12px;
    background: var(--bb-bg-page);
}
.agent-input-area--empty {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 12px 20px 24px;
    background: transparent;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* 待发送消息队列 */
.agent-queue {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-bottom: 8px;
    overflow: hidden;
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    background: var(--bb-bg-card);
}
.agent-queue__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto 28px;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 3px 7px 3px 10px;
    border-top: 1px solid var(--bb-border-light);
}
.agent-queue__item:first-child {
    border-top: 0;
}
.agent-queue__index {
    color: var(--bb-accent-text);
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
    white-space: nowrap;
}
.agent-queue__content {
    min-width: 0;
    overflow: hidden;
    color: var(--bb-text-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.agent-queue__guide,
.agent-queue__delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    font-family: var(--bb-font);
}
.agent-queue__guide {
    gap: 4px;
    height: 28px;
    padding: 0 7px;
    border-radius: var(--bb-radius-sm);
    color: var(--bb-accent-text);
    font-size: 11px;
    font-weight: var(--bb-weight-medium);
}
.agent-queue__delete {
    width: 28px;
    height: 28px;
    border-radius: var(--bb-radius-sm);
}
.agent-queue__guide:hover {
    background: var(--bb-accent-soft);
}
.agent-queue__delete:hover {
    background: var(--bb-danger-light);
    color: var(--bb-danger);
}
.agent-queue__guide:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* 主输入卡片（DeepSeek 风格） */
.agent-input-card {
    display: flex;
    flex-direction: column;
    background: var(--bb-bg-card);
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-xl);
    padding: 14px 16px 10px;
    transition:
        border-color 0.15s var(--bb-ease),
        box-shadow 0.15s var(--bb-ease);
}
.agent-input-card:focus-within {
    border-color: var(--bb-accent);
    box-shadow:
        0 0 0 3px var(--bb-accent-soft),
        0 2px 12px rgba(0, 0, 0, 0.05);
}

.agent-textarea {
    border: none;
    resize: none;
    padding: 0;
    font-family: var(--bb-font);
    font-size: 15px;
    line-height: 1.7;
    color: var(--bb-text-primary);
    background: transparent;
    outline: none;
    overflow: hidden;
    min-height: 24px;
    max-height: 200px;
}
.agent-textarea::placeholder {
    color: var(--bb-text-disabled);
}
.agent-textarea:disabled {
    color: var(--bb-text-disabled);
}

/* 底部功能区 */
.agent-input-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--bb-border-light);
}
.agent-input-foot__left {
    display: flex;
    align-items: center;
    gap: 4px;
}
.agent-input-foot__right {
    display: flex;
    align-items: center;
    gap: 4px;
}

.agent-foot-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    font-weight: var(--bb-weight-medium);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
    font-family: var(--bb-font);
    white-space: nowrap;
}
.agent-foot-btn:hover {
    background: var(--bb-accent-soft);
    color: var(--bb-accent-text);
}
.agent-foot-btn:active {
    transform: scale(0.96);
}
.agent-foot-btn--active {
    background: var(--bb-accent-soft);
    color: var(--bb-accent-text);
}
.agent-foot-btn--danger {
    background: var(--bb-danger-light, rgba(239, 68, 68, 0.12));
    color: var(--bb-danger, #ef4444);
}
.agent-foot-btn--danger:hover {
    background: var(--bb-danger-light, rgba(239, 68, 68, 0.2));
    color: var(--bb-danger, #ef4444);
}
.agent-foot-btn:disabled {
    cursor: not-allowed;
}
.agent-foot-btn:disabled:hover {
    background: var(--bb-accent-soft);
    color: var(--bb-accent-text);
}

/* 麦克风录音按钮 */
.agent-mic-btn {
    position: relative;
    overflow: hidden;
}
.agent-mic-btn--recording {
    color: #e53e3e;
    background: rgba(229, 62, 62, 0.08);
    animation: micPulse 1.2s ease-in-out infinite;
}
.agent-mic-btn--recording:hover {
    background: rgba(229, 62, 62, 0.15);
    color: #c53030;
}
.agent-mic-btn--loading {
    color: var(--bb-accent);
    background: var(--bb-accent-soft);
    pointer-events: none;
}
.agent-mic-btn:disabled:not(.agent-mic-btn--recording) {
    opacity: 0.4;
    cursor: not-allowed;
}
.agent-mic-btn--loading:disabled {
    opacity: 1;
}
.agent-mic-label {
    font-size: 11px;
}
@keyframes micPulse {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.3);
    }
    50% {
        box-shadow: 0 0 0 6px rgba(229, 62, 62, 0);
    }
}

/* 模型下载进度条 */
.agent-mic-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--bb-border-light);
    border-radius: 1px;
    overflow: hidden;
}
.agent-mic-progress__bar {
    height: 100%;
    background: var(--bb-accent);
    border-radius: 1px;
    transition: width 0.3s var(--bb-ease);
}

.agent-input-send {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: var(--bb-accent);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s var(--bb-ease);
    flex-shrink: 0;
}
.agent-input-stop {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--bb-border);
    border-radius: 10px;
    background: var(--bb-bg-card);
    color: var(--bb-danger);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.agent-input-stop:hover {
    border-color: var(--bb-danger);
    background: var(--bb-danger-light);
}
.agent-input-stop:disabled {
    opacity: 0.45;
    cursor: wait;
}
.agent-input-send:hover {
    background: var(--bb-accent-hover);
}
.agent-input-send:active {
    transform: scale(0.92);
}
.agent-input-send:disabled {
    background: var(--bb-text-disabled);
    cursor: not-allowed;
    transform: none;
}

/* ===== 空状态快捷操作卡片 ===== */
.agent-quick-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}
.qa-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-lg);
    background: var(--bb-bg-card);
    cursor: pointer;
    transition:
        transform 0.2s var(--bb-ease),
        box-shadow 0.2s var(--bb-ease),
        border-color 0.2s var(--bb-ease);
    font-family: var(--bb-font);
    text-align: left;
}
.qa-card:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--bb-accent-lighter);
    box-shadow: var(--bb-shadow-sm);
}
.qa-card:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
.qa-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--bb-accent-soft);
    color: var(--bb-accent);
}
.qa-title {
    font-size: 14px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.qa-desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    line-height: 1.4;
}

@media (max-width: 720px) {
    .agent-quick-actions {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* ═══════════════════════════════════════════
   统一右侧抽屉系统（保持不变）
   ═══════════════════════════════════════════ */

.drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.25);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
}
.drawer-panel {
    width: 380px;
    max-width: 88vw;
    height: 100%;
    background: var(--bb-bg-card);
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.08);
}
.drawer-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--bb-border);
    flex-shrink: 0;
}
.drawer-panel__title {
    font-size: 15px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.drawer-panel__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.drawer-panel__close:hover {
    background: var(--bb-bg-hover);
    color: var(--bb-text-primary);
}
.drawer-panel__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 24px;
}

.drawer-enter-active,
.drawer-leave-active {
    transition: opacity 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
    opacity: 0;
}
.drawer-enter-active .drawer-panel {
    animation: slideIn 0.22s ease-out;
}
.drawer-leave-active .drawer-panel {
    animation: slideOut 0.16s ease-in;
}
@keyframes slideIn {
    from {
        transform: translateX(60px);
        opacity: 0.8;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(40px);
        opacity: 0;
    }
}

/* ===== 抽屉内公共样式 ===== */
.drawer-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}
.drawer-actions--between {
    align-items: center;
    justify-content: space-between;
}
.drawer-icon-btn {
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--bb-border);
    border-radius: 6px;
    background: var(--bb-bg-card);
    color: var(--bb-text-tertiary);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
}
.drawer-icon-btn:hover:not(:disabled) {
    border-color: var(--bb-accent);
    color: var(--bb-accent-text);
}
.drawer-icon-btn:disabled {
    cursor: wait;
    opacity: 0.55;
}
.drawer-icon-btn--danger:hover:not(:disabled) {
    border-color: var(--bb-danger);
    background: var(--bb-danger-light);
    color: var(--bb-danger);
}
.spinning {
    animation: tool-spin 0.9s linear infinite;
}
@keyframes tool-spin {
    to {
        transform: rotate(360deg);
    }
}
.drawer-resource-section + .drawer-resource-section {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--bb-border);
}
.drawer-resource-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
    color: var(--bb-text-primary);
    font-size: 12px;
    font-weight: var(--bb-weight-semibold);
}
.drawer-resource-title span {
    color: var(--bb-text-disabled);
    font-family: var(--bb-font-mono);
    font-size: 11px;
}
.drawer-empty-inline {
    padding: 16px 2px;
    color: var(--bb-text-tertiary);
    font-size: 12px;
    text-align: center;
}
.drawer-mcp-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.drawer-mcp-card {
    padding: 13px;
}
.drawer-mcp-card__head {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.drawer-mcp-card__identity,
.drawer-mcp-card__actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 5px;
}
.drawer-mcp-card__identity svg {
    flex: 0 0 auto;
    color: var(--bb-accent-text);
}
.drawer-mcp-card__identity strong {
    overflow: hidden;
    color: var(--bb-text-primary);
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
}
.drawer-mcp-card__url {
    margin-top: 7px;
    overflow: hidden;
    color: var(--bb-text-tertiary);
    font-family: var(--bb-font-mono);
    font-size: 10px;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.drawer-mcp-status {
    margin-top: 6px;
    color: var(--bb-text-tertiary);
    font-size: 11px;
    line-height: 1.5;
    word-break: break-word;
}
.drawer-mcp-status--ok {
    color: var(--bb-success);
}
.drawer-mcp-status--error {
    color: var(--bb-danger);
}
.drawer-mcp-tools {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--bb-border-light);
}
.drawer-mcp-tool {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
}
.drawer-mcp-tool + .drawer-mcp-tool {
    border-top: 1px solid var(--bb-border-light);
}
.drawer-mcp-tool span {
    color: var(--bb-text-primary);
    font-family: var(--bb-font-mono);
    font-size: 11px;
    word-break: break-word;
}
.drawer-mcp-tool small {
    display: -webkit-box;
    overflow: hidden;
    color: var(--bb-text-tertiary);
    font-size: 10px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.drawer-card {
    padding: 14px;
    background: var(--bb-bg-page);
    border-radius: var(--bb-radius-md);
    border: 1px solid transparent;
    transition: all 0.15s var(--bb-ease);
}
.drawer-card:hover {
    border-color: var(--bb-border);
    box-shadow: var(--bb-shadow-xs);
}
.drawer-card--active {
    border-color: var(--bb-accent);
    background: var(--bb-accent-soft);
}
.drawer-card--disabled {
    cursor: not-allowed;
    opacity: 0.62;
}
.drawer-load-more {
    display: block;
    min-height: 34px;
    margin: 12px auto 0;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: var(--bb-accent-text);
    font-family: var(--bb-font);
    font-size: 12px;
    cursor: pointer;
}
.drawer-load-more:disabled {
    cursor: wait;
    color: var(--bb-text-disabled);
}
.drawer-card__title {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.drawer-tool-count {
    font-size: 11px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-accent);
    background: var(--bb-accent-soft);
    padding: 1px 8px;
    border-radius: 10px;
    white-space: nowrap;
    flex-shrink: 0;
}
.drawer-tool-count--idle {
    color: var(--bb-text-disabled);
    background: transparent;
}
.drawer-card__desc {
    font-size: 12px;
    color: var(--bb-text-tertiary);
    line-height: 1.5;
}
.drawer-skills {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.drawer-card.is-off {
    opacity: 0.5;
}
.drawer-skill-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}
.drawer-skill-card__name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.drawer-skill-card__name strong {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.drawer-skill-card__sysicon {
    color: var(--bb-accent);
    flex-shrink: 0;
}
.drawer-skill-card__tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bb-bg-input);
    color: var(--bb-text-tertiary);
    white-space: nowrap;
}
.drawer-skill-card__desc {
    font-size: 12px;
    color: var(--bb-text-secondary);
    line-height: 1.5;
    margin-bottom: 8px;
}
.drawer-skill-card__foot {
    display: flex;
    align-items: center;
}
.drawer-skill-card__detail {
    font-size: 11px;
    color: var(--bb-accent-text);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    font-family: var(--bb-font);
    transition: color 0.15s var(--bb-ease);
}
.drawer-skill-card__detail:hover {
    color: var(--bb-accent);
}

.skill-toggle-btn {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    flex-shrink: 0;
}
.skill-toggle-track {
    display: block;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--bb-text-disabled);
    position: relative;
    transition: background 0.2s var(--bb-ease);
}
.skill-toggle-btn.active .skill-toggle-track {
    background: var(--bb-accent);
}
.skill-toggle-thumb {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s var(--bb-ease);
}
.skill-toggle-btn.active .skill-toggle-thumb {
    transform: translateX(16px);
}

.drawer-back {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0 12px;
    border: none;
    background: transparent;
    color: var(--bb-text-tertiary);
    font-size: 13px;
    cursor: pointer;
    font-family: var(--bb-font);
    transition: color 0.15s var(--bb-ease);
}
.drawer-back:hover {
    color: var(--bb-accent);
}
.drawer-detail-desc {
    font-size: 13px;
    color: var(--bb-text-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
}
.drawer-section {
    margin-bottom: 16px;
}
.drawer-section__title {
    font-size: 11px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--bb-border-light);
}

.drawer-md {
    font-size: 11px;
    color: var(--bb-text-secondary);
    background: var(--bb-bg-page);
    padding: 10px 12px;
    border-radius: var(--bb-radius-sm);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 260px;
    overflow-y: auto;
    line-height: 1.7;
    font-family: var(--bb-font-mono);
    margin: 0;
}

.drawer-tools {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.drawer-convs {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.drawer-convs .drawer-card {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}
.drawer-conv-main {
    flex: 1;
    min-width: 0;
}
.drawer-conv-title {
    display: block;
    font-size: 13px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
}
.drawer-conv-wechat-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: var(--bb-weight-semibold);
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: 6px;
    line-height: 1.4;
    vertical-align: middle;
}
.drawer-conv-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
}
.drawer-conv-tag {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--bb-bg-input);
    color: var(--bb-text-tertiary);
    font-size: 10px;
    font-weight: var(--bb-weight-medium);
    font-variant-numeric: tabular-nums;
    line-height: 1.6;
    flex-shrink: 0;
}
.drawer-conv-tag--tokens {
    font-weight: var(--bb-weight-semibold);
}
.drawer-conv-tag--pro {
    background: var(--bb-accent-lighter);
    color: var(--bb-accent-text);
    font-weight: var(--bb-weight-semibold);
}
.drawer-conv-tag--flash {
    background: var(--bb-info-light);
    color: var(--bb-info);
    font-weight: var(--bb-weight-semibold);
}
.drawer-conv-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}
.drawer-conv-title-input {
    flex: 1;
    font-size: 13px;
    font-weight: var(--bb-weight-medium);
    color: var(--bb-text-primary);
    border: 1px solid var(--bb-accent);
    border-radius: 4px;
    padding: 2px 6px;
    outline: none;
    font-family: var(--bb-font);
    background: var(--bb-bg-card);
}
.drawer-conv-edit-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
}
.drawer-conv-title-ok {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: var(--bb-accent);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
}
.drawer-conv-title-ok:hover {
    background: var(--bb-accent-hover);
}
.drawer-conv-edit,
.drawer-conv-del {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-tertiary);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: all 0.15s var(--bb-ease);
}
.drawer-card:hover .drawer-conv-edit,
.drawer-card:hover .drawer-conv-del {
    opacity: 1;
}
.drawer-conv-edit:hover {
    color: var(--bb-accent-text);
    background: var(--bb-accent-light);
}
.drawer-conv-del:hover {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}
.drawer-empty {
    text-align: center;
    padding: 48px 20px;
    font-size: 13px;
    color: var(--bb-text-tertiary);
    line-height: 1.6;
}

/* ===== 创建 Skill 表单 ===== */
.create-skill-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.create-skill-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.create-skill-label {
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.create-skill-hint {
    font-size: 11px;
    color: var(--bb-text-tertiary);
    margin: 0;
}
.create-skill-textarea {
    width: 100%;
    min-height: 160px;
    padding: 10px 12px;
    border: 1px solid var(--bb-border);
    border-radius: var(--bb-radius-sm);
    font-family: var(--bb-font-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--bb-text-primary);
    background: var(--bb-bg-card);
    resize: vertical;
    outline: none;
    transition: border-color var(--bb-duration-fast) var(--bb-ease);
}
.create-skill-textarea:focus {
    border-color: var(--bb-accent);
    box-shadow: 0 0 0 3px var(--bb-accent-light);
}
.create-skill-textarea--compact {
    min-height: 104px;
}
.mcp-enabled-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 2px;
}
/* 自定义 Skill 删除按钮 */
.drawer-skill-card__actions {
    display: flex;
    align-items: center;
    gap: 4px;
}
.drawer-skill-card__del {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bb-text-disabled);
    cursor: pointer;
    transition: all 0.15s var(--bb-ease);
    opacity: 0;
}
.drawer-card:hover .drawer-skill-card__del {
    opacity: 1;
}
.drawer-skill-card__del:hover {
    color: var(--bb-danger);
    background: var(--bb-danger-light);
}

/* ===== 微信连接弹窗 ===== */
.wechat-connect {
    display: flex;
    min-height: 248px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}
.wechat-connect__pending,
.wechat-connect__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: var(--bb-text-secondary);
    font-size: 13px;
    line-height: 1.6;
}
.wechat-connect__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--bb-border);
    border-top-color: var(--bb-accent);
    border-radius: 50%;
    animation: tool-spin 0.8s linear infinite;
}
.wechat-connect__qr-frame {
    width: 232px;
    height: 232px;
    padding: 4px;
    border: 1px solid var(--bb-border);
    border-radius: 8px;
    background: #fff;
}
.wechat-connect__qr {
    display: block;
    width: 224px;
    height: 224px;
}
.wechat-connect__title {
    margin-top: 14px;
    color: var(--bb-text-primary);
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
}
.wechat-connect__error {
    color: var(--bb-danger);
}

/* ===== 操作确认弹窗（复用了 BbModal，这里仅补充内容区样式） ===== */
.bb-confirm-body {
    padding: 0;
}

.bb-confirm-desc {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--bb-text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
}

.bb-confirm-code {
    margin: 0 0 8px;
    padding: 8px 12px;
    background: var(--bb-bg-input);
    border-radius: var(--bb-radius-sm);
    font-family: var(--bb-font-mono);
    font-size: 12px;
    color: var(--bb-text-primary);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow: auto;
}
</style>
