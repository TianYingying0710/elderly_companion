import type { ChatMessage } from '../types/domain'
export interface ChatState { demo:boolean;draft:string;feedback:string;messages:ChatMessage[] }
export function useChat(state:ChatState){function send(){const text=state.draft.trim();if(!text){state.feedback='请先输入您想说的话';return}if(!state.demo){state.feedback='AI 服务尚未接入，内容未发送';return}state.messages.push({role:'user',text,local:true});state.draft='';state.feedback='仅本地草稿，未发送至 AI'}return{send}}
