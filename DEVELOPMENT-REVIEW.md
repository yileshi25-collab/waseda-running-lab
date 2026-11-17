# 开发接管检查与修复

检查基线：`main` 的 `b0e7e90`。日期：2026-11-17（按会话提供的香港日期）。保留原有静态资料、酒红设计、浏览器收藏和研究笔记。

## 本次修改

| 范围 | 问题及修复 |
| --- | --- |
| 照片上传 | 区分数据库保存与后续刷新；刷新异常不再触发已发布图片的清理。失败保留可重试内容，成功保留表单和明确提示，阻止重复提交。共建页上传后保留照片模式。 |
| 详情页同步 | 背景同步原本重建整个详情，导致表单、预览、成功提示和折叠状态消失。资料未变化时跳过重建；有选中文件、上传、编辑表单或未保存笔记时保护草稿。 |
| 照片管理 | 背景刷新保护照片信息编辑；保存成功后移除编辑器再更新展示。头像选择、焦点调整和先删投稿再清理文件的流程均保留并回归测试。 |
| 两年度新闻 | 从 HTML 提取为 `event-news.js`。使用页面内表单编辑，提供取消、提交锁、失败重试及表单外持久提示；发布后表单保留，清除筛选以显示新闻。两个年度都显示最新一条并折叠其余，刷新保留展开状态；防止旧请求覆盖新筛选结果；来源链接只渲染合法 HTTPS。 |
| Auth | 多模块共用单一客户端，固定 SDK 为 `2.119.0`。Auth 回调用定时任务延后读取用户，避免在回调锁内调用 Auth API。 |
| 手机端 | 输入字号 16px，减少 iOS 自动缩放；照片／新闻操作按钮至少 44px，高度和换行适配窄屏。 |
| 缓存 | 所有本次新增或修改的外部 JS/CSS 引用都带更新版本 `20261117-review1`。内联脚本随 HTML 更新。 |
| 自动验证 | 增加 Playwright、锁文件、语法检查和 PR 工作流。测试模拟数据库和 Auth，拦截 Supabase 网络，不写入线上测试数据。 |

## 已应用的线上权限修复

通过 Supabase migration `harden_community_browser_privileges` 应用；可复核脚本在 `supabase/community-security-hardening.sql`：

- 撤销新闻、基本资料表对 public／anon／authenticated 多余的 TRUNCATE、REFERENCES、TRIGGER 权限。
- 撤销匿名新闻写入权限；保留公开阅读及现有作者／管理员 RLS。
- 新闻更新仅允许内容列，禁止浏览器修改作者、ID、归档年度等身份字段。
- 上传频率检查函数仅允许 authenticated 调用。管理员检查函数保留匿名执行，因为公开读取 RLS 会引用它；函数只返回当前用户是否管理员。

权限回查全部通过：公开读取仍可用，新闻内容可更新、作者不可更新，匿名不能执行裁切和头像 RPC，12 张 public 表全部启用 RLS，投稿作者 UUID 不允许公开读取；Storage 仍为公开 JPEG bucket，文件上限 2 MiB。文件路径规则已通过实际 SQL 正例验证。修复前后新闻 1 条、基本资料 26 条、社区投稿 15 条，未执行记录删除、数据库重置或文件清理。

## 验证

运行：`npm ci`、`npm run check`、`npm test`。本机使用 `/usr/bin/chromium`；其他环境先运行 `npx playwright install --with-deps chromium`，也可设置 `CHROMIUM_PATH`。

- `npm run check` 通过：全部根目录 JS 和 3 段内联脚本。
- `npm test`：12 项全部通过（38.5 秒）。
- 浏览器测试覆盖 2026／2027 新闻投稿、编辑、删除、折叠、游客限制、失败保留草稿、危险来源链接；真实 canvas 图片重编码、上传成功、刷新失败不删图、投稿失败清理、照片信息编辑、Auth 刷新保留草稿、焦点调整、头像切换、删除、375px 窄屏及共建照片模式。
- 线上只读 API 冒烟：新闻和社区投稿公开字段 HTTP 200；匿名读取投稿 `author_id` 返回 HTTP 401。
- 线上 SQL 验证最小权限和 RLS；重新运行 security／performance／health advisors。Health 无告警。

## 仍需跟进的事项与验证限制

1. Google OAuth 完整跳转、真实登录用户的线上写入及 iOS／Android 真机触摸，尚未端到端验收。本轮浏览器写操作使用模拟 Supabase，不能替代线上双账号权限验收。未创建测试用户或污染正式数据。
2. 投票的两个统计视图仍触发 [Security Definer View 告警](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)。已核对定义：只公开总数和每区选手票数；切换到 invoker 会影响私有投票表的统计访问，需要单独设计后再迁移。
3. 部分受保护 RPC 的 SECURITY DEFINER 执行告警仍存在；裁切／头像函数已有身份、所有权或管理员检查、固定 search_path，匿名没有执行权。不要仅为消除告警改成 invoker，否则跨作者清除旧头像等功能可能失效。
4. Auth 的 [泄露密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) 未启用。本轮保留现有 Google 登录配置。
5. 档案和基本资料仍按现有规则允许登录用户共同编辑，基本资料也允许共同删除；未擅自改成私有作者制。应根据社区管理要求另行决定是否增加审核、历史恢复或管理员限制。
6. 新闻查询最多 100 条，社区投稿最多 1000 条；更早的数据仍在数据库中，但需要分页才能全部显示。Storage 删除失败可能保留孤立文件，现有界面会提示管理员处理。
7. Performance advisor 仍报告 3 个缺少外键索引、部分 RLS 初始化计划及多策略等建议；未为小数据量擅自改动索引和策略。

前端必须经过 PR 合并和 GitHub Pages 部署才会对线上用户生效；本次未合并 main。线上最小权限修复已经单独生效。
