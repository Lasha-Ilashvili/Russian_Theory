import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "teoria-am-viewer");
const ASSETS_DIR = path.join(OUT_DIR, "assets");
const SOURCE_SITE = "https://teoria.on.ge";
const CATEGORY_ID = "10";
const ALL_PAGE_COUNT = 17;
const TOPIC_COUNT = 31;
const TRANSLATION_FILE = "tickets-ru-translations.js";
const RUSSIAN_COOKIE = `exam-settings=${encodeURIComponent(JSON.stringify({
  category: 2,
  locale: "ru",
  skin: "dark",
  user: 0,
  created: Math.floor(Date.now() / 1000)
}))}`;
const HTML_REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 offline learner",
  "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
  cookie: RUSSIAN_COOKIE
};
const TOPIC_TITLES_RU = {
  "1": "Водитель, пассажир и пешеход, знаки, конвенция",
  "2": "Неисправности и условия управления",
  "3": "Предупреждающие знаки",
  "4": "Знаки приоритета",
  "5": "Запрещающие знаки",
  "6": "Предписывающие знаки",
  "7": "Информационно-указательные знаки",
  "8": "Знаки сервиса",
  "9": "Знаки дополнительной информации",
  "10": "Сигналы светофора",
  "11": "Сигналы регулировщика",
  "12": "Использование специальных сигналов",
  "13": "Аварийная световая сигнализация",
  "14": "Световые приборы, звуковой сигнал",
  "15": "Движение, маневрирование, проезжая часть",
  "16": "Обгон и встречный разъезд",
  "17": "Скорость движения",
  "18": "Тормозной путь, дистанция",
  "19": "Остановка и стоянка",
  "20": "Проезд перекрестков",
  "21": "Железнодорожный переезд",
  "22": "Движение по автомагистрали",
  "23": "Жилая зона, приоритет маршрутного транспорта",
  "24": "Буксировка",
  "25": "Учебная езда",
  "26": "Перевозки, люди, груз",
  "27": "Велосипед, мопед и перегон скота",
  "28": "Дорожная разметка",
  "29": "Медицинская помощь",
  "30": "Безопасность движения",
  "31": "Административный закон"
};

