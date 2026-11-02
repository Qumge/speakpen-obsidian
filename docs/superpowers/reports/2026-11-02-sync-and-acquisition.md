# SpeakPen Sync 0.3.3 验证与开源入口

用户正式授权完成 Obsidian 后续改进并合并／发布，同时要求 GitHub 中英文说明和更清楚的 SpeakPen 入口。

实现：启动就绪后检查，前台至少间隔 60 秒补查，默认五分钟轮询；隐藏、卸载及换 token 拦截旧请求的后续网络和文件操作。已有发出的本地写入不能原子撤销，其检查点仅归原账号。稳定 owner 来自已有只读 GET /me，同账号换 token 复用游标，不同账号隔离。无 owner 旧状态持久保存到核对成功，首次完整核对仅采用当前账号返回的 ID。

完整成功才更新最近成功时间；部分失败／编辑冲突分别显示。失败目录移动继续重试，迁入子目录不会重复嵌套移动。摘要等待或失败不把原文叫摘要；兼容旧服务端把 message 与 transcript 同置为原文的情况。插件设置、通知支持中英两种语言，跟随 Obsidian；其他语言回退英文。保留 Obsidian 1.5.7 最低版本。

验证：70 个 Vitest 测试通过，tsc/esbuild 通过。四个独立审查问题均复现后修复。真实桌面 Obsidian 1.14.5 使用独立 profile 和合成 vault，将本地 Rails 原生普通录音和 selected 亮点的真实 JSON 响应注入 HTTP 边界，生成两条普通 Markdown；连续同步、重载插件后仍为两条，无音频 URL，无假 Summary。没有个人数据或真实供应商调用。这不等于生产账号完整交付，也没有用桌面窄屏替代实体手机 Obsidian 验收。

开源入口核对：2026-11-02，GitHub Release main.js 累计 125 次下载；全部资产下载 227 次，不能相加为独立用户。近两周 GitHub Views 0，Clones 24／15 uniques（API 当时返回）；不等于插件安装或付费转化。原 About description／homepage／topics 均为空。

本次补中英文 README、首屏定位／下一步、iOS／Android／Web 官方入口与 token 步骤。GitHub -> SpeakPen 的 URL 带 utm_source=github、utm_medium=readme、utm_campaign=speakpen_obsidian；只加来源参数，没有加遥测 SDK，也未验证现有线上系统可以统计注册／付费归因。因此当前能确认下载与入口存在，不能承诺已有转化闭环。

发布回执由主项目 docs/superpowers/reports/2026-11-02-release-follow-up.md 汇总。真实 iOS/Watch 新自动流程仍需质量验收，不能因插件发布而宣称所有端能力相同。
