<template>
    <div class="bb-progress-track">
        <div class="bb-progress-bar" :style="{ width: clamped + '%', background: color }" />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ percent: number; color?: string }>()

const clamped = computed(() => Math.min(Math.max(props.percent, 0), 100))
</script>

<style scoped>
.bb-progress-track {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--bb-bg-input);
    overflow: hidden;
}
.bb-progress-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
}
</style>