const tickets = new Map();
const topicTickets = new Map();
const topics = new Map();
const pageQueue = [];
const queuedPages = new Set();
const downloadedImages = new Map();

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensureInsideWorkspace(target) {
  const relative = path.relative(ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside workspace: ${target}`);
  }
}

function normalizeUrl(rawUrl, baseUrl = SOURCE_SITE) {
  if (!rawUrl || rawUrl.startsWith("#")) {
    return null;
  }

  if (/^(javascript|mailto|tel|data):/i.test(rawUrl)) {
    return null;
  }

  return new URL(rawUrl.replaceAll("&amp;", "&"), baseUrl).href;
}

function pageKey(rawUrl) {
  const url = new URL(rawUrl, SOURCE_SITE);
  const match = url.pathname.match(new RegExp(`^/tickets/${CATEGORY_ID}(?:/(\\d+))?/?$`));
  if (!match) {
    return null;
  }

  const topic = match[1] || "all";
  if (topic !== "all") {
    const topicNumber = Number(topic);
    if (!Number.isInteger(topicNumber) || topicNumber < 1 || topicNumber > TOPIC_COUNT) {
      return null;
    }
  }

  const page = url.searchParams.get("page") || "1";
  if (!/^\d+$/.test(page)) {
    return null;
  }

  return `${topic}:${page}`;
}

function enqueuePage(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const key = url && pageKey(url);
  if (!key || queuedPages.has(key)) {
    return;
  }

  queuedPages.add(key);
  pageQueue.push({ key, url });
}

function decodeHtml(text) {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: HTML_REQUEST_HEADERS
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 offline learner"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function discoverTopicNames(html) {
  const topicNav = html.match(/<nav class="tickets-topics">[\s\S]*?<\/nav>/i)?.[0] || "";
  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(topicNav))) {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    const title = match[1].match(/\btitle=["']([^"']+)["']/i)?.[1];
    const url = href && normalizeUrl(href);
    const topicMatch = url && new URL(url).pathname.match(new RegExp(`^/tickets/${CATEGORY_ID}/(\\d+)/?$`));
    if (!topicMatch) {
      continue;
    }

    const id = topicMatch[1];
    const topicNumber = Number(id);
    if (topicNumber < 1 || topicNumber > TOPIC_COUNT) {
      continue;
    }

    const label = stripTags(title || match[2].replace(/<span[^>]*class=["']id["'][^>]*>[\s\S]*?<\/span>/i, ""));
    topics.set(id, label);
  }
}

function discoverPagination(html, baseUrl) {
  const hrefPattern = /\bhref=["']([^"']+)["']/gi;
  let hrefMatch;

  while ((hrefMatch = hrefPattern.exec(html))) {
    enqueuePage(normalizeUrl(hrefMatch[1], baseUrl));
  }

  const selectPattern = /<select\b[^>]*\bdata-href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
  let selectMatch;

  while ((selectMatch = selectPattern.exec(html))) {
    const dataHref = selectMatch[1];
    const options = selectMatch[2];
    const optionPattern = /<option\b[^>]*\bvalue=["']?(\d+)["']?[^>]*>/gi;
    let optionMatch;

    while ((optionMatch = optionPattern.exec(options))) {
      enqueuePage(normalizeUrl(`${dataHref}${optionMatch[1]}`, baseUrl));
    }
  }
}

function localImageName(rawUrl) {
  const url = new URL(rawUrl);
  const extension = path.extname(url.pathname) || ".bin";
  const base = path.basename(url.pathname, extension) || crypto.createHash("sha1").update(rawUrl).digest("hex").slice(0, 12);
  return `${base}${extension}`;
}

function queueImage(rawUrl, baseUrl) {
  const url = normalizeUrl(rawUrl, baseUrl);
  if (!url || !/^https?:\/\//i.test(url)) {
    return rawUrl;
  }

  if (!url.includes("/files/")) {
    return rawUrl;
  }

  const localPath = `assets/${localImageName(url)}`;
  downloadedImages.set(url, localPath);
  return localPath;
}

function rewriteTicketHtml(article, baseUrl) {
  let html = article.replace(/\slocale-[a-z]{2}\b/g, "");

  html = html.replace(/\b(src)=["']([^"']+)["']/gi, (full, attr, rawUrl) => {
    const localPath = queueImage(rawUrl, baseUrl);
    return `${attr}="${localPath}"`;
  });

  html = html.replace(/\bhref=["'][^"']*tickets\?ticket=(\d+)[^"']*["']/gi, 'href="#ticket-$1"');
  html = html.replace(/\bvalue=["']https?:\/\/teoria\.on\.ge\/tickets\?ticket=(\d+)["']/gi, 'value="#ticket-$1"');
  return html;
}

function extractQuestion(article) {
  const question = article.match(/<div class="t-question">[\s\S]*?<span class="text-wrap"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
  return stripTags(question);
}

function extractTickets(html, baseUrl, topicId = null, allPage = null) {
  const articlePattern = /<article\b[^>]*class=["'][^"']*\bticket-container\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;
  let match;

  while ((match = articlePattern.exec(html))) {
    const article = match[0];
    const id = article.match(/<div class="t-num">#(\d+)<\/div>/i)?.[1];
    if (!id) {
      continue;
    }

    if (topicId) {
      if (!topicTickets.has(topicId)) {
        topicTickets.set(topicId, new Set());
      }
      topicTickets.get(topicId).add(id);
    }

    if (!tickets.has(id)) {
      tickets.set(id, {
        id,
        question: extractQuestion(article),
        allPage,
        html: rewriteTicketHtml(article, baseUrl),
        topics: new Set()
      });
    } else if (allPage && !tickets.get(id).allPage) {
      tickets.get(id).allPage = allPage;
    }

    if (topicId) {
      tickets.get(id)?.topics.add(topicId);
    }
  }
}

async function downloadImages() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });

  for (const [url, localPath] of downloadedImages) {
    const target = path.join(OUT_DIR, localPath);
    log(`image ${localPath}`);
    try {
      await fs.writeFile(target, await fetchBytes(url));
    } catch (error) {
      log(`skipped image ${url}: ${error.message}`);
    }
  }
}

async function findTranslationFile() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const filesFolder = entries.find((entry) => entry.isDirectory() && entry.name.endsWith("_files"))?.name;
  const source = filesFolder && path.join(ROOT, filesFolder, TRANSLATION_FILE);

  if (!source) {
    return null;
  }

  try {
    await fs.access(source);
    return source;
  } catch {
    return null;
  }
}

async function writeTranslationFile(existingTranslation) {
  const target = path.join(OUT_DIR, TRANSLATION_FILE);

  if (existingTranslation) {
    await fs.writeFile(target, existingTranslation);
    return;
  }

  const source = await findTranslationFile();
  if (source) {
    await fs.copyFile(source, target);
    return;
  }

  await fs.writeFile(target, "window.TEORIA_RU_TRANSLATIONS = {};\n");
}

async function writeDataFile() {
  const data = {
    builtAt: new Date().toISOString(),
    categoryId: CATEGORY_ID,
    topics: Array.from({ length: TOPIC_COUNT }, (_, index) => {
      const id = String(index + 1);
      return {
        id,
        title: TOPIC_TITLES_RU[id] || topics.get(id) || `Тема ${id}`,
        tickets: Array.from(topicTickets.get(id) || [])
      };
    }),
    tickets: Array.from(tickets.values())
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((ticket) => ({
        id: ticket.id,
        question: ticket.question,
        allPage: ticket.allPage,
        topics: Array.from(ticket.topics).sort((a, b) => Number(a) - Number(b)),
        html: ticket.html
      }))
  };

  await fs.writeFile(path.join(OUT_DIR, "tickets-data.js"), `window.TEORIA_AM_DATA = ${JSON.stringify(data)};\n`);
}

async function writeViewerFiles() {
  await fs.writeFile(path.join(OUT_DIR, "index.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AM tickets offline</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="app-header">
    <div>
      <h1>AM билеты</h1>
      <p id="summary">Загрузка...</p>
    </div>
    <label class="search">
      <span>Поиск</span>
      <input id="search" type="search" placeholder="Номер или текст">
    </label>
  </header>

  <main class="layout">
    <aside class="topics-panel">
      <button class="topic-button active" type="button" data-topic="all">Все</button>
      <div id="topics"></div>
    </aside>

    <section class="tickets-panel">
      <nav id="pages" class="pages-panel" aria-label="Pages"></nav>
      <div id="tickets" class="tickets-grid"></div>
    </section>
  </main>

  <script src="./${TRANSLATION_FILE}"></script>
  <script src="./tickets-data.js"></script>
  <script src="./viewer.js"></script>
</body>
</html>
`);

  await fs.writeFile(path.join(OUT_DIR, "styles.css"), `:root {
  color-scheme: light;
  --bg: #f4f6f8;
  --panel: #ffffff;
  --ink: #202631;
  --muted: #667085;
  --line: #d9dee7;
  --accent: #116b5f;
  --accent-soft: #e4f3ef;
  --correct: #18834f;
  --correct-soft: #e8f6ef;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
  line-height: 1.45;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--line);
}

h1 {
  margin: 0;
  font-size: 24px;
}

#summary {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.search {
  display: grid;
  gap: 5px;
  min-width: 280px;
  color: var(--muted);
  font-size: 12px;
}

.search input {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 15px;
}

.layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: calc(100vh - 75px);
}

.topics-panel {
  position: sticky;
  top: 73px;
  align-self: start;
  height: calc(100vh - 73px);
  overflow: auto;
  padding: 14px;
  background: #edf1f5;
  border-right: 1px solid var(--line);
}

.topic-button {
  width: 100%;
  min-height: 34px;
  margin-bottom: 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 7px 9px;
  background: transparent;
  color: var(--ink);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
}

.topic-button:hover,
.topic-button.active {
  border-color: #a9c9c2;
  background: var(--accent-soft);
  color: #073d36;
}

.topic-count {
  float: right;
  color: var(--muted);
  font-size: 12px;
}

.tickets-panel {
  padding: 18px;
}

.pages-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 1180px;
  margin: 0 auto 14px;
}

.page-button {
  min-width: 36px;
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}

.page-button:hover,
.page-button.active {
  border-color: #a9c9c2;
  background: var(--accent-soft);
  color: #073d36;
}

.page-button-all {
  min-width: 68px;
}

.tickets-grid {
  display: grid;
  gap: 14px;
  max-width: 1180px;
  margin: 0 auto;
}

.ticket-container {
  display: grid;
  grid-template-columns: minmax(160px, 280px) minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
}

.ticket-container .t-image {
  grid-row: span 4;
  margin: 0;
}

.ticket-container .t-image img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
}

.t-num {
  width: fit-content;
  border-radius: 999px;
  padding: 3px 9px;
  background: #263445;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.t-question-inner {
  display: block;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.t-cover {
  display: grid;
  gap: 8px;
}

.t-answer {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fbfcfd;
}

.t-answer.ans-empty {
  display: none;
}

.t-answer-inner {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 8px;
}

.t-a-num span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #e7ebf0;
  color: #384253;
  font-weight: 700;
  font-size: 13px;
}

.t-answer[data-is-correct-list="true"] {
  border-color: #9ad5b7;
  background: var(--correct-soft);
}

.t-answer[data-is-correct-list="true"] .t-a-num span {
  background: var(--correct);
  color: #fff;
}

.sorry,
.ticket-link {
  display: none;
}

.desc-button {
  display: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: #fff;
  color: var(--accent);
  cursor: pointer;
  font-weight: 700;
}

.ticket-container.has-explanation .desc-button {
  display: inline-grid;
}

.desc-button::before {
  content: "?";
}

.desc-button span {
  display: none;
}

.desc-box {
  display: none;
  grid-column: 1 / -1;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  color: #384253;
}

.ticket-container.desc-open .desc-box {
  display: block;
}

.desc-title {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 13px;
}

.desc-title a {
  display: none;
}

.empty {
  padding: 40px 20px;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 820px) {
  .app-header {
    position: static;
    display: grid;
    padding: 14px;
  }

  .search {
    min-width: 0;
  }

  .layout {
    display: block;
  }

  .topics-panel {
    position: static;
    height: auto;
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .ticket-container {
    grid-template-columns: 1fr;
  }

  .ticket-container .t-image {
    grid-row: auto;
  }
}
`);

  await fs.writeFile(path.join(OUT_DIR, "viewer.js"), `(() => {
  const data = window.TEORIA_AM_DATA || { tickets: [], topics: [] };
  const translations = window.TEORIA_RU_TRANSLATIONS || {};
  const topicsEl = document.querySelector("#topics");
  const pagesEl = document.querySelector("#pages");
  const ticketsEl = document.querySelector("#tickets");
  const summaryEl = document.querySelector("#summary");
  const searchEl = document.querySelector("#search");
  const initialState = new URLSearchParams(location.hash.slice(1));
  let activeTopic = initialState.get("topic") || "all";
  let activePage = initialState.get("page") || "all";

  const byId = new Map(data.tickets.map((ticket) => [ticket.id, ticket]));

  function usableText(value) {
    return typeof value === "string" && value.trim() ? value : null;
  }

  function setText(node, value) {
    const text = usableText(value);
    if (node && text) {
      node.textContent = text;
    }
  }

  function answerNumber(answer, fallback) {
    const number = answer.querySelector(".t-a-num span");
    return number && number.textContent.trim() ? number.textContent.trim() : String(fallback + 1);
  }

  function explanationTarget(ticket) {
    const box = ticket.querySelector(".desc-box-inner");
    if (!box) {
      return null;
    }

    const existing = Array.from(box.children).find((child) => child.tagName === "P" && !child.classList.contains("sorry"));
    if (existing) {
      return existing;
    }

    const paragraph = document.createElement("p");
    box.append(paragraph);
    return paragraph;
  }

  function applyTranslation(ticketEl) {
    const id = ticketEl.querySelector(".t-num")?.textContent.match(/\\d+/)?.[0];
    const item = id && translations[id];
    if (!item) {
      return;
    }

    setText(ticketEl.querySelector(".t-question .text-wrap"), item.question);

    const answers = item.answers || {};
    ticketEl.querySelectorAll(".t-answer:not(.ans-empty)").forEach((answer, index) => {
      const number = answerNumber(answer, index);
      const translated = Array.isArray(answers) ? answers[index] : answers[number];
      setText(answer.querySelector(".t-a-text .text-wrap"), translated);
    });

    setText(explanationTarget(ticketEl), item.explanation);
    if (usableText(item.explanation)) {
      ticketEl.classList.add("has-explanation");
    }
  }

  function prepareTicketControls(ticketEl) {
    const descButton = ticketEl.querySelector(".desc-button");
    const descTitle = ticketEl.querySelector(".desc-title");
    if (descTitle?.firstChild) {
      descTitle.firstChild.textContent = "Пояснение";
    }

    if (descButton) {
      descButton.setAttribute("title", "Пояснение");
      descButton.addEventListener("click", () => {
        ticketEl.classList.toggle("desc-open");
      });
    }
  }

  function topicTickets(topicId) {
    if (topicId === "all") {
      return data.tickets;
    }

    const topic = data.topics.find((item) => item.id === topicId);
    const ids = topic ? topic.tickets : [];
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function allPages() {
    return [...new Set(data.tickets.map((ticket) => ticket.allPage).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));
  }

  function writeHash() {
    const params = new URLSearchParams();
    if (activeTopic !== "all") {
      params.set("topic", activeTopic);
    }
    if (activeTopic === "all" && activePage !== "all") {
      params.set("page", activePage);
    }

    const hash = params.toString();
    history.replaceState(null, "", hash ? \`\${location.pathname}#\${hash}\` : location.pathname);
  }

  function matchesSearch(ticket, query) {
    if (!query) {
      return true;
    }

    const translation = translations[ticket.id];
    const translatedQuestion = translation?.question || "";
    const translatedAnswers = Object.values(translation?.answers || {}).join(" ");
    return [ticket.id, ticket.question, translatedQuestion, translatedAnswers].join(" ").toLowerCase().includes(query);
  }

  function renderTopics() {
    topicsEl.innerHTML = data.topics.map((topic) => {
      const count = topic.tickets.length;
      return \`<button class="topic-button" type="button" data-topic="\${topic.id}"><span>\${topic.id}. \${topic.title}</span><span class="topic-count">\${count}</span></button>\`;
    }).join("");

    document.querySelectorAll(".topic-button").forEach((button) => {
      button.addEventListener("click", () => {
        activeTopic = button.dataset.topic;
        activePage = "all";
        writeHash();
        render();
      });
    });
  }

  function renderPages() {
    if (activeTopic !== "all") {
      pagesEl.innerHTML = "";
      return;
    }

    pagesEl.innerHTML = [
      \`<button class="page-button page-button-all" type="button" data-page="all">Все</button>\`,
      ...allPages().map((page) => \`<button class="page-button" type="button" data-page="\${page}">\${page}</button>\`)
    ].join("");

    pagesEl.querySelectorAll(".page-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === activePage);
      button.addEventListener("click", () => {
        activePage = button.dataset.page;
        writeHash();
        render();
      });
    });
  }

  function render() {
    const query = searchEl.value.trim().toLowerCase();
    let filtered = topicTickets(activeTopic);
    if (activeTopic === "all" && activePage !== "all") {
      filtered = filtered.filter((ticket) => ticket.allPage === activePage);
    }
    filtered = filtered.filter((ticket) => matchesSearch(ticket, query));

    document.querySelectorAll(".topic-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.topic === activeTopic);
    });

    renderPages();
    summaryEl.textContent = \`Показано \${filtered.length} из \${data.tickets.length}\`;
    ticketsEl.innerHTML = filtered.length
      ? filtered.map((ticket) => \`<div class="ticket-shell" id="ticket-\${ticket.id}">\${ticket.html}</div>\`).join("")
      : '<div class="empty">Ничего не найдено</div>';

    ticketsEl.querySelectorAll(".ticket-container").forEach((ticketEl) => {
      prepareTicketControls(ticketEl);
      applyTranslation(ticketEl);
    });
  }

  searchEl.addEventListener("input", render);
  renderTopics();
  render();
})();\n`);
}

