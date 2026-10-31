import type { DemoData } from '../types/domain'
export const cloneDemoData=(data:DemoData):DemoData=>JSON.parse(JSON.stringify(data)) as DemoData
export function useDemoMode(state:any,source:DemoData){function toggleDemo(){state.demo=!state.demo;state.data=state.demo?cloneDemoData(source):null;state.messages=state.demo?cloneDemoData(source).chat:[];state.sos=null;state.currentRequest=null;state.reached=false;state.modal=null;state.draft='';state.query='';state.category='全部';state.selected='';state.trail=[];state.page='home';state.feedback=''}return{toggleDemo}}
