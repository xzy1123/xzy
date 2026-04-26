const fs = require("fs");
const path = require("path");

const SERVERCHAN_SENDKEY = process.env.SERVERCHAN_SENDKEY || "";
const OUT_DIR = path.join(__dirname, "ai-briefs");
const ZHIHU_HOT_URL = "https://www.88vip.work/search";
const MAX_ITEMS_PER_SOURCE = Number(process.env.MAX_ITEMS_PER_SOURCE || 5);

const AI_KEYWORDS = [
  "AI",
  "AIGC",
  "AGI",
  "LLM",
  "GPT",
  "OpenAI",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Qwen",
  "Kimi",
  "Llama",
  "Mistral",
  "Hugging Face",
  "agent",
  "agents",
  "RAG",
  "copilot",
  "生成式",
  "人工智能",
  "大模型",
  "模型",
  "机器学习",
  "深度学习",
  "智能体",
  "机器人",
  "自动驾驶",
  "豆包",
  "通义",
  "千问",
  "文心",
  "混元",
  "罗福莉",
  "黄仁勋",
  "Sora",
  "Midjourney",
  "Stable Diffusion",
];

function nowLocal() {
  return new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Hong_Kong",
    hour12: false,
  });
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeText(text) {
  let value = stripHtml(text);
  for (let i = 0; i < 2; i += 1) value = stripHtml(value);
  return value;
}

function isAI(text) {
  const haystack = String(text || "");
  return AI_KEYWORDS.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (/^[A-Za-z0-9 .+-]+$/.test(keyword)) {
      return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(haystack);
    }
    return new RegExp(escaped, "i").test(haystack);
  });
}

