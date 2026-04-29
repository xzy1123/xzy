const fs = require("fs");
const path = require("path");

const SERVERCHAN_SENDKEY = process.env.SERVERCHAN_SENDKEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const OUT_DIR = path.join(__dirname, "ai-briefs");
const ZHIHU_HOT_URL = "https://www.88vip.work/search";
const MAX_ITEMS_PER_SOURCE = Number(process.env.MAX_ITEMS_PER_SOURCE || 6);

const AI_KEYWORDS = [
  "AI", "AIGC", "AGI", "LLM", "GPT", "OpenAI", "Claude", "Gemini", "DeepSeek", "Qwen", "Kimi", "Llama", "Mistral", "Hugging Face", "agent", "agents", "RAG", "copilot",
  "生成式", "人工智能", "大模型", "模型", "机器学习", "深度学习", "智能体", "机器人", "自动驾驶", "豆包", "通义", "千问", "文心", "混元", "罗福莉", "黄仁勋", "Sora", "Midjourney", "Stable Diffusion",
];

function localDateParts() {
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
}
function nowLocal() { const p = localDateParts(); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; }
function stamp() { const p = localDateParts(); return `${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}`; }

function stripHtml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function decodeText(text) { let value = stripHtml(text); for (let i = 0; i < 2; i += 1) value = stripHtml(value); return value; }
function truncate(text, length = 180) { const value = String(text || "").replace(/\s+/g, " ").trim(); return value.length > length ? `${value.slice(0, length)}...` : value; }

function isAI(text) {
  const haystack = String(text || "");
  return AI_KEYWORDS.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (/^[A-Za-z0-9 .+-]+$/.test(keyword)) return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(haystack);
    return new RegExp(escaped, "i").test(haystack);
  });
}

