<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean
    /** 弹层高度，默认 80vh */
    height?: string
  }>(),
  { height: '80vh' },
)

const emit = defineEmits<{
  (event: 'close'): void
}>()
</script>

<template>
  <view v-if="visible" class="mask" @tap="emit('close')">
    <view class="sheet" :style="{ height }" @tap.stop>
      <view class="handle"></view>
      <scroll-view scroll-y class="sheet-body">
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.52);
}

.sheet {
  border-radius: 47rpx 47rpx 0 0;
  background: #f8f8ff;
  color: #1f2024;
}

.handle {
  width: 66rpx;
  height: 9rpx;
  margin: 23rpx auto 30rpx;
  border-radius: 99rpx;
  background: #414653;
}

.sheet-body {
  height: calc(100% - 120rpx);
  padding: 0 47rpx calc(44rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
</style>
