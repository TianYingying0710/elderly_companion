export interface HealthState { health:string;checking:boolean }
export function useHealth(state:HealthState,request:()=>Promise<unknown>){
  async function check(){if(state.checking)return;state.checking=true;state.health='正在检查后端连接…';try{await request();state.health='后端连接正常'}catch{state.health='暂时无法连接后端'}finally{state.checking=false}}
  return {check}
}