function applicationLens(title, desc = "") {
  const text = `${title} ${desc}`.toLowerCase();
  if (/agent|computer use|browser|workflow|automation|智能体|自动化|办公/.test(text)) return "Agent / 自动化工作流";
  if (/code|coding|developer|dev|repo|github|cli|ide|programming|编程|开发/.test(text)) return "开发工具 / 工程效率";
  if (/image|video|audio|voice|speech|music|3d|vision|multimodal|图像|视频|语音|多模态|视觉/.test(text)) return "多模态 / 内容生产";
  if (/rag|retrieval|search|knowledge|database|vector|memory|搜索|知识库|检索|向量/.test(text)) return "知识库 / 搜索增强";
  if (/customer|sales|support|crm|enterprise|business|meeting|email|企业|客服|销售|会议|邮件/.test(text)) return "企业应用 / 业务提效";
  if (/robot|robotics|driving|vehicle|\bcar\b|autonomous|机器人|自动驾驶|汽车/.test(text)) return "机器人 / 车端智能";
  if (/model|llm|gpt|claude|gemini|deepseek|qwen|llama|mistral|模型|大模型/.test(text)) return "模型能力 / 应用底座";
  return "AI 应用观察";
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { "User-Agent": "Mozilla/5.0 AI-Application-Brief/3.0", ...(options.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}
async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { "User-Agent": "Mozilla/5.0 AI-Application-Brief/3.0", Accept: "application/json, application/vnd.github+json", ...(options.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function parseRssItems(xml, limit = MAX_ITEMS_PER_SOURCE) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/g) || [];
  return blocks.map((block) => {
    const title = decodeText((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
    const link = (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || decodeText((block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]);
    const desc = decodeText((block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || (block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]);
    return { title, url: link, desc };
  }).filter((item) => item.title && item.url).slice(0, limit);
}

async function collectZhihuHotAI() {
  const html = await fetchText(ZHIHU_HOT_URL);
  const start = html.indexOf("知乎热榜");
  if (start < 0) return [];
  const nextCard = html.indexOf('<div class="search-hot-card">', start + 10);
  const block = html.slice(start, nextCard > start ? nextCard : start + 40000);
  const itemRegex = /<li>[\s\S]*?<span class="search-hot-rank(?:[^"]*)">(\d+)<\/span>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="search-hot-value">([\s\S]*?)<\/span>[\s\S]*?<\/li>/g;
  const items = [];
  let match;
  while ((match = itemRegex.exec(block))) {
    const title = decodeText(match[3]);
    if (!isAI(title)) continue;
    items.push({ source: "知乎热榜", title, url: match[2], metric: `#${Number(match[1])} / ${decodeText(match[4])}`, area: applicationLens(title), note: "中文社区正在讨论的 AI 相关话题。" });
  }
  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectV2exAI() {
  const endpoints = [
    "https://www.v2ex.com/api/topics/hot.json",
    "https://www.v2ex.com/api/topics/latest.json",
    "https://www.v2ex.com/api/topics/show.json?node_name=ai",
    "https://www.v2ex.com/api/topics/show.json?node_name=programmer",
    "https://www.v2ex.com/api/topics/show.json?node_name=create",
  ];
  const all = [];
  for (const url of endpoints) {
    try { const items = await fetchJson(url); if (Array.isArray(items)) all.push(...items); } catch {}
  }
  const unique = new Map();
  for (const item of all) {
    const title = item.title || "";
    const content = item.content || item.content_rendered || "";
    const node = item.node && (item.node.title || item.node.name);
    if (!isAI(`${title} ${content} ${node || ""}`)) continue;
    const id = item.id || item.url;
    if (!unique.has(id)) unique.set(id, { source: "V2EX", title, url: item.url || `https://www.v2ex.com/t/${item.id}`, metric: `${node || "社区"} / ${item.replies || 0} 回复`, area: applicationLens(title, content), note: truncate(stripHtml(content), 120) || "开发者社区里的 AI 应用讨论。" });
  }
  return [...unique.values()].slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectProductHuntAI() {
  const xml = await fetchText("https://www.producthunt.com/feed");
  return parseRssItems(xml, 30).filter((item) => isAI(`${item.title} ${item.desc}`)).slice(0, MAX_ITEMS_PER_SOURCE).map((item) => ({ source: "Product Hunt", title: item.title, url: item.url, metric: "新产品", area: applicationLens(item.title, item.desc), note: truncate(item.desc, 140) }));
}

async function collectHackerNewsAI() {
  const since = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
  const queries = ["AI agent", "LLM", "OpenAI", "Claude", "DeepSeek"];
  const hits = [];
  for (const query of queries) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=10`;
    const data = await fetchJson(url);
    hits.push(...(data.hits || []));
  }
  const unique = new Map();
  for (const hit of hits) if (!unique.has(hit.objectID)) unique.set(hit.objectID, hit);
  return [...unique.values()].filter((hit) => isAI(`${hit.title || ""} ${hit.story_text || ""}`)).sort((a, b) => (b.points || 0) + (b.num_comments || 0) - ((a.points || 0) + (a.num_comments || 0))).slice(0, MAX_ITEMS_PER_SOURCE).map((hit) => ({ source: "Hacker News", title: hit.title || "(untitled)", url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, metric: `${hit.points || 0} points / ${hit.num_comments || 0} comments`, area: applicationLens(hit.title || "", hit.story_text || ""), note: "海外开发者社区正在讨论的 AI 应用或工程话题。" }));
}

async function collectGithubAI() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const queries = [`topic:ai-agent pushed:>=${since} stars:>100`, `topic:llm pushed:>=${since} stars:>300`, `topic:rag pushed:>=${since} stars:>100`, `topic:generative-ai pushed:>=${since} stars:>100`];
  const repos = [];
  for (const query of queries) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=5`;
    const data = await fetchJson(url);
    for (const repo of data.items || []) repos.push({ source: "GitHub", title: repo.full_name, url: repo.html_url, metric: `${repo.stargazers_count} stars / 更新 ${repo.pushed_at ? repo.pushed_at.slice(0, 10) : ""}`, area: applicationLens(repo.full_name, repo.description || ""), note: truncate(repo.description || "", 140) });
  }
  const unique = new Map();
  for (const repo of repos) if (!unique.has(repo.title)) unique.set(repo.title, repo);
  return [...unique.values()].sort((a, b) => Number((b.metric.match(/\d+/) || [0])[0]) - Number((a.metric.match(/\d+/) || [0])[0])).slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectOfficialUpdates() {
  const feeds = [{ source: "OpenAI News", url: "https://openai.com/news/rss.xml" }, { source: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" }];
  const items = [];
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url);
      for (const item of parseRssItems(xml, 4)) items.push({ source: feed.source, title: item.title, url: item.url, metric: "官方更新", area: applicationLens(item.title, item.desc), note: truncate(item.desc, 140) });
    } catch (error) {
      items.push({ source: feed.source, title: `抓取失败：${error.message}`, url: feed.url, metric: "抓取失败", area: "来源状态", note: "" });
    }
  }
  return items.filter((item) => isAI(`${item.title} ${item.note} ${item.source}`)).slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectResearchSignals() {
  const xml = await fetchText("https://huggingface.co/papers");
  const titleRegex = /<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/g;
  const items = [];
  let match;
  while ((match = titleRegex.exec(xml)) && items.length < MAX_ITEMS_PER_SOURCE) {
    const title = decodeText(match[2]);
    if (!title || !isAI(title)) continue;
    const url = match[1].startsWith("http") ? match[1] : `https://huggingface.co${match[1]}`;
    items.push({ source: "Hugging Face Papers", title, url, metric: "研究信号", area: applicationLens(title), note: "只作为应用趋势线索，不展开论文细节。" });
  }
  return items;
}

async function collectWithStatus(name, title, collector) {
  try { return { name, title, ok: true, items: await collector() }; } catch (error) { return { name, title, ok: false, error: error.message, items: [] }; }
}
function flattenItems(sections) { return sections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title }))); }

function renderRawBrief(sections) {
  const lines = ["# AI 应用简报", "", `生成时间：${nowLocal()}（北京时间）`, "", "今天按“产品化、开源工具、工程落地、中文社区讨论、研究转应用信号”筛选。"];
  for (const section of sections) {
    lines.push("", `## ${section.title}`);
    if (!section.ok) { lines.push(`- 抓取失败：${section.error}`); continue; }
    if (!section.items.length) { lines.push("- 暂未筛到明确的 AI 应用相关条目。"); continue; }
    for (const item of section.items) {
      lines.push(`- **${item.title}**（${item.source}，${item.metric}）`);
      lines.push(`  - 链接：${item.url}`);
      lines.push(`  - 方向：${item.area}`);
      if (item.note) lines.push(`  - 简介：${item.note}`);
    }
  }
  return lines.join("\n");
}

async function polishWithDeepSeek(rawMarkdown) {
  if (!DEEPSEEK_API_KEY) return null;
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.35,
      max_tokens: 2600,
      messages: [
        { role: "system", content: "你是一名给中文技术从业者写 AI 应用简报的编辑。写作要像可靠的朋友，不要官腔，不要堆形容词。你必须保留原始条目的链接，不编造事实。" },
        { role: "user", content: ["请把下面的原始素材整理成一份中文微信简报。", "要求：", "1. 开头用 3-5 条“今天值得看”总结，不要超过 120 字。", "2. 每条内容都要用中文解释“为什么值得关注”，偏应用和落地，不讲论文细节。", "3. 尽量把英文标题翻译成中文，但保留产品名/项目名。", "4. 保留 Markdown 链接。", "5. 控制在手机上好读，分段短一些。", "", rawMarkdown].join("\n") },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

function renderBrief(sections, polished) {
  if (polished) return `# AI 应用简报\n\n生成时间：${nowLocal()}（北京时间）\n\n${polished.trim()}\n\n---\n\n数据源：OpenAI、Hugging Face、Product Hunt、GitHub、Hacker News、知乎热榜、V2EX。`;
  return renderRawBrief(sections);
}

async function pushServerChan(markdown) {
  if (!SERVERCHAN_SENDKEY) throw new Error("缺少 SERVERCHAN_SENDKEY 环境变量。");
  const body = new URLSearchParams({ title: `AI 应用简报 ${new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}`, desp: markdown });
  const res = await fetch(`https://sctapi.ftqq.com/${encodeURIComponent(SERVERCHAN_SENDKEY)}.send`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sections = await Promise.all([
    collectWithStatus("official", "官方产品 / 平台更新", collectOfficialUpdates),
    collectWithStatus("producthunt", "新产品 / 新工具", collectProductHuntAI),
    collectWithStatus("github", "开源项目 / 工程落地", collectGithubAI),
    collectWithStatus("hn", "海外开发者社区热点", collectHackerNewsAI),
    collectWithStatus("zhihu", "中文社区：知乎热榜", collectZhihuHotAI),
    collectWithStatus("v2ex", "中文社区：V2EX", collectV2exAI),
    collectWithStatus("research", "研究转应用信号", collectResearchSignals),
  ]);
  const rawMarkdown = renderRawBrief(sections);
  let polished = null;
  try { polished = await polishWithDeepSeek(rawMarkdown); } catch (error) { console.log(`DeepSeek 润色失败，使用本地简报：${error.message}`); }
  const markdown = renderBrief(sections, polished);
  const outPath = path.join(OUT_DIR, `ai_app_brief_${stamp()}.md`);
  fs.writeFileSync(outPath, markdown, "utf8");
  console.log(`已生成简报：${outPath}`);
  console.log(`素材条目数：${flattenItems(sections).length}`);
  if (process.argv.includes("--no-push")) { console.log("已跳过推送。"); return; }
  const result = await pushServerChan(markdown);
  console.log(`Server酱响应：${result.status} ${result.text}`);
  if (!result.ok) process.exitCode = 1;
})();
