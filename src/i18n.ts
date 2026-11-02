import * as Obsidian from "obsidian";

const en = {
  syncNow: "Sync now",
  status: "Sync status",
  apiToken: "API token",
  tokenHelp: "Generate a token in the SpeakPen web app at speakpen.app/app, under Settings → Connections (Obsidian card → Generate token), then paste it here.",
  tokenPrivacy: "Like any Obsidian plugin setting, it is saved as plain text in this vault, so it travels with the vault if you sync or commit it. The token is read-only, and you can revoke it in SpeakPen at any time.",
  pasteToken: "Paste your API token",
  folder: "Sync folder",
  folderHelp: "Vault folder where synced notes will be created.",
  folderPlaceholder: "Enter folder name",
  autoSync: "Auto sync",
  autoSyncHelp: "Check when Obsidian opens, when you return to it, and on the interval while it stays open. Foreground checks are limited to once a minute.",
  interval: "Sync interval (minutes)",
  intervalHelp: "How often to check for new ideas (minimum 1 minute).",
  missingToken: "Add your SpeakPen API token in settings, then sync again.",
  notSynced: "Not synced yet.",
  paused: "Sync paused. It will check again while active, or choose Sync now.",
  syncing: "Syncing notes…",
  partial: "Sync incomplete: {count} notes need retry.",
  conflict: "{count} notes need review. Your local edits are preserved.",
  failed: "Sync failed. Check your token and connection, then sync again.",
  synced: "Synced {time}",
  result: "Synced: {created} new, {updated} updated, {moved} moved.",
};
const zh: Record<keyof typeof en, string> = {
  syncNow: "立即同步",
  status: "同步状态",
  apiToken: "API token",
  tokenHelp: "在 speakpen.app/app 的设置 → 连接中，通过 Obsidian 卡片生成 token，再粘贴到这里。",
  tokenPrivacy: "token 与其他插件设置一样，以明文保存在此 vault 中，同步或提交 vault 时会一起带走。token 为只读，可随时在 SpeakPen 撤销。",
  pasteToken: "粘贴 API token",
  folder: "同步目录",
  folderHelp: "同步笔记在此 vault 中的保存目录。",
  folderPlaceholder: "输入目录名称",
  autoSync: "自动同步",
  autoSyncHelp: "Obsidian 启动就绪后检查，回到前台适当补查，并在打开且可见时按间隔检查。前台自动检查至少间隔一分钟。关闭 Obsidian 后不会继续同步。",
  interval: "同步间隔（分钟）",
  intervalHelp: "检查新笔记的间隔，最短一分钟。",
  missingToken: "请先在设置中填写 SpeakPen API token，再重新同步。",
  notSynced: "尚未同步。",
  paused: "同步已暂停。保持 Obsidian 在前台等待补查，也可选择立即同步。",
  syncing: "正在同步笔记…",
  partial: "同步未完成：{count} 条笔记需要重试。",
  conflict: "{count} 条笔记需要核对，你的本地修改已保留。",
  failed: "同步失败。请检查 token 和网络连接，再重新同步。",
  synced: "已同步 {time}",
  result: "已同步：新增 {created} 条，更新 {updated} 条，移动 {moved} 条。",
};

export function translate(key: keyof typeof en, values: Record<string, string | number> = {}): string {
  // getLanguage was introduced after our minimum app version. Older Obsidian
  // keeps its interface locale in moment, so this does not raise the version floor.
  const language = typeof Obsidian.getLanguage === "function"
    ? Obsidian.getLanguage() : Obsidian.moment?.locale() ?? "en";
  const messages = /^zh(?:[-_]|$)/i.test(language) ? zh : en;
  return messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    values[name] === undefined ? placeholder : String(values[name]));
}
