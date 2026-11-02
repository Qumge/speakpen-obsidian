import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { makeIdea, makeIdeasResponse } from "./helpers";

vi.mock("obsidian", () => ({
  Plugin: class {
    app: any;
    persisted: any = null;
    status = { text: "", setText(t: string) { this.text = t; } };
    cleanups: (() => void)[] = [];
    async loadData() { return this.persisted; }
    async saveData(data: unknown) { this.persisted = JSON.parse(JSON.stringify(data)); }
    addStatusBarItem() { return this.status; }
    addRibbonIcon() {} addCommand() {} addSettingTab() {} registerInterval() {}
    registerDomEvent(target: EventTarget, type: string, callback: EventListener) {
      target.addEventListener(type, callback);
      this.cleanups.push(() => target.removeEventListener(type, callback));
    }
  },
  PluginSettingTab: class {},
  Setting: class {},
  Notice: class { constructor(public message: string) {} },
  normalizePath: (s: string) => s.replace(/\/+/g, "/"),
  requestUrl: vi.fn(),
}));
import Plugin from "../src/main";
import { requestUrl } from "obsidian";
const http = vi.mocked(requestUrl);

class TestVault {
  files = new Map<string, string>();
  failWrites = false;
  getAbstractFileByPath(path: string) { return this.files.has(path) ? {path} : null; }
  getFileByPath(path: string) { return this.getAbstractFileByPath(path); }
  async createFolder() {}
  async create(path: string, content: string) {
    if (this.failWrites) throw new Error("filesystem private diagnostics");
    if (this.files.has(path)) throw new Error("exists");
    this.files.set(path, content); return {path};
  }
  async read(f: {path: string}) { return this.files.get(f.path)!; }
  async modify(f: {path: string}, c: string) { this.files.set(f.path,c); }
  async rename(f: {path: string}, p: string) { this.files.set(p,this.files.get(f.path)!); this.files.delete(f.path); }
}
let visibility = "visible";
let win: EventTarget;
let doc: EventTarget;
const settle = async () => { for (let i=0;i<30;i++) await Promise.resolve(); };
async function setup() {
  const p: any = new (Plugin as any)();
  const vault = new TestVault();
  let ready: (() => void) | undefined;
  p.app = {vault, workspace: {onLayoutReady(cb: () => void) { ready=cb; }}};
  p.persisted = {settings: {apiToken:"alpha", autoSyncEnabled:true}};
  http.mockImplementation(async (options: any) => ({status:200,json:options.url.endsWith("/me") ? {data:{id:"owner-a"}} : makeIdeasResponse([makeIdea()])}) as any);
  await p.onload();
  return {p, vault, ready: () => ready?.()};
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
  vi.resetAllMocks(); visibility="visible";
  win = new EventTarget(); Object.assign(win,{setInterval,clearInterval});
  doc = new EventTarget(); Object.defineProperty(doc,"visibilityState",{get:() => visibility});
  vi.stubGlobal("window",win); vi.stubGlobal("document",doc);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("plugin synchronization lifecycle", () => {
  it("checks on workspace ready and coalesces foreground events for one minute", async () => {
    const {p,vault,ready}=await setup();
    expect(vault.files.size).toBe(0); ready(); await settle();
    expect(vault.files.size).toBe(1);
    const count=http.mock.calls.length;
    win.dispatchEvent(new Event("focus")); doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(http.mock.calls.length).toBe(count);
    vi.advanceTimersByTime(60_000);
    win.dispatchEvent(new Event("focus")); doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(http.mock.calls.length).toBe(count+2);
    p.onunload();
    vi.advanceTimersByTime(600_000); win.dispatchEvent(new Event("focus")); await settle();
    expect(http.mock.calls.length).toBe(count+2);
  });
  it("pauses hidden interval checks and catches up on visible", async () => {
    const {p,ready}=await setup(); ready(); await settle(); const count=http.mock.calls.length;
    visibility="hidden"; vi.advanceTimersByTime(300_000); await settle();
    expect(http.mock.calls.length).toBe(count);
    visibility="visible"; doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(http.mock.calls.length).toBe(count+2); p.onunload();
  });
  it("does not mark a partially failed pass as successfully synced and recovers without duplicates", async () => {
    const {p,vault}=await setup(); vault.failWrites=true;
    await p.runSync(); expect(p.syncState.lastSyncTime).toBeNull();
    expect(p.status.text).toContain("incomplete");
    expect(p.status.text).not.toContain("private diagnostics");
    vault.failWrites=false; await p.runSync(); await p.runSync();
    expect(vault.files.size).toBe(1); expect(p.syncState.lastSyncTime).not.toBeNull(); p.onunload();
  });
  it("ignores a late response after token replacement and isolates account cursors", async () => {
    const {p,vault}=await setup();
    let deliver!: (v: unknown) => void;
    http.mockImplementationOnce(async () => ({status:200,json:{data:{id:"owner-a"}}}) as any)
      .mockImplementationOnce(() => new Promise(resolve => {deliver=resolve;}) as any);
    const old=p.runSync(); await settle();
    const replacement=p.setApiToken("beta");
    http.mockImplementation(async (o:any) => ({status:200,json:o.url.endsWith("/me") ? {data:{id:"owner-b"}} : makeIdeasResponse([makeIdea({id:"idea-b"})])}) as any);
    deliver({status:200,json:makeIdeasResponse([makeIdea({id:"old-private"})])});
    await old; await replacement; await p.runSync();
    expect([...vault.files.values()].some(c=>c.includes('speakpen_id: "old-private"'))).toBe(false);
    expect(Object.keys(p.syncState.notes)).toEqual(["idea-b"]);
    const fetch=http.mock.calls.filter(([o]:any)=>o.url.includes("/ideas"));
    expect((fetch[fetch.length-1][0] as any).headers.Authorization).toBe("Bearer beta");
    p.onunload();
  });
  it("shows preserved local edits as needing attention, not a full successful sync", async () => {
    const {p,vault}=await setup(); await p.runSync(); const success=p.syncState.lastSyncTime;
    const [path,content]=[...vault.files.entries()][0]; vault.files.set(path,content+"\nMy own writing");
    http.mockImplementation(async (o:any) => ({status:200,json:o.url.endsWith("/me") ? {data:{id:"owner-a"}} : makeIdeasResponse([makeIdea({attributes:{...makeIdea().attributes,updated_at:"2026-11-02T01:00:00Z"}})])}) as any);
    vi.advanceTimersByTime(61_000); await p.runSync();
    expect(p.syncState.lastSyncTime).toBe(success); expect(p.status.text).toContain("review");
    expect(vault.files.get(path)).toContain("My own writing"); p.onunload();
  });
});

describe("recovery and owner identity",()=>{
 it("reuses the same owner's cursor after rotating the token without duplicating notes",async()=>{
  const {p,vault}=await setup(); await p.runSync();
  await p.setApiToken("rotated-alpha"); await p.runSync();
  const requests=http.mock.calls.filter(([o]:any)=>o.url.includes("/ideas"));
  expect((requests[1][0] as any).url).toContain("updated_since=2026-03-28T10%3A00%3A00Z");
  expect(vault.files.size).toBe(1); p.onunload();
 });
 it("retries a failed folder migration instead of forgetting its old location",async()=>{
  const {p,vault}=await setup(); await p.runSync();
  p.settings.syncFolder="New";
  const original=vault.rename.bind(vault); let failed=true;
  vault.rename=async(f:{path:string},path:string)=>{if(failed) throw new Error("private disk failure");await original(f,path);};
  await p.runSync(); expect(p.syncState.syncFolder).toBe("SpeakPen");
  expect(p.status.text).toContain("incomplete");
  failed=false; await p.runSync();
  expect([...vault.files.keys()]).toEqual(["New/Test Idea - 2026-03-28.md"]); p.onunload();
 });
 it("preserves matching legacy notes on first owner verification without adopting unrelated files",async()=>{
  const {p,vault}=await setup(); await p.runSync();
  const {hashContent}=await import("../src/sync");
  const path=[...vault.files.keys()][0], content=vault.files.get(path)!;
  const q:any=new (Plugin as any)(); q.app=p.app;
  q.persisted={settings:{apiToken:"alpha"},syncState:{notes:{"idea-1":{path,hash:hashContent(content),updatedAt:"2026-03-28T10:00:00Z"},"other-owner":{path:"Private/other.md",hash:"x",updatedAt:"x"}},legacyIds:[],cursor:"2099-01-01",syncFolder:"SpeakPen",lastSyncTime:null}};
  await q.onload(); await q.runSync();
  expect(vault.files.size).toBe(1); expect(Object.keys(q.syncState.notes)).toEqual(["idea-1"]);
  expect((http.mock.calls.at(-1)![0] as any).url).not.toContain("updated_since");
  q.onunload();p.onunload();
 });
 it("revokes a delayed fetch on unload before it can create any note",async()=>{
  const {p,vault}=await setup(); let deliver!:(v:any)=>void;
  http.mockImplementationOnce(async()=>({status:200,json:{data:{id:"owner-a"}}}) as any).mockImplementationOnce(()=>new Promise(resolve=>{deliver=resolve;}) as any);
  const running=p.runSync(); await settle(); p.onunload();
  deliver({status:200,json:makeIdeasResponse([makeIdea()])}); await running;
  expect(vault.files.size).toBe(0);
 });
});

it("starts the replacement account once an obsolete in-flight startup check finally returns",async()=>{
 const {p,vault,ready}=await setup(); let deliver!:(v:any)=>void;
 http.mockImplementationOnce(async()=>({status:200,json:{data:{id:"owner-a"}}}) as any).mockImplementationOnce(()=>new Promise(resolve=>{deliver=resolve;}) as any);
 ready(); await settle(); await p.setApiToken("beta");
 http.mockImplementation(async(o:any)=>({status:200,json:o.url.endsWith("/me") ? {data:{id:"owner-b"}} : makeIdeasResponse([makeIdea({id:"replacement"})])}) as any);
 vi.advanceTimersByTime(1001); await settle();
 deliver({status:200,json:makeIdeasResponse([makeIdea({id:"old"})])}); await settle();
 expect([...vault.files.values()].join("\n")).toContain('speakpen_id: "replacement"');
 expect([...vault.files.values()].join("\n")).not.toContain('speakpen_id: "old"'); p.onunload();
});
