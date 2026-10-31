<script setup lang="ts">
import type { Course } from '../types/domain'
defineProps<{ courses: Course[] }>()
defineEmits<{ select: [id: string] }>()
</script>
<template><button v-for="course in courses" :key="course.id" class="course" data-testid="course-item" @click="$emit('select', course.id)"><span class="cover" :class="course.color"><span>{{ course.symbol }}</span><small>{{ course.duration }}</small></span><span class="course-copy"><strong>{{ course.title }}</strong><small>{{ course.description }}</small><span class="pill">{{ course.category }}</span></span><span aria-hidden="true">›</span></button><p v-if="!courses.length" class="empty">没有匹配的演示课程</p></template>
