<template>
    <div v-show="isActive" class="bb-tab-pane">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { inject, computed, onMounted, type Ref } from 'vue'

const props = defineProps<{ title: string; tabKey: string }>()

const ctx = inject<{ tabs: Ref<{ key: string; title: string }[]>; activeKey: Ref<string> }>(
    'bb-tabs'
)
const isActive = computed(() => ctx?.activeKey.value === props.tabKey)

onMounted(() => {
    if (ctx && !ctx.tabs.value.find((t) => t.key === props.tabKey)) {
        ctx.tabs.value.push({ key: props.tabKey, title: props.title })
        if (!ctx.activeKey.value) ctx.activeKey.value = props.tabKey
    }
})
</script>
