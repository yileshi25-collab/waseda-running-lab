# Waseda Running Lab 2026 · GitHub Pages 发布包

**这是一个非官方的独立研究网页**，不是早稻田大学竞走部的官方网站。已包含原版 38 名长距离选手、历年驿传排名、2026 出云与全日本大学驿传逐区数据，以及上传的《上半赛季成绩回顾》中 12 名选手、73 条记录和 38 项黄色重点标记；该 Word 资料未逐项独立核验。

## 首次发布（只需操作一次）

1. 打开 https://github.com/new 登录 GitHub，创建一个 **Public** 仓库；仓库名称推荐 `waseda-running-lab`，主分支 `main`。公开仓库适用于 GitHub Free 的 GitHub Pages。
2. 在刚创建的仓库首页选择 **Add file → Upload files**，把本包中的 `index.html`、`favicon.svg` 和 `.nojekyll` 上传，点击 **Commit changes**。如果仓库是空的，先进入 **uploading an existing file** 链接上传即可。
3. 进入仓库的 **Settings → Pages**，在 **Build and deployment** 下将 **Source** 改成 **Deploy from a branch**，Branch 选 `main`、文件夹选 `/(root)`，再点 **Save**。
4. 发布完成后，访问 `https://你的GitHub用户名.github.io/waseda-running-lab/`。也可以在仓库的 **Settings → Pages** 页面点 **Visit site** 查看确切网址。
5. 把这个网页地址发给朋友。朋友不必下载 HTML 文件；更新时同一个地址仍然有效。

> 以上地址只是通用格式，**不是真正已经发布的网站**；必须先按步骤部署，才会出现可访问的链接。

## 以后更新数据（网址不变）

在同一个 GitHub 仓库继续修改或替换根目录的 `index.html` 并提交（Commit）；GitHub Pages 会基于 `main` 自动重新发布。可以用 GitHub 网页端的 **Add file → Upload files** 上传新的 `index.html` 覆盖同名文件，或点击 `index.html` 的编辑按钮直接修改。朋友刷新原网站即可看到新版本（部署和缓存刷新可能需要一点时间）。不要再发 `file:///...` 开头的本地路径。

## 收藏、备注与隐私

- **选手数据** 会随着网站文件更新，所有访客看到相同的公开资料。
- **收藏、比较列表、备注、手动导入的 CSV** 存储在每个人自己的浏览器 localStorage 中；彼此**不会共享或同步**，也不会随着网页发布而上传到服务器。
- 以前通过 `file:///...` 本地 HTML 保存的收藏，**不会自动迁移**到新网址。请先在本地 HTML 的“我的收藏”里导出 JSON 备份，再在网站中导入；避免直接丢掉浏览器中的笔记。
- 如果之后需要不同设备之间同步收藏、一个管理员后台在线更新成绩，必须进一步添加数据库与登录 / 管理机制；静态 GitHub Pages 本身不提供这些功能。

## 本包包含

- `index.html`：完整网页，不需要打包工具、npm 或后端
- `favicon.svg`：与深酒红品牌风格搭配的页面图标
- `.nojekyll`：让 GitHub Pages 按静态文件原样发布
- `README.md`：发布与更新步骤

GitHub 官方说明：
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
