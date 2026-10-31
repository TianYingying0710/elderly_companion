<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
 home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8',
 chat: 'M4 4h16v13H10l-5 4v-4H4zM8 9h8M8 12h5',
 learn: 'M4 3h16v18H4zM10 8l6 4-6 4z',
 service: 'M4 21V8l8-5 8 5v13M2 21h20M8 11h1m6 0h1M10 21v-3h4v3',
 sos: 'M6 3 3 6c0 8 7 15 15 15l3-3-5-5-3 3c-3-1-4-2-5-5l3-3z',
 user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 6 0 0 1 16 0v3z',
 watch: 'M9 2h6l1 5H8zM8 17h8l-1 5H9zM7 7h10v10H7zM12 9v3h3',
 record: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
}
</script>
<template><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="paths[name] || paths.record" /></svg></template>
