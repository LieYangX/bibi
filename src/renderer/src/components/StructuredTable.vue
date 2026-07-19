<template>
    <div class="bb-structured-table">
        <div v-if="data.title" class="bb-structured-table__title">{{ data.title }}</div>
        <div class="bb-structured-table__wrap">
            <table class="bb-structured-table__table">
                <thead>
                    <tr>
                        <th
                            v-for="(col, index) in data.columns"
                            :key="index"
                            class="bb-structured-table__th"
                        >
                            {{ col }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(row, rowIndex) in data.rows"
                        :key="rowIndex"
                        class="bb-structured-table__tr"
                    >
                        <td
                            v-for="(cell, cellIndex) in row"
                            :key="cellIndex"
                            class="bb-structured-table__td bb-structured-table__td--num"
                        >
                            {{ cell }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { StructuredTableData } from '@shared/types'

defineProps<{
    data: StructuredTableData
}>()
</script>

<style scoped>
.bb-structured-table {
    margin: 8px 0;
    border: 1px solid var(--bb-border-light);
    border-radius: var(--bb-radius-sm);
    overflow: hidden;
    background: var(--bb-bg-card);
}
.bb-structured-table__title {
    padding: 10px 14px 6px;
    font-size: 13px;
    font-weight: var(--bb-weight-semibold);
    color: var(--bb-text-primary);
    border-bottom: 1px solid var(--bb-border-light);
}
.bb-structured-table__wrap {
    overflow-x: auto;
}
.bb-structured-table__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.bb-structured-table__th {
    padding: 8px 12px;
    background: var(--bb-bg-input);
    color: var(--bb-text-secondary);
    font-weight: var(--bb-weight-semibold);
    text-align: center;
    white-space: nowrap;
    border-bottom: 1px solid var(--bb-border-light);
}
.bb-structured-table__tr {
    transition: background 0.12s var(--bb-ease);
}
.bb-structured-table__tr:hover {
    background: var(--bb-bg-hover);
}
.bb-structured-table__tr:not(:last-child) .bb-structured-table__td {
    border-bottom: 1px solid var(--bb-border-light);
}
.bb-structured-table__td {
    padding: 7px 12px;
    color: var(--bb-text-primary);
    white-space: nowrap;
}
.bb-structured-table__td--num {
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--bb-text-primary);
}
</style>
