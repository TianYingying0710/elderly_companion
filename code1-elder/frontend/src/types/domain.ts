export interface Course { id:string; title:string; category:string; description:string; duration:string; color:string; symbol:string; progress:number; outline:string[] }
export interface ChatMessage { role:string; text:string; local?:boolean }
export interface FamilyMember { id:string; name:string; relation:string; permissions:Record<string, boolean> }
export interface Device { name:string; icon:string; battery:number; status:string; connection:string; description:string }
export interface MessageItem { id:string; title:string; text:string; time:string; type:string; detail:string }
export interface ServiceItem { id:string; title:string; summary:string; conditions:string; materials:string[]; steps:string[]; location:string; contact:string; updated:string }
export interface RequestRecord { id:string; title:string; time:string; state:string; timeline:string[][] }
export type SosState = 'sending'|'delivered'|'responded'|'failed'|'cancelled'
export interface DemoData {
  profile:{name:string;community:string;age:string;greeting:string}
  reminder:{title:string;text:string;detail:string}
  categories:string[]
  courses:Course[]
  chat:ChatMessage[]
  chatHistory:{title:string;time:string;summary:string;conversation:number}[]
  conversations:ChatMessage[][]
  family:FamilyMember[]
  services:ServiceItem[]
  messages:MessageItem[]
  sos:{recipients:string[];states:Record<SosState,{title:string;description:string}>}
  requests:RequestRecord[]
  devices:Device[]
}