function truncate(text, length = 150) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function applicationLens(title, desc = "") {
  const text = `${title} ${desc}`.toLowerCase();
  if (/agent|computer use|browser|workflow|automation|智能体|自动化|办公/.test(text)) {
    return "应用看点：Agent 正从演示走向可执行工作流，适合关注自动化办公、浏览器操作和业务流程编排。";
  }
  if (/code|coding|developer|dev|repo|github|cli|ide|programming|编程|开发/.test(text)) {
    return "应用看点：开发工具链仍是 AI 最快落地的场景，重点看是否能进入 IDE、CI、代码审查或运维流程。";
  }
  if (/image|video|audio|voice|speech|music|3d|vision|multimodal|图像|视频|语音|多模态|视觉/.test(text)) {
    return "应用看点：多模态能力继续产品化，适合关注内容生产、设计、营销素材和视觉质检场景。";
  }
  if (/rag|retrieval|search|knowledge|database|vector|memory|搜索|知识库|检索|向量/.test(text)) {
    return "应用看点：企业知识库和搜索增强仍是高确定性落地方向，关键在权限、更新频率和准确率。";
  }
  if (/customer|sales|support|crm|enterprise|business|meeting|email|企业|客服|销售|会议|邮件/.test(text)) {
    return "应用看点：面向企业的 AI 应用更重视可控、集成和 ROI，适合看真实业务指标而不是单点功能。";
  }
  if (/robot|robotics|driving|vehicle|\bcar\b|autonomous|机器人|自动驾驶|汽车/.test(text)) {
    return "应用看点：AI 正和硬件/车端结合，短期看感知、决策辅助和交互体验的工程化进展。";
  }
  if (/model|llm|gpt|claude|gemini|deepseek|qwen|llama|mistral|模型|大模型/.test(text)) {
    return "应用看点：模型能力更新会传导到成本、上下文长度、工具调用和私有部署，关注能否降低应用门槛。";
  }
  return "应用看点：值得观察它是否能转化为明确场景、可复用工具或可衡量的效率提升。";
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 AI-Application-Brief/2.0",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 AI-Application-Brief/2.0",
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function parseRssItems(xml, limit = MAX_ITEMS_PER_SOURCE) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/g) || [];
  return blocks.map((block) => {
    const title = decodeText((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
    const link =
      (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] ||
      decodeText((block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]);
    const desc = decodeText(
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] ||
        (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] ||
        (block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1],
    );
    const date = decodeText(
      (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] ||
        (block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || [])[1] ||
        (block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/) || [])[1],
    );
    return { title, url: link, desc, date };
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
    items.push({
      title,
      url: match[2],
      rank: Number(match[1]),
      hot: decodeText(match[4]),
      lens: applicationLens(title),
    });
  }
  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectProductHuntAI() {
  const xml = await fetchText("https://www.producthunt.com/feed");
  return parseRssItems(xml, 30)
    .filter((item) => isAI(`${item.title} ${item.desc}`))
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((item) => ({
      title: item.title,
      url: item.url,
      desc: truncate(item.desc, 100),
      lens: applicationLens(item.title, item.desc),
    }));
}

async function collectHackerNewsAI() {
  const since = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
  const queries = ["AI agent", "LLM", "OpenAI", "Claude", "DeepSeek"];
  const hits = [];
  for (const query of queries) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=10`;
    const data = await fetchJson(url, { headers: { Accept: "application/json" } });
    hits.push(...(data.hits || []));
  }
  const unique = new Map();
  for (const hit of hits) {
    if (!unique.has(hit.objectID)) unique.set(hit.objectID, hit);
  }
  return [...unique.values()]
    .filter((hit) => isAI(`${hit.title || ""} ${hit.story_text || ""}`))
    .sort((a, b) => (b.points || 0) + (b.num_comments || 0) - ((a.points || 0) + (a.num_comments || 0)))
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((hit) => ({
      title: hit.title || "(untitled)",
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      points: hit.points || 0,
      comments: hit.num_comments || 0,
      lens: applicationLens(hit.title || "", hit.story_text || ""),
    }));
}

async function collectGithubAI() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const queries = [
    `topic:ai-agent pushed:>=${since} stars:>100`,
    `topic:llm pushed:>=${since} stars:>300`,
    `topic:rag pushed:>=${since} stars:>100`,
    `topic:generative-ai pushed:>=${since} stars:>100`,
  ];

  const repos = [];
  for (const query of queries) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=5`;
    const data = await fetchJson(url);
    for (const repo of data.items || []) {
      repos.push({
        name: repo.full_name,
        url: repo.html_url,
        desc: repo.description || "",
        stars: repo.stargazers_count,
        updated: repo.pushed_at ? repo.pushed_at.slice(0, 10) : "",
        lens: applicationLens(repo.full_name, repo.description || ""),
      });
    }
  }

  const unique = new Map();
  for (const repo of repos) {
    if (!unique.has(repo.name)) unique.set(repo.name, repo);
  }
  return [...unique.values()]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

async function collectOfficialUpdates() {
  const feeds = [
    { source: "OpenAI News", url: "https://openai.com/news/rss.xml" },
    { source: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  ];

  const items = [];
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url);
      for (const item of parseRssItems(xml, 4)) {
        items.push({
          source: feed.source,
          title: item.title,
          url: item.url,
          desc: truncate(item.desc, 120),
          lens: applicationLens(item.title, item.desc),
        });
      }
    } catch (error) {
      items.push({ source: feed.source, title: `抓取失败：${error.message}`, url: feed.url, desc: "", lens: "" });
    }
  }

  return items.filter((item) => isAI(`${item.title} ${item.desc} ${item.source}`)).slice(0, MAX_ITEMS_PER_SOURCE);
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
    items.push({
      title,
      url,
      lens: applicationLens(title),
    });
  }

  if (items.length) return items;

  const arxivQuery = encodeURIComponent("cat:cs.AI OR cat:cs.CL OR cat:cs.LG OR cat:cs.CV");
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${arxivQuery}&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${MAX_ITEMS_PER_SOURCE}`;
  const arxivXml = await fetchText(arxivUrl);
  return parseRssItems(arxivXml, MAX_ITEMS_PER_SOURCE).map((item) => ({
    title: item.title,
    url: item.url,
    lens: applicationLens(item.title, item.desc),
  }));
}

async function collectWithStatus(name, title, collector) {
  try {
    const items = await collector();
    return { name, title, ok: true, items };
  } catch (error) {
    return { name, title, ok: false, error: error.message, items: [] };
  }
}

function renderSection(section, renderer) {
  const lines = [`## ${section.title}`];
  if (!section.ok) {
    lines.push(`- 抓取失败：${section.error}`);
  } else if (!section.items.length) {
    lines.push("- 暂未筛到明确的 AI 应用相关条目。");
  } else {
    for (const item of section.items) lines.push(...renderer(item));
  }
  return lines;
}

