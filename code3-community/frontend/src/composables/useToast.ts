import { onUnmounted, ref } from 'vue'

/** 轻提示。页面只关心「说什么」，不关心计时器与挂载位置。 */
export function useToast(duration = 1600) {
  const toastText = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function tip(text: string) {
    toastText.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      toastText.value = ''
      timer = null
    }, duration)
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { toastText, tip }
}
