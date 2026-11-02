# SpeakPen Sync

[English](README.md) · [简体中文](README.zh-CN.md)

把 [SpeakPen](https://speakpen.app) 的语音笔记同步为 Obsidian 中的普通 Markdown，供你阅读、编辑或交给自己选择的 AI 使用。

## 使用前提

需要 SpeakPen 账号、只读 API token，以及到 speakpen.app 的网络连接。插件本身免费，不提供独立录音或转写。SpeakPen 免费计划每月 3 次录音、每次最多 5 分钟；Pro 为每月 9.90 美元，每月 60 次、每次最多 20 分钟。

## 安装与同步

1. 在 Obsidian 的设置 → 第三方插件中搜索并安装 SpeakPen Sync。
2. 在 [SpeakPen 网页](https://speakpen.app/app)的设置 → 连接中，通过 Obsidian 卡片生成 token。
3. 打开 Obsidian → SpeakPen Sync 设置，粘贴 token，选择笔记目录。
4. 自动同步开启时，Obsidian 启动就绪后检查一次，回到前台适当补查（至少间隔一分钟），可见时默认每五分钟检查。关闭 Obsidian 后不会继续同步。
5. 也可从插件设置、侧栏按钮或命令面板手动同步。

只有一次同步全部成功才更新最近成功时间；部分写入失败、目录移动失败或本地编辑冲突会显示未完成或待 review，可以重试。手机设置页同样显示状态。

## 笔记如何更新

- 新笔记写入指定目录，SpeakPen 中更新后在原文件更新；SpeakPen 改名不会自动重命名已有文件。
- 你在 Obsidian 中编辑过的内容不会被覆盖。需自行比较两端；插件不会把 vault 修改上传回 SpeakPen。
- 手动删除或移动的文件，在对应云端笔记下次变化时可能重新写入同步目录；插件不传播删除。
- 修改同步目录会移动已有追踪文件；移动失败的文件会继续重试。
- 早于 0.3.0 的记录只有 ID，无法安全更新或移动，继续保留以防重复。
- 原始转写和摘要分开。摘要等待或失败时保留原文，不把原文叫作已经完成的摘要。

每条笔记包含 speakpen_id、标题、分类、录音时间、同步时间等 frontmatter，以及可用的摘要与原始转写。是普通 Markdown，不依赖专属阅读器。

## 账号与隐私

每次同步仅向 speakpen.app 发送只读 GET：/api/v1/me 确认稳定账号 ID，/api/v1/ideas 获取变动笔记及分页。插件不下载音频、不在笔记里保存临时音频链接、不上传 vault、不收集遥测。

同账号换 token 复用游标，不同账号隔离追踪状态。换 token 会立即撤销旧请求发起后续写入的资格；已发起的文件系统操作可能完成，其检查点只记在原账号。切换账号不会删除原有笔记。首次升级旧版会完整核对一次，以匹配当前账号的旧记录，不复用未经确认的游标。

token 和插件状态保存在 vault 的 .obsidian/plugins/speakpen-sync/data.json 中，属于明文插件设置；同步或提交整个 vault 时会一起带走。可以在 SpeakPen 的连接设置随时撤销。若 vault 使用 Git，可在 .gitignore 中加入 .obsidian/plugins/*/data.json。

## 手动安装与开发

从 [GitHub Release](https://github.com/Qumge/speakpen-obsidian/releases) 下载 main.js 和 manifest.json，放入 vault/.obsidian/plugins/speakpen-sync/，重新加载并启用插件。

开发验证：npm ci、npm test、npm run build。详见 [English README](README.md)。
