<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <view v-if="text" class="toast">{{ text }}</view>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 190rpx;
  z-index: 40;
  max-width: 640rpx;
  transform: translateX(-50%);
  padding: 18rpx 26rpx;
  border-radius: 17rpx;
  color: #fff;
  background: rgba(25, 30, 40, 0.9);
  font-size: 21rpx;
  text-align: center;
}
</style>