async function writeRouteShims() {
  const router = (relativeViewerPath, topic = null) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>AM tickets redirect</title>
  <script>
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams();
    ${topic ? `hash.set("topic", "${topic}");` : `if (params.get("page")) hash.set("page", params.get("page"));`}
    location.replace("${relativeViewerPath}" + (hash.toString() ? "#" + hash.toString() : ""));
  </script>
</head>
<body>
  <a href="${relativeViewerPath}">Open offline viewer</a>
</body>
</html>
`;

  const allDir = path.join(OUT_DIR, "..", "tickets", CATEGORY_ID);
  ensureInsideWorkspace(allDir);
  await fs.mkdir(allDir, { recursive: true });
  await fs.writeFile(path.join(allDir, "index.html"), router("../../teoria-am-viewer/index.html"));

  for (let topic = 1; topic <= TOPIC_COUNT; topic += 1) {
    const topicDir = path.join(allDir, String(topic));
    ensureInsideWorkspace(topicDir);
    await fs.mkdir(topicDir, { recursive: true });
    await fs.writeFile(path.join(topicDir, "index.html"), router("../../../teoria-am-viewer/index.html", String(topic)));
  }
}

async function build() {
  ensureInsideWorkspace(OUT_DIR);
  let existingTranslation = null;
  try {
    existingTranslation = await fs.readFile(path.join(OUT_DIR, TRANSLATION_FILE), "utf8");
  } catch {
    existingTranslation = null;
  }

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (let page = 1; page <= ALL_PAGE_COUNT; page += 1) {
    enqueuePage(`${SOURCE_SITE}/tickets/${CATEGORY_ID}?page=${page}`);
  }

  for (let topic = 1; topic <= TOPIC_COUNT; topic += 1) {
    enqueuePage(`${SOURCE_SITE}/tickets/${CATEGORY_ID}/${topic}`);
  }

  for (let index = 0; index < pageQueue.length; index += 1) {
    const page = pageQueue[index];
    const [topicId] = page.key.split(":");
    const [, currentPage] = page.key.split(":");

    log(`fetch ${page.url}`);
    const html = await fetchText(page.url);
    discoverTopicNames(html);
    discoverPagination(html, page.url);
    extractTickets(html, page.url, topicId === "all" ? null : topicId, topicId === "all" ? currentPage : null);
  }

  await downloadImages();
  await writeTranslationFile(existingTranslation);
  await writeDataFile();
  await writeViewerFiles();
  await writeRouteShims();

  log(`tickets: ${tickets.size}`);
  log(`topics: ${topics.size}`);
  log(`viewer: ${path.join(OUT_DIR, "index.html")}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
