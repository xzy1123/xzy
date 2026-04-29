# AI Application Brief

每天自动抓取 AI 技术应用信息，并通过 Server 酱推送到微信。

## 为什么不一定准点

GitHub Actions 的 `schedule` 不是严格准点闹钟。主触发点是北京时间每天 17:30，对应 `30 9 * * *` UTC；仓库还配置了 17:47 和 18:13 两个兜底触发点。GitHub 在负载高时可能延迟甚至丢弃 scheduled workflow，所以实际收到时间可能晚于 cron 时间。

workflow 会先检查当天是否已经生成过简报，已生成则跳过，避免重复推送。

## 信息源

- OpenAI News
- Hugging Face Blog
- Product Hunt
- GitHub 近期活跃 AI 项目
- Hacker News 开发者讨论
- 知乎热榜 AI 条目
- V2EX 热门 / 最新 / AI / 程序员 / 分享创造节点
- Hugging Face Papers 研究转应用信号

## GitHub Secrets

必需：

- Name: `SERVERCHAN_SENDKEY`
- Value: 你的 Server 酱 SendKey

可选，但推荐：

- Name: `DEEPSEEK_API_KEY`
- Value: 你的 DeepSeek API Key

配置 `DEEPSEEK_API_KEY` 后，脚本会调用 DeepSeek Chat Completions API，把原始素材改写成更自然的中文应用简报；没有配置时会自动退回本地模板。

## 可选变量

仓库 `Actions variables` 可配置：

- Name: `DEEPSEEK_MODEL`
- Value: `deepseek-v4-flash`

不配置时默认使用 `deepseek-v4-flash`。

## 手动测试

进入仓库的 `Actions` 页面，选择 `AI Application Brief`，点击 `Run workflow`。
