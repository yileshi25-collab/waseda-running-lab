# Waseda Running Lab — Google 登录启用指南

网站 GitHub Pages：https://yileshi25-collab.github.io/waseda-running-lab/
Supabase 项目：https://supabase.com/dashboard/project/oflrjljywtqpgrcetwob
本指南只需配置 Google Cloud OAuth + Supabase Google Provider。**不需要 SMTP、邮箱模板、Turnstile 新设置，也不需要重新运行数据库 SQL。**

## 1. 在 Google Cloud 创建 OAuth 应用

1. 打开 https://console.cloud.google.com/auth/overview 并选择 Google Cloud 项目；没有就创建名为 `Waseda Running Lab` 的项目。
2. 若系统提示配置 Google Auth Platform，进入 **Branding**，填写 App name `Waseda Running Lab`，User support email 选择你的邮箱，Developer contact information 选择你自己的邮箱，按屏幕要求保存。
3. **Audience** 选择 **External**（允许其他 Google 账号）。如果你希望把网页链接发给朋友，让朋友直接用 Google 登录而不用逐个添加邮箱，推荐将 **Publishing status → Publish app（In production）**。只请求基础身份范围 openid / email / profile；Google 最新政策允许这类 Testing 应用不通过 Test users 名单登录，但公开使用建议发布。
4. **Data Access / Scopes** 仅需要 `openid`、`.../auth/userinfo.email` 和 `.../auth/userinfo.profile`。不要随意增加 Gmail、Drive 等更高权限。
5. 打开 **Clients** → **Create client**（或 Create OAuth client ID），**Application type** 选择 **Web application**。
6. 设置 **Name**：`Waseda Running Lab Web`。

**Authorized JavaScript origins** 只填域名根（不能加路径）：

    https://yileshi25-collab.github.io

**Authorized redirect URIs** 必须准确填写 Supabase 的回调地址（不能改成 GitHub Pages）：

    https://oflrjljywtqpgrcetwob.supabase.co/auth/v1/callback

7. 点击 **Create**。复制创建后的 **Client ID** 和 **Client Secret**。Client Secret 是机密，只能填写到 Supabase 后台；不可发送聊天、上传 GitHub 或粘贴进公开 JavaScript。

## 2. 在 Supabase 启用 Google

1. 打开 https://supabase.com/dashboard/project/oflrjljywtqpgrcetwob/auth/providers
2. 进入 **Google**，开启 **Enable sign in with Google**（菜单文字可能略有变化）。
3. 将 Google Cloud 刚取得的 **Client ID** 填入 Client ID，**Client Secret** 填入 Client Secret。
4. Google Provider 页面显示的 Callback URL 应为：

    https://oflrjljywtqpgrcetwob.supabase.co/auth/v1/callback

5. 点击 **Save**。不要在网站 JavaScript 配置中填写 Google Client Secret。

## 3. 确认 Supabase 回到网站的网址

打开 https://supabase.com/dashboard/project/oflrjljywtqpgrcetwob/auth/url-configuration

**Site URL**：

    https://yileshi25-collab.github.io/waseda-running-lab/

**Redirect URLs** 至少包含：

    https://yileshi25-collab.github.io/waseda-running-lab/

网站调用 Supabase `auth.signInWithOAuth({provider:'google'})`，先到 Google、再回 Supabase `/auth/v1/callback`，最后返回 GitHub Pages。网站使用客户端公开 publishable key；不需要把 Google Client ID/Secret 写入 GitHub。

## 4. 测试与开放

1. 打开 https://yileshi25-collab.github.io/waseda-running-lab/#community
2. 点击 **使用 Google 账号登录** → 选择账号 → 同意授权 → 返回网站。
3. 页面应显示 **已登录：你的邮箱** 和 **发布比赛成绩或照片** 表单。
4. 如果提示 `access_denied`：确认 Google Cloud **Audience → External** 与 OAuth 应用发布状态，并检查 Google Cloud / Google Workspace 账户政策。Testing 且请求敏感权限时才需要额外核实 Test users。
5. 如果提示 `redirect_uri_mismatch`：检查 Google Cloud 的 **Authorized redirect URIs** 是否精确等于 Supabase 回调地址（注意末尾不要多加 `/`）。
6. 如果提示 `provider is not enabled`：检查 Supabase Authentication → Sign In / Providers → Google 是否已开启并保存。
7. 分享给朋友共同使用时，建议到 Google Cloud **Audience → Publish app（In production）**，确保无需逐个配置测试邮箱。此举会开放 Google 登录给符合条件的 Google 用户，不是只限知道链接的人；仍需保留投稿权限、举报和防刷机制。

**安全提示**

- Google 登录成功 ≠ 自动获得管理员权限。你须从 Supabase Auth → Users 获取自己的 Google 登录用户 UID，加入 `public.wsd_community_admins` 才能管理举报。
- 所有人的即时投稿仍受原数据库的 RLS、1/分钟、6/小时、20/天的限流，以及 JPEG ≤2MB 的 Storage 规则约束；未经核实的社区成绩不会覆盖官方 PB。
- Client Secret、数据库密码、`sb_secret_`、`service_role` 绝不可暴露在 GitHub 或聊天中。
- 使用社交登录时，不需要配置或关闭 Supabase 的 Cloudflare Turnstile CAPTCHA 功能；该验证码主要关联 Supabase 对相应认证请求的防机器人控制。

官方文档：https://supabase.com/docs/guides/auth/social-sign-in/auth-google
Google Cloud 文档：https://developers.google.com/identity/protocols/oauth2/web-server
Supabase Redirect URL 文档：https://supabase.com/docs/guides/auth/redirect-urls

## 多人协作权限的边界

- 分享网址后，其他人可以登录后**新增**照片和赛事成绩；目前的社区投稿会立即公开。
- 其他人**不能直接修改现有 2025/2026 官方赛果、PB 或他人的投稿**。这是刻意的权限隔离，避免误操作或恶意覆盖。
- 如果未来希望允许修改，建议先实现“作者可修改自己的社区投稿，管理员能更正和撤下”，并在数据库 RLS 中单独授予权限，而非开放所有人修改所有记录。
- Google OAuth 的 In production 登录对外开放，不等于仅限“拥有链接的人”；公开网址也可能被其他人发现。

Google 官方 OAuth 应用状态说明：https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
