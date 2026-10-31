import type { DemoData } from '../types/domain'

/* 仅供老人端演示模式：所有人物、课程、社区事项、事件和设备状态均为虚构。
 * 不含真实联系方式，不用于实际办事、医疗判断或求助。
 * 状态层统一提供给页面，不依赖数据库或后端。
 */
export const demoData = {
  profile: { name: '林奶奶', community: '暖邻社区（虚构）', age: '72 岁', greeting: '今天也要开开心心' },
  reminder: { title: '手机课堂即将开始', text: '下午三点，一起学习如何使用地图。', detail: '这是虚构的活动提醒，用于预览通知样式。没有真实活动或预约。' },
  categories: ['全部', '出行打车', '就医挂号', '日常生活', '聊天联络', '防骗安全'],
  courses: [
    { id:'taxi', title:'学会用手机叫车', category:'出行打车', description:'认识出发地与目的地', duration:'06:20', color:'blue', symbol:'🚕', progress:45, outline:['认识打车页面','了解地点选择','查看订单信息'] },
    { id:'register', title:'认识手机预约挂号', category:'就医挂号', description:'了解预约页面的基本组成', duration:'08:15', color:'green', symbol:'🏥', progress:0, outline:['认识预约入口','了解科室与日期选择','查看预约信息'] },
    { id:'video', title:'和家人视频聊天', category:'聊天联络', description:'让想念的人出现在屏幕上', duration:'04:30', color:'gold', symbol:'💬', progress:100, outline:['找到家人','认识视频通话按钮','结束视频通话'] },
    { id:'fraud', title:'识别可疑消息', category:'防骗安全', description:'认识陌生链接与可疑提示', duration:'05:40', color:'gold', symbol:'🛡️', progress:20, outline:['观察消息来源','识别催促性话术','遇到疑问先核实'] },
    { id:'payment', title:'认识生活缴费页面', category:'日常生活', description:'了解生活服务常见入口', duration:'07:10', color:'blue', symbol:'🏡', progress:0, outline:['寻找生活服务','认识账单信息','核对页面内容'] }
  ],
  chat: [
    { role:'assistant', text:'林奶奶，您好！今天想聊些什么？' },
    { role:'user', text:'我想学学怎么用手机叫车。' },
    { role:'assistant', text:'我们可以从认识页面开始。您可以先去“数字教学”看看出行打车分类。' }
  ],
  chatHistory: [{title:'学习手机叫车',time:'今天 09:30',summary:'了解数字教学里的出行教程',conversation:0},{title:'和家人聊聊天',time:'昨天 16:10',summary:'想学习视频通话',conversation:1}],
  conversations: [
    [{role:'assistant',text:'林奶奶，您好！今天想聊些什么？'},{role:'user',text:'我想学学怎么用手机叫车。'},{role:'assistant',text:'我们可以从认识页面开始。您可以先去“数字教学”看看出行打车分类。'}],
    [{role:'user',text:'我想和家人视频聊天。'},{role:'assistant',text:'数字教学里有“和家人视频聊天”的演示课程，可以先看看页面。'}]
  ],
  family: [
    {id:'daughter', name:'林女士', relation:'女儿', permissions:{'设备数据与画像':true,'学习记录':true,'求助记录':true,'社区服务记录':false}},
    {id:'son', name:'林先生', relation:'儿子', permissions:{'设备数据与画像':false,'学习记录':false,'求助记录':true,'社区服务记录':true}}
  ],
  services: [
    {id:'class',title:'社区手机课堂报名',summary:'了解课堂报名材料与流程',conditions:'演示条件：希望了解手机操作的社区居民。',materials:['演示报名表','希望学习的内容'],steps:['向演示服务窗口了解课程','填写演示报名信息','等待演示报名结果'],location:'暖邻社区演示服务大厅（虚构地点）',contact:'无真实联系方式',updated:'2026-10-24'},
    {id:'support',title:'申请数字生活协助',summary:'了解线下手机操作协助流程',conditions:'演示条件：需要手机操作协助的社区居民。',materials:['需要协助的事项说明'],steps:['描述希望解决的问题','了解演示服务安排','确认演示服务内容'],location:'暖邻社区演示服务大厅（虚构地点）',contact:'无真实联系方式',updated:'2026-10-24'}
  ],
  messages: [
    {id:'class',title:'手机课堂提醒',text:'下午三点，一起学习如何使用地图。',time:'今天 10:00',type:'bell',detail:'虚构课堂提醒，仅用于演示通知详情，没有真实课程安排。'},
    {id:'family',title:'家人绑定提醒',text:'林女士已加入演示家人列表。',time:'昨天 18:20',type:'family',detail:'这是预置的虚构绑定记录，没有真实绑定或授权。'},
    {id:'help',title:'求助处理记录',text:'一条演示求助已标记处理结束。',time:'昨天 15:40',type:'sos',detail:'仅用于展示求助进度，未发生真实求助或人员响应。'}
  ],
  sos: { recipients:['已绑定家人（模拟）','社区服务中心（模拟）'], states:{sending:{title:'正在发送',description:'正在尝试发送求助信息。'},delivered:{title:'已送达',description:'求助信息已送达，正在等待回应。'},responded:{title:'有人响应',description:'已有联系人回应，尚不表示援助已经到达。'},failed:{title:'发送失败',description:'求助信息未送达，请重试或使用电话联系。'},cancelled:{title:'求助已取消',description:'本次模拟求助已结束。'} } },
  requests: [{id:'help-01',title:'软件 SOS 求助（模拟）',time:'昨天 15:20',state:'已结束 · 模拟',timeline:[['15:20','演示事件创建'],['15:22','演示家人查看'],['15:30','演示社区跟进'],['15:40','演示处理结束']]}],
  devices: [{name:'智能手环',icon:'watch',battery:82,status:'已连接',connection:'蓝牙连接',description:'连接与电量为模拟值，不采集健康数据。'},{name:'SOS 按钮',icon:'sos',battery:96,status:'已连接',connection:'蓝牙连接',description:'实体求助能力未接入，不会触发真实通知。'}]
} satisfies DemoData;
export type { DemoData } from '../types/domain'
