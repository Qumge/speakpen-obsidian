import {describe,it,expect,vi} from "vitest";
import {buildMarkdown,syncIdeasToVault,migrateSyncFolder,hashContent} from "../src/sync";
import {makeIdea} from "./helpers";
import {DEFAULT_SYNC_STATE} from "../src/types";
vi.mock("obsidian",()=>({normalizePath:(s:string)=>s}));
const state=()=>({...DEFAULT_SYNC_STATE,notes:{},legacyIds:[]});
describe("session fences at vault boundaries",()=>{
 it("stops before modifying when a token changes during vault.read",async()=>{
  let current=true; let content="old source";
  const idea=makeIdea();
  const s=state(); s.notes[idea.id]={path:"SpeakPen/note.md",hash:hashContent(content),updatedAt:"2025-01-01"};
  const vault:any={getFileByPath:()=>({path:"SpeakPen/note.md"}),getAbstractFileByPath:()=>({}),read:async()=>{current=false;return content;},modify:async(_:unknown,c:string)=>{content=c;}};
  await expect(syncIdeasToVault([idea],"SpeakPen",vault,s,{isCurrent:()=>current})).rejects.toThrow("session");
  expect(content).toBe("old source");
 });
 it("checkpoints an already-issued create but never starts the next write after a token change",async()=>{
  let current=true; const files=new Map<string,string>(); const checkpoints:string[]=[];
  const vault:any={getAbstractFileByPath:()=>null,createFolder:async()=>{},create:async(p:string,c:string)=>{files.set(p,c);current=false;return {path:p};}};
  await expect(syncIdeasToVault([makeIdea({id:"a"}),makeIdea({id:"b"})],"SpeakPen",vault,state(),{isCurrent:()=>current,checkpoint:async n=>{checkpoints.push(...Object.keys(n));}})).rejects.toThrow("session");
  expect(files.size).toBe(1); expect(checkpoints).toEqual(["a"]);
 });
 it("does not start folder renames for an obsolete session",async()=>{
  const vault:any={getAbstractFileByPath:(p:string)=>p === "Old/a.md" ? ({}) : null,getFileByPath:()=>({path:"Old/a.md"}),rename:vi.fn()};
  await expect(migrateSyncFolder({a:{path:"Old/a.md",hash:"a",updatedAt:"a"}},"Old","New",vault,{isCurrent:()=>false})).rejects.toThrow("session");
  expect(vault.rename).not.toHaveBeenCalled();
 });
 it("keeps the cursor at a preserved local edit for future review",async()=>{
  const idea=makeIdea(); const s=state(); s.notes[idea.id]={path:"a",hash:"original-hash",updatedAt:"2025"};
  const vault:any={getAbstractFileByPath:()=>({}),getFileByPath:()=>({path:"a"}),read:async()=>"my edits"};
  const result=await syncIdeasToVault([idea,makeIdea({id:"newer",attributes:{...idea.attributes,updated_at:"2026-11-01T00:00:00Z",status:"pending"}})],"SpeakPen",vault,s);
  expect(result.cursor).toBe("2026-03-28T10:00:00Z");
 });
});
describe("native note Markdown",()=>{
 it.each(["failed","pending","processing","waiting_budget"])("does not label original text as Summary when summary is %s",status=>{
  const idea=makeIdea(); idea.attributes.summary_status=status;
  idea.attributes.message="This is the transcript.";
  const md=buildMarkdown(idea);
  expect(md).not.toContain("## Summary"); expect(md).toContain("## Transcript\n\nThis is the transcript.");
  expect(md).toContain(`summary_status: "${status}"`);
  expect(md).not.toContain("https://speakpen.app/audio");
 });
});
