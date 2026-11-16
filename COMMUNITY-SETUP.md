# Waseda Running Lab · 跑友即时上传启用指南

你的现有网站继续由 GitHub Pages 展示；协作数据存放 Supabase Auth / PostgreSQL / Storage / Realtime。前端已添加，但数据库没有配置完成前会保持关闭。

## 1. 在 Supabase 建项目并创建数据库

1. 登录 https://supabase.com/dashboard，新建一个由你控制的项目。
2. 打开 SQL Editor，从仓库 supabase/community.sql 复制完整 SQL，运行一次。
3. 验证建立了 public.wsd_community_submissions、public.wsd_community_reports、public.wsd_community_admins。
4. 在 Storage 确认 wsd-community-photos bucket 是 Public，允许 image/jpeg，单图不超过 2MB。
5. 在 Realtime 设置中确认实时服务开启，数据库脚本已将 wsd_community_submissions 加入 supabase_realtime 发布表。

## 当前版本：Google 登录与赛事协作

现在使用 **Google OAuth 登录**，不再使用电子邮件六位验证码。以下“邮箱六位验证码”章节仅供历史参考；请按 `GOOGLE-OAUTH-SETUP.md` 配置 Google Provider。

登录用户可在 2026 年度赛果旁直接补充／修正日期，原始 176 条 Word/CSV 记录不变；日期修正保存为独立的社区记录。发布的新赛事自动加入相应选手的 2026 年度成绩或 2025 年归档，并标注为未经独立核实。作者可以删除自己的赛事、照片和日期修订；管理员可以删除任何人的投稿和修订。

**首次部署需要依序执行两个 SQL 文件：** `supabase/community.sql` 和 `supabase/community-date-corrections.sql`。现有项目只需要执行后者一次；重复运行也不会删除已提交的数据。

## 邮箱六位验证码登录（旧版，当前不使用）

为了避免邮箱安全扫描提前消耗 Magic Link（表现为 403: Email link is invalid or has expired），
网站支持直接输入六位数字的 OTP 登录。需要将 Supabase 的邮件模板改为发数字验证码：

1. 打开 https://supabase.com/dashboard/project/oflrjljywtqpgrcetwob/auth/templates
2. 选择 **Magic Link**，把正文改为：

    <h2>Waseda Running Lab 登录验证码</h2>
    <p>请回到网站输入这 6 位验证码：</p>
    <p><strong>{{ .Token }}</strong></p>
    <p>如果不是你本人发起的登录，请忽略这封邮件。</p>

3. 保存。如首次注册使用 **Confirm Signup** 邮件模板，也要在该模板正文中加入 `{{ .Token }}`，并去掉直接跳转的 `{{ .ConfirmationURL }}` 链接。
4. 在网站发送新邮件，回到「跑友共建」，将邮件中的数字填入验证码输入框，点击「验证并登录」。
5. 不要向任何人发送邮件验证码、完整登录链接或会话 token。

官方参考：https://supabase.com/docs/guides/auth/auth-email-passwordless
## 2. 设置邮箱登录与防机器人

1. Supabase Authentication → Providers → Email：启用邮箱登录及用户注册。
2. Authentication → URL Configuration：Site URL 设置为 https://yileshi25-collab.github.io/waseda-running-lab/ ，Redirect URLs 添加 https://yileshi25-collab.github.io/waseda-running-lab/** 。
3. 在 https://dash.cloudflare.com/ 的 Turnstile 创建验证码，允许域名 yileshi25-collab.github.io，取得 Site key 与 Secret key。
4. Supabase Authentication → Bot and Abuse Protection → CAPTCHA protection，选择 Cloudflare Turnstile，填入 Secret key。Secret key 只允许保存在 Supabase 管理界面，不能上传 GitHub。
5. 公共网站大量邮箱登录时，应设置自己的 SMTP 邮件服务与 Supabase Auth 邮件速率限制。

## 3. 打开投稿功能

在 GitHub 仓库根目录找到 community-config.js，将配置改为：

    window.WSD_COMMUNITY_CONFIG = Object.freeze({
      url: "https://YOUR-PROJECT.supabase.co",
      publishableKey: "sb_publishable_YOUR_PUBLIC_KEY",
      turnstileSiteKey: "YOUR_PUBLIC_TURNSTILE_SITE_KEY",
      enabled: true
    });

