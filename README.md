# AI Application Brief

每天 17:30（Asia/Hong_Kong / Asia/Shanghai）自动抓取 AI 技术应用信息并通过 Server 酱推送到微信。

## 信息源

- OpenAI News
- Hugging Face Blog
- Product Hunt
- GitHub 近期活跃 AI 项目
- Hacker News 开发者讨论
- 知乎热榜 AI 条目
- Hugging Face Papers / arXiv 研究转应用信号

## GitHub Secret

仓库需要已有 Secret：

- Name: `SERVERCHAN_SENDKEY`
- Value: 你的 Server 酱 SendKey

路径：`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

## 定时任务

GitHub Actions 使用 UTC 时间，workflow 中的 `30 9 * * *` 对应北京时间每天 17:30。

## 手动测试

进入仓库的 `Actions` 页面，选择 `AI Application Brief`，点击 `Run workflow`。
