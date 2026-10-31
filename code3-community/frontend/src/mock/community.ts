import { stamp } from '../domain/rescueFlow'
import type { Course, GuardianProgress, KnowledgeDoc, RescueIncident, ServiceTask } from '../types/community'

/**
 * 社区端 UI 演示数据。全部为前端内存态，不请求后端。
 * 后续接入 `api/` 时，只需删除本文件并把工厂函数换成接口返回值。
 */

const cloneGuardian = (guardian: GuardianProgress): GuardianProgress => ({
  ...guardian,
  times: [...guardian.times],
})

const cloneIncident = (incident: RescueIncident): RescueIncident => ({
  ...incident,
  stepTimes: [...incident.stepTimes],
  guardian: cloneGuardian(incident.guardian),
})

const INCIDENTS: RescueIncident[] = [
  {
    id: 'SOS-20261029-001',
    name: '王建国',
    type: '紧急求助',
    reason: '',
    location: '幸福里 3 栋 2 单元 502',
    time: '10-29 01:07',
    source: '硬件求助 · 实体 SOS 按钮',
    status: '待响应',
    stepTimes: ['10-29 01:07'],
    guardian: {
      name: '王女士',
      stage: 0,
      times: ['01:07'],
      feedback: '暂无监护人反馈',
      otherCount: 0,
    },
  },
  {
    id: 'SOS-20261029-002',
    name: '李秀兰',
    type: '紧急求助',
    reason: '身体不适',
    location: '中心花园北门长椅',
    time: '10-29 00:52',
    source: '软件求助 · 老人端一键求助',
    status: '已赶往现场',
    stepTimes: ['10-29 00:52'],
    guardian: {
      name: '李先生',
      stage: 1,
      times: ['00:52', '00:54'],
      feedback: '监护人已查看，正在尝试联系老人',
      otherCount: 1,
    },
  },
  {
    id: 'SOS-20261028-003',
    name: '张桂英',
    type: '紧急求助',
    reason: '',
    location: '幸福里 6 栋 1 单元 201',
    time: '10-28 01:10',
    source: '硬件求助 · 实体 SOS 按钮',
    status: '已完成处理',
    stepTimes: ['10-28 01:10', '10-28 01:14', '10-28 01:18', '10-28 01:32'],
    result: '已上门确认老人身体无碍，家中燃气阀门未关紧，已协助关闭并通知家属。',
    guardian: {
      name: '张女士',
      stage: 2,
      times: ['01:10', '01:11', '01:13'],
      feedback: '已联系老人，确认社区人员已到场',
      otherCount: 0,
    },
  },
]

const SERVICES: ServiceTask[] = [
  {
    id: 'service-1',
    title: '公益课程线下答疑',
    name: '王秀英',
    type: '数字助老',
    time: '今天 14:00',
    location: '社区养老服务中心 2 楼教室',
    description: '老人在学习微信视频通话时遇到操作问题，现场一对一指导',
    status: '待接收',
  },
  {
    id: 'service-2',
    title: '代缴水电费',
    name: '周德明',
    type: '代办服务',
    time: '今天 16:30',
    location: '幸福里社区服务中心窗口',
    description: '按老人委托到社区窗口代缴本月水电费并回传缴费凭证',
    status: '服务中',
  },
  {
    id: 'service-3',
    title: '办事流程现场协助',
    name: '刘桂芳',
    type: '社区事务',
    time: '昨天 10:00',
    location: '社区养老服务中心',
    description: '协助老人填写养老补贴申请材料并在窗口办理',
    status: '已完成',
  },
]

const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: 'doc-1',
    name: '社区办事指南.docx',
    content: '',
    status: '待确认',
  },
  {
    id: 'doc-2',
    name: '社区服务联系方式.docx',
    content: '社区服务中心联系电话与服务时间说明。',
    status: '已启用',
  },
]

const COURSES: Course[] = [
  {
    id: 'course-1',
    title: '怎样调大手机字体',
    category: '手机基础',
    format: '图文教程',
    duration: '约 3 分钟',
    note: '适合初次使用智能手机',
    status: '已发布',
  },
  {
    id: 'course-2',
    title: '微信视频通话怎么用',
    category: '微信',
    format: '视频教程',
    duration: '约 5 分钟',
    note: '待补充操作说明',
    status: '草稿',
  },
  {
    id: 'course-3',
    title: '陌生链接不要点',
    category: '防诈骗',
    format: '图文教程',
    duration: '约 4 分钟',
    note: '常见网络诈骗提醒',
    status: '已发布',
  },
]

export const createIncidents = (): RescueIncident[] => INCIDENTS.map(cloneIncident)
export const createServices = (): ServiceTask[] => SERVICES.map((task) => ({ ...task }))
export const createKnowledgeDocs = (): KnowledgeDoc[] => KNOWLEDGE_DOCS.map((doc) => ({ ...doc }))
export const createCourses = (): Course[] => COURSES.map((course) => ({ ...course }))

export const COURSE_CATEGORIES = ['全部', '手机基础', '微信', '防诈骗']

interface SimSeed {
  name: string
  location: string
  guardian: string
}

export const simPool: SimSeed[] = [
  { name: '刘振国', location: '幸福里 8 栋 1 单元 401', guardian: '刘女士' },
  { name: '陈玉兰', location: '幸福里 2 栋 3 单元 602', guardian: '陈先生' },
  { name: '孙德海', location: '中心花园 5 号楼 203', guardian: '孙女士' },
  { name: '吴凤芝', location: '幸福里 4 栋 2 单元 105', guardian: '吴先生' },
]

/** 生成一条新的待响应事件。`seq` 从 0 递增，用于轮换人物并保证编号唯一。 */
export function createSimIncident(seq: number, now: Date = new Date()): RescueIncident {
  const seed = simPool[seq % simPool.length]
  const time = stamp(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return {
    id: `SOS-${day}-SIM${pad((seq % 100) + 1)}`,
    name: seed.name,
    type: '紧急求助',
    reason: '',
    location: seed.location,
    time,
    source: '硬件求助 · 实体 SOS 按钮',
    status: '待响应',
    stepTimes: [time],
    guardian: {
      name: seed.guardian,
      stage: 0,
      times: [time.slice(6)],
      feedback: '暂无监护人反馈',
      otherCount: 0,
    },
  }
}
