<template>
    <div class="bb-page-container bb-page-container--medium">
        <PageHeader title="待办" subtitle="管理你的任务清单" />
        <TodoSection />
    </div>
</template>

<script setup lang="ts">
/**
 * 待办页（独立路由）
 * 极简容器，全部业务逻辑交由 TodoSection 处理
 * @author xiangwei
 */

import PageHeader from '../components/common/PageHeader.vue'
import TodoSection from './sections/TodoSection.vue'
</script>
