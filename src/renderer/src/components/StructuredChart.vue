<template>
    <div class="bb-structured-chart">
        <div v-if="data.title" class="bb-structured-chart__title">{{ data.title }}</div>
        <VChart
            class="bb-structured-chart__chart"
            :option="chartOption"
            autoresize
            :loading="false"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { StructuredChartData } from '@shared/types'

// 注册 ECharts 组件（全局注册，重复调用无害）
use([
    PieChart,
    BarChart,
    LineChart,
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    CanvasRenderer
])

const props = defineProps<{
    data: StructuredChartData
}>()

/**
 * 根据结构化数据生成 ECharts option
 *
 * @author xiangwei
 */
const chartOption = computed(() => {
    const { type, labels, datasets, title } = props.data

    // 饼图：单个 dataset，用 labels 作为 name，values 作为 value
    if (type === 'pie') {
        const dataset = datasets[0]
        return {
            tooltip: {
                trigger: 'item' as const,
                formatter: '{b}: {c} ({d}%)'
            },
            series: [
                {
                    type: 'pie',
                    radius: ['30%', '60%'],
                    center: ['50%', '55%'],
                    data: labels.map((label, i) => ({
                        name: label,
                        value: dataset.values[i] ?? 0
                    })),
                    label: {
                        show: true,
                        formatter: '{b}: {d}%',
                        fontSize: 11
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.15)'
                        }
                    }
                }
            ],
            color: [
                '#d9a404',
                '#4a90d9',
                '#50c878',
                '#e8714a',
                '#9b59b6',
                '#f1c40f',
                '#1abc9c',
                '#e74c3c',
                '#3498db',
                '#2ecc71'
            ],
            grid: { containLabel: true, top: title ? 40 : 16, bottom: 8, left: 8, right: 8 }
        }
    }

    // 柱状图 / 折线图
    const isBar = type === 'bar'
    return {
        tooltip: {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const }
        },
        legend: {
            show: datasets.length > 1,
            bottom: 0,
            textStyle: { fontSize: 11 }
        },
        xAxis: {
            type: 'category' as const,
            data: labels,
            axisLabel: { fontSize: 11 }
        },
        yAxis: {
            type: 'value' as const,
            axisLabel: { fontSize: 11 }
        },
        series: datasets.map((ds) => ({
            name: ds.name,
            type: isBar ? 'bar' : 'line',
            data: ds.values,
            smooth: !isBar,
            barMaxWidth: 32,
            itemStyle: {
                borderRadius: isBar ? [3, 3, 0, 0] : undefined
            }
        })),
        color: [
            '#d9a404',
            '#4a90d9',
            '#50c878',
            '#e8714a',
            '#9b59b6',
            '#f1c40f',
            '#1abc9c',
            '#e74c3c'
        ],
        grid: {
            containLabel: true,
            top: title ? 40 : 16,
            bottom: datasets.length > 1 ? 28 : 12,
            left: 8,
            right: 8
        }
    }
})
</script>

<style scoped>
.bb-structured-chart {
    margin: 8px 0;
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    overflow: hidden;
    background: var(--bb-bg-card);
}
.bb-structured-chart__title {
    padding: 10px 14px 4px;
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
}
.bb-structured-chart__chart {
    width: 100%;
    height: 240px;
}
</style>