function renderMarkdown(sections) {
  const lines = [
    "# AI 应用简报",
    "",
    `生成时间：${nowLocal()}（Asia/Hong_Kong）`,
    "",
    "本版只追 AI 技术应用：产品化、开源工具、工程落地、行业讨论和能转化成应用的研究信号；不展开论文细节。",
    "",
    ...renderSection(sections.find((s) => s.name === "official"), (item) => [
      `- **${item.source}**：[${item.title}](${item.url})`,
      item.desc ? `  - ${item.desc}` : "",
      item.lens ? `  - ${item.lens}` : "",
    ].filter(Boolean)),
    "",
    ...renderSection(sections.find((s) => s.name === "producthunt"), (item) => [
      `- [${item.title}](${item.url})`,
      item.desc ? `  - ${item.desc}` : "",
      `  - ${item.lens}`,
    ]),
    "",
    ...renderSection(sections.find((s) => s.name === "github"), (item) => [
      `- **${item.name}**（${item.stars} stars，更新 ${item.updated}）：[GitHub](${item.url})`,
      item.desc ? `  - ${truncate(item.desc, 130)}` : "",
      `  - ${item.lens}`,
    ].filter(Boolean)),
    "",
    ...renderSection(sections.find((s) => s.name === "hn"), (item) => [
      `- [${item.title}](${item.url})（${item.points} points，${item.comments} comments）`,
      `  - ${item.lens}`,
    ]),
    "",
    ...renderSection(sections.find((s) => s.name === "zhihu"), (item) => [
      `- **#${item.rank} ${item.hot}** [${item.title}](${item.url})`,
      `  - ${item.lens}`,
    ]),
    "",
    ...renderSection(sections.find((s) => s.name === "research"), (item) => [
      `- [${item.title}](${item.url})`,
      `  - ${item.lens}`,
    ]),
    "",
    "## 信息源",
    "- 官方更新：OpenAI News、Hugging Face Blog。",
    "- 产品应用：Product Hunt。",
    "- 工程落地：GitHub 搜索近 14 天活跃 AI 项目。",
    "- 开发者讨论：Hacker News 近 10 天 AI 相关故事。",
    "- 中文热点：知乎热榜 AI 条目。",
    "- 研究转应用：Hugging Face Papers，失败时回退 arXiv 最新 AI 论文。",
  ];

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function pushServerChan(markdown) {
  if (!SERVERCHAN_SENDKEY) throw new Error("缺少 SERVERCHAN_SENDKEY 环境变量。");

  const body = new URLSearchParams({
    title: `AI 应用简报 ${new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Hong_Kong" })}`,
    desp: markdown,
  });

  const res = await fetch(`https://sctapi.ftqq.com/${encodeURIComponent(SERVERCHAN_SENDKEY)}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sections = await Promise.all([
    collectWithStatus("official", "官方产品 / 平台更新", collectOfficialUpdates),
    collectWithStatus("producthunt", "新产品 / 新工具", collectProductHuntAI),
    collectWithStatus("github", "开源项目 / 工程落地", collectGithubAI),
    collectWithStatus("hn", "开发者社区热点", collectHackerNewsAI),
    collectWithStatus("zhihu", "知乎热榜 AI 相关", collectZhihuHotAI),
    collectWithStatus("research", "研究转应用信号", collectResearchSignals),
  ]);

  const markdown = renderMarkdown(sections);
  const outPath = path.join(OUT_DIR, `ai_app_brief_${stamp()}.md`);
  fs.writeFileSync(outPath, markdown, "utf8");
  console.log(`已生成简报：${outPath}`);

  if (process.argv.includes("--no-push")) {
    console.log("已跳过推送。");
    return;
  }

  const result = await pushServerChan(markdown);
  console.log(`Server酱响应：${result.status} ${result.text}`);
  if (!result.ok) process.exitCode = 1;
})();
