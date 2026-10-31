import type { Page } from '../types/navigation'
export interface NavigationState { page:Page;selected:string;trail:{page:Page;selected:string}[];feedback:string;modal:'start'|'cancel'|null }
export function useNavigation(state:NavigationState){
  function go(page:Page,id=''){if(state.page!==page)state.trail.push({page:state.page,selected:state.selected});state.page=page;state.selected=id;state.feedback=''}
  function back(){if(state.modal){state.modal=null;return}const previous=state.trail.pop();state.page=previous?.page??'home';state.selected=previous?.selected??'';state.feedback=''}
  return {go,back}
}