从 Supabase Dashboard 中复制 Project URL 与 publishable key（或旧版 anon key）。Turnstile Site key 也可以公开。
绝对不要复制 service_role、sb_secret_、数据库密码、JWT secret 或 Turnstile Secret key 到任何公开网页或 GitHub 仓库！

启用后入口：https://yileshi25-collab.github.io/waseda-running-lab/#community

## 4. 把你自己的登录账号设为管理员

1. 从网页以自己的邮箱成功登录一次。
2. Supabase Authentication → Users，复制你自己的 User UID。
3. 在 Supabase SQL Editor 执行：

    insert into public.wsd_community_admins (user_id)
    values ('YOUR-USER-UUID-HERE')
    on conflict do nothing;

4. 刷新网站，再打开跑友共建页面。管理员可查看举报、隐藏不当投稿并尝试删除违规照片文件。

## 5. 必须测试的场景

- 未登录：仅可查看公开社区帖子，不能提交或举报。
- 邮箱用户 A：通过 Turnstile 验证登录，可投稿有来源的赛事成绩和有权公开的照片。
- 另一浏览器 B：收到投稿应实时显示；若实时服务未启用，重新加载也应能看到。
- 同一账号快速提交：数据库应执行 1 条/分钟、6 条/小时、20 条/日限制；照片还另有限额。
- 照片经浏览器 JPEG 重编码去除 EXIF 元信息；Storage 再次强制 2MB / JPEG。
- 举报需要登录，管理员能查看和撤下；普通人不能修改或删除他人的投稿。
- 访客投稿不能更改 2025/2026 原有赛事、官方 PB、选手数据库与收藏。

## 权利和安全提醒

- **即时公开不等于经核实**。跑友投稿需要展示来源，不能自动覆盖官方成绩。
- 照片投稿必须有拍摄者的许可、公开再发布授权或公共领域依据，并注明署名。可以查看官网，不代表拥有直接转载权。
- 不要上传住址、私人联络方式、医疗记录或具有隐私风险的图片。
- 公共图片如果被截图或缓存，即使管理员后来删除，也无法保证彻底收回。
- 若社区流量扩大，建议再增加 Edge Function 的 IP 级限流、恶意内容扫描、图像审核以及数据库/存储备份。
- 社区最多读取最新 1000 条投稿；流量扩大后应添加服务端分页。

## 项目文件

- index.html：原网站与跑友共建导航
- community.css：社区界面样式
- community.js：Google 登录、照片和成绩投稿、日期修订、实时列表、举报与作者/管理员删除
- community-config.js：仅包含公开密钥和 Project URL，默认关闭
- supabase/community.sql：社区照片与赛果表的 RLS 与服务端限制
- supabase/community-date-corrections.sql：2026 年度日期修订表及作者/管理员 RLS 权限

参考：https://supabase.com/docs/guides/auth/auth-captcha
参考：https://supabase.com/docs/guides/database/postgres/row-level-security
参考：https://supabase.com/docs/guides/storage/buckets/fundamentals

## 选手头像与照片集（已部署）

- 每位选手默认使用按发布时间最早的第一张照片作为头像；其他照片进入选手详情页的「其他照片」相册，点击能查看完整图片。
- 投稿者可为自己上传的照片点击「调整显示位置」，拖动照片或使用横向／纵向滑块，同时查看帖子横向裁切和方形头像预览。
- 投稿者可以把自己上传的照片「设为头像」；管理员可以设置任意照片。数据库会取消前一张的主头像标记。
- 当头像被删除时自动回退至剩余照片中最早上传的一张；没有照片则显示占位图。
- 调整只改变网站 CSS 的 object-position 显示焦点，原始 JPEG 在 Storage 中保持不变，点击图片可查看原图。
- 后端增量 SQL 文件：supabase/community-photo-covers.sql，线上项目已经执行，无需重建已有表。
- 修改通过受严格账号身份校验的 wsd_update_photo_crop 和 wsd_set_photo_primary RPC，只有投稿者或管理员有操作权。
- 照片外观通过 Supabase 数据表同步，其他浏览者重新加载或 Realtime 收到变更后可以看到。
