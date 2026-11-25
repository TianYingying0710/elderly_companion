import type { SosState } from '../types/domain'
import { createSosProvider } from '../data/sosProvider'
import { sosStatusTitle } from '../domain/sosStatus'
const transitions:Partial<Record<SosState,SosState[]>>={sending:['failed','delivered'],failed:['sending'],delivered:['responded']}
export function canTransition(current:SosState|null,next:SosState){return Boolean(current&&transitions[current]?.includes(next))}
export function useSos(state:any,go:(page:'sos')=>void){const provider=createSosProvider();const time=()=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());function help(){if(!state.demo){state.feedback='求助服务尚未接入，无法发送求助';return}if(state.sos&&state.sos!=='cancelled')go('sos');else state.modal='start'}async function startHelp(){if(!state.demo||!state.data||state.modal!=='start')return;const isApi=provider.mode==='api';let eventId='';if(isApi){try{const result=await provider.create();eventId=result.id}catch(error){state.modal=null;state.sos=null;state.feedback=`SOS 上报失败：${error instanceof Error?error.message:'未知错误'}`;return}}state.sos='sending';state.reached=false;const record={id:eventId||`local-${Date.now()}`,title:isApi?'本次软件 SOS 求助（演示）':'本次软件 SOS 求助（模拟）',time:time(),state:isApi?'已上报 · 等待处理':'正在发送 · 模拟',timeline:[[time(),isApi?`SOS 已上报（事件 ${eventId}）`:'确认发起模拟求助']]};state.data.requests.unshift(record);state.currentRequest=state.data.requests[0];state.modal=null;go('sos')}function progress(next:SosState){if(provider.mode==='api')return;if(!state.demo||!state.data||!state.sos||!state.currentRequest||!canTransition(state.sos,next))return;state.sos=next;if(next==='delivered'||next==='responded')state.reached=true;state.currentRequest.state=state.data.sos.states[next].title+' · 模拟';state.currentRequest.timeline.push([time(),state.currentRequest.state])}function cancelHelp(){if(provider.mode==='api')return;if(!state.demo||!state.currentRequest||state.modal!=='cancel')return;state.sos='cancelled';state.currentRequest.state='已取消 · 模拟';state.currentRequest.timeline.push([time(),'用户取消（模拟）']);if(state.reached)state.currentRequest.timeline.push([time(),'向已送达对象同步取消（模拟）']);state.modal=null}
async function refreshStatus(){if(provider.mode!=='api'||!state.currentRequest)return;const id=state.currentRequest.id;if(id.startsWith('local-'))return;try{const event=await provider.get(id);const title=sosStatusTitle(event.status);state.currentRequest.state=title;state.currentRequest.timeline.push([time(),`处理进度更新：${title}`]);const note=(event.note??'').trim();if(note&&note!==state.currentRequest.lastNote){state.currentRequest.lastNote=note;state.currentRequest.timeline.push([time(),`处置备注：${note}`])}}catch(error){state.feedback=`求助状态刷新失败：${error instanceof Error?error.message:'未知错误'}`}}
async function loadRequests(){
  if(provider.mode!=='api')return
  state.requestsLoading=true
  state.requestsFailed=false
  state.apiRequests=[]
  try{state.apiRequests=await provider.list()}
  catch(error){state.requestsFailed=true;state.feedback=error instanceof Error?error.message:'求助记录加载失败'}
  finally{state.requestsLoading=false}
}
return{help,startHelp,progress,cancelHelp,refreshStatus,loadRequests,isSosApi:provider.mode==='api'}}
