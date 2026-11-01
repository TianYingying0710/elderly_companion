// 内存态演示数据：全部为虚构演示内容，接后端时整体替换为 api/ 调用。
// 按 2026-11-01 口径：单老人、只读展示、AI 建议为演示模式。

import type {
  AdviceItem,
  ElderProfile,
  GuardianInfo,
  HealthMetric,
  MenuItem,
  MessageItem,
  ReminderItem,
} from '../types'

export const elderProfile: ElderProfile = {
  name: '李桂芳',
  age: 76,
  relation: '母亲',
  boundLabel: '已绑定',
}

export const guardianInfo: GuardianInfo = {
  name: '监护人',
  phone: '138 **** 5678',
}

export const healthUpdatedAt = '更新于 10-31 08:20'

export const healthMetrics: HealthMetric[] = [
  { key: 'heartRate', label: '心率', value: '72', unit: '次/分', badge: '正常' },
  { key: 'bloodPressure', label: '血压', value: '128/76', unit: 'mmHg', badge: '正常' },
  { key: 'sleep', label: '睡眠', value: '7.2', unit: '小时', badge: '良好' },
]

/** 近 7 天趋势的虚构数值（仅用于绘制折线，不代表真实健康数据） */
export const trendValues: number[] = [2.8, 3.6, 3.2, 4.1, 3.7, 4.4, 4.0]

export const reminders: ReminderItem[] = [
  { id: 1, title: '服用降压药', time: '08:30', icon: 'pill' },
  { id: 2, title: '适当散步', time: '15:00', icon: 'walk' },
]

/** AI 关怀建议：演示模式下的虚构内容 */
export const adviceList: AdviceItem[] = [
  { id: 1, icon: 'walk', title: '鼓励适当散步', desc: '每日 15–30 分钟，增强心肺功能。' },
  { id: 2, icon: 'chat', title: '增加语音交流', desc: '多与老人语音或视频聊天，关注情绪变化。' },
  { id: 3, icon: 'sleep', title: '关注睡眠质量', desc: '保持规律作息，营造安静的睡眠环境。' },
  { id: 4, icon: 'diet', title: '注意饮食均衡', desc: '适当增加优质蛋白和蔬菜，少盐少油。' },
]

export const adviceBanner = {
  title: 'AI 关怀建议',
  desc: '基于老人近期情况，提供个性化建议',
}

export const messages: MessageItem[] = [
  {
    id: 1,
    category: '健康提醒',
    title: '健康提醒',
    summary: '记得提醒老人今日按时服药。',
    time: '08:30',
  },
  {
    id: 2,
    category: '求助消息',
    title: '求助消息',
    summary: '老人发起了求助，已由社区处理中。',
    time: '昨天 19:42',
  },
  {
    id: 3,
    category: '社区通知',
    title: '社区通知',
    summary: '本周五将开展老年健康讲座，欢迎参加。',
    time: '10-29',
  },
  {
    id: 4,
    category: '系统消息',
    title: '系统消息',
    summary: '您的绑定信息已更新。',
    time: '10-28',
  },
]

export const menuItems: MenuItem[] = [
  { id: 1, icon: 'usersGray', label: '老人管理' },
  { id: 2, icon: 'usersGray', label: '家庭成员' },
  { id: 3, icon: 'alarmGray', label: '提醒设置' },
  { id: 4, icon: 'bellGray', label: '消息通知设置' },
  { id: 5, icon: 'helpGray', label: '使用帮助' },
  { id: 6, icon: 'infoGray', label: '关于银龄伴' },
]
