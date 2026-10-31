<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>()
</script>
<template><header class="hero"><svg class="landscape" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="342" cy="48" r="31" fill="#ffcf7f"/><path d="M210 150q60-83 118-25t100-7v32" fill="#efdec1"/><path d="M275 150q62-60 140-20v20" fill="#d7e4c5"/><path d="M340 140v-41m0 20q-22-2-13-22 18 2 13 22m0-10q23-9 21-29-22 4-21 29" stroke="#a8bd8e" stroke-width="3" fill="#bdcfa0"/></svg><h1>{{ title }}</h1><p>{{ subtitle }}</p></header></template>
