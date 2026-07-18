/**
 * IPC 频道常量
 * 主进程与预加载脚本必须共同使用此处定义，避免频道名称漂移
 * @author xiangwei
 */

export const IPC_CHANNELS = {
    user: {
        list: 'user:list',
        create: 'user:create',
        switch: 'user:switch',
        delete: 'user:delete'
    },
    account: {
        list: 'account:list',
        create: 'account:create',
        update: 'account:update',
        delete: 'account:delete'
    },
    category: {
        list: 'category:list',
        create: 'category:create',
        update: 'category:update',
        delete: 'category:delete',
        createSub: 'category:createSub',
        updateSub: 'category:updateSub',
        deleteSub: 'category:deleteSub',
        resetDefaults: 'category:resetDefaults'
    },
    transaction: {
        create: 'transaction:create',
        update: 'transaction:update',
        delete: 'transaction:delete',
        batchDelete: 'transaction:batchDelete',
        list: 'transaction:list',
        getById: 'transaction:getById',
        export: 'transaction:export'
    },
    budget: {
        set: 'budget:set',
        getMonth: 'budget:getMonth',
        getYear: 'budget:getYear',
        delete: 'budget:delete'
    },
    statistics: {
        getMonthly: 'statistics:getMonthly',
        getAnnual: 'statistics:getAnnual'
    },
    weather: {
        getCurrent: 'weather:getCurrent'
    },
    import: {
        selectFile: 'import:selectFile',
        parseFile: 'import:parseFile',
        updateDraft: 'import:updateDraft',
        confirmDraft: 'import:confirmDraft',
        discardDraft: 'import:discardDraft'
    },
    setting: {
        get: 'setting:get',
        set: 'setting:set'
    },
    app: {
        getVersions: 'app:getVersions',
        openLogDirectory: 'app:openLogDirectory',
        reportRendererError: 'app:reportRendererError',
        quit: 'app:quit',
        /** 设置开机自启 */
        setAutoLaunch: 'app:setAutoLaunch',
        /** 查询开机自启状态 */
        getAutoLaunch: 'app:getAutoLaunch'
    },
    window: {
        minimize: 'window:minimize',
        maximize: 'window:maximize',
        close: 'window:close',
        isMaximized: 'window:isMaximized',
        maximizeChange: 'window:maximizeChange',
        minimizeToTray: 'window:minimizeToTray',
        /** 读取退出弹窗"最小化到托盘"勾选框的上次选择 */
        getMinimizePreference: 'window:getMinimizePreference',
        /** 保存退出弹窗"最小化到托盘"勾选框的选择 */
        setMinimizePreference: 'window:setMinimizePreference'
    },
    agent: {
        chat: 'agent:chat',
        cancelChat: 'agent:cancelChat',
        listConversations: 'agent:listConversations',
        deleteConversation: 'agent:deleteConversation',
        getConversation: 'agent:getConversation',
        getConfig: 'agent:getConfig',
        updateConfig: 'agent:updateConfig',
        listLocalTools: 'agent:listLocalTools',
        listSkills: 'agent:listSkills',
        getSkillDetail: 'agent:getSkillDetail',
        reloadSkills: 'agent:reloadSkills',
        toggleSkill: 'agent:toggleSkill',
        createSkill: 'agent:createSkill',
        deleteSkill: 'agent:deleteSkill',
        listMcpServers: 'agent:listMcpServers',
        saveMcpServer: 'agent:saveMcpServer',
        deleteMcpServer: 'agent:deleteMcpServer',
        toggleMcpServer: 'agent:toggleMcpServer',
        inspectMcpServer: 'agent:inspectMcpServer',
        renameConversation: 'agent:renameConversation',
        getToolCallCounts: 'agent:getToolCallCounts',
        setToolCallCounts: 'agent:setToolCallCounts',
        /** 微信渠道扫码连接 */
        connectWechat: 'agent:connectWechat',
        /** 断开微信渠道 */
        disconnectWechat: 'agent:disconnectWechat',
        /** 获取微信渠道状态 */
        getWechatStatus: 'agent:getWechatStatus',
        /** 微信渠道状态推送（主进程→渲染进程） */
        wechatStatus: 'agent:wechatStatus',
        /** 流式事件推送（主进程→渲染进程） */
        event: 'agent:event',
        /** 语音转文字 */
        transcribeAudio: 'agent:transcribeAudio',
        /** 语音转文字进度事件（主进程→渲染进程） */
        transcribeProgress: 'agent:transcribeProgress',
        /** 下载 STT 模型 */
        sttDownloadModel: 'agent:sttDownloadModel',
        /** 查询 STT 模型状态 */
        sttModelStatus: 'agent:sttModelStatus',
        /** 删除已下载的 STT 模型缓存 */
        sttDeleteModel: 'agent:sttDeleteModel'
    }
} as const
