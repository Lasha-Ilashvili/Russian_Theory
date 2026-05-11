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
  let html = article;

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

async function writeVendorCss() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const filesFolder = entries.find((entry) => entry.isDirectory() && entry.name.endsWith("_files"))?.name;
  if (!filesFolder) {
    return;
  }

  const sourceDir = path.join(ROOT, filesFolder);
  const vendorDir = path.join(OUT_DIR, "vendor");
  ensureInsideWorkspace(vendorDir);
  await fs.mkdir(vendorDir, { recursive: true });

  for (const fileName of [
    "bootstrap.min.css",
    "bootstrap-theme.min.css",
    "tooltipster.css",
    "jquery.magnific-popup.css",
    "global.css",
    "global.components.css",
    "user.css",
    "test_exam.css",
    "static.css",
    "static-extra.css",
    "onbar-2.css"
  ]) {
    try {
      await fs.copyFile(path.join(sourceDir, fileName), path.join(vendorDir, fileName));
    } catch {
      // The viewer has local fallback styles if an optional source stylesheet is missing.
    }
  }
}

async function writeViewerFiles() {
  await fs.writeFile(path.join(OUT_DIR, "index.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AM tickets offline</title>
  <link rel="stylesheet" href="./vendor/bootstrap.min.css">
  <link rel="stylesheet" href="./vendor/bootstrap-theme.min.css">
  <link rel="stylesheet" href="./vendor/tooltipster.css">
  <link rel="stylesheet" href="./vendor/jquery.magnific-popup.css">
  <link rel="stylesheet" href="./vendor/global.css">
  <link rel="stylesheet" href="./vendor/global.components.css">
  <link rel="stylesheet" href="./vendor/user.css">
  <link rel="stylesheet" href="./vendor/test_exam.css">
  <link rel="stylesheet" href="./vendor/static.css">
  <link rel="stylesheet" href="./vendor/static-extra.css">
  <link rel="stylesheet" href="./vendor/onbar-2.css">
  <link rel="stylesheet" href="./styles.css">
</head>
<body class="user-anon ticket-size-small">
  <section class="content-wrapper" style="overflow: hidden;">
    <div class="container" style="position: relative;">
      <div class="page-tickets-list">
        <nav class="tickets-topics">
          <h2 class="tickets-cats-title">Выберите тему:</h2>
          <ul id="topics" class="tickets-topics-list"></ul>
        </nav>

        <div class="tickets-list with-topics">
          <div class="text-content">
            <h1 id="page-title">AM категория <span class="light">Загрузка...</span></h1>
          </div>

          <nav id="pagination-top" class="on-pagination clearfix"></nav>
          <div id="tickets"></div>
          <nav id="pagination-bottom" class="on-pagination clearfix"></nav>
        </div>
      </div>
    </div>
  </section>

  <script src="./${TRANSLATION_FILE}"></script>
  <script src="./tickets-data.js"></script>
  <script src="./viewer.js"></script>
</body>
</html>
`);

  await fs.writeFile(path.join(OUT_DIR, "styles.css"), `body {
  margin: 0;
  background: #dbdbdb;
  color: #666;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
}

body .container {
  width: 1048px !important;
}

.content-wrapper {
  min-height: 100vh;
  background: #fff;
  padding: 20px 0 40px;
}

.container {
  width: 970px;
  margin: 0 auto;
}

.container:after,
.clearfix:after {
  content: "";
  display: table;
  clear: both;
}

.page-tickets-list {
  zoom: 1.08;
}

.page-tickets-list .tickets-topics {
  width: 175px;
  float: left;
}

.page-tickets-list .tickets-list.with-topics {
  width: 750px;
  float: right;
}

.page-tickets-list .text-content h1 {
  background: none;
  text-align: center;
  color: #535353;
  font-size: 30px;
  font-weight: normal;
  margin: 0 0 30px;
}

.page-tickets-list .text-content h1 .light {
  display: block;
  margin: 5px 0;
  color: #b0b0b0;
  font-size: 16px;
}

.tickets-cats-title {
  color: #919191;
  font-size: 20px;
  font-weight: normal;
  margin: 20px 0 10px;
}

.tickets-topics-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tickets-topics-list li {
  padding-bottom: 5px;
}

.tickets-topics-list a {
  display: block;
  background: #e0e0e0;
  color: #666;
  padding: 10px 10px 10px 30px;
  line-height: 1.2;
  border-radius: 5px;
  text-decoration: none;
  cursor: pointer;
}

.tickets-topics-list a .id {
  display: block;
  margin-left: -30px;
  width: 27px;
  text-align: right;
  float: left;
}

.tickets-topics-list a:hover {
  box-shadow: 0 0 1px #000;
  color: #000;
  background: #eee;
}

.tickets-topics-list a.active {
  background: #535353;
  color: #ffb83b;
  box-shadow: none;
}

.on-pagination {
  text-align: center;
  padding: 0 0 20px;
  clear: both;
}

.on-pagination:last-of-type {
  padding: 40px 0;
}

.on-pagination .paginator select {
  margin: 0 10px;
  display: inline-block;
  width: auto;
  vertical-align: middle;
}

.on-pagination .paginator {
  max-width: 60%;
}

.on-pagination .goto-ticket {
  width: 38%;
}

.tickets-list .item {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px dashed #aaa;
}

.tickets-list .item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ticket-container .sorry,
.ticket-container .ticket-link {
  display: none;
}

.ticket-container .desc-button {
  display: none !important;
  opacity: 1 !important;
}

.ticket-container.has-explanation .desc-button {
  display: block !important;
}

.ticket-container.desc-opened .desc-box {
  display: block;
}

.ticket-container .t-answer.ans-true .t-answer-inner .t-a-num:before,
.ticket-container .t-answer.ans-false .t-answer-inner .t-a-num:before {
  font-family: Arial, Helvetica, sans-serif !important;
  font-weight: bold;
  line-height: 1;
}

.ticket-container .t-answer.ans-true .t-answer-inner .t-a-num:before {
  content: "\\2713";
  font-size: 28px;
}

.ticket-container .t-answer.ans-false .t-answer-inner .t-a-num:before {
  content: "\\00d7";
  font-size: 32px;
}

.scroll-top-button {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1000;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 6px 6px 0 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  font-size: 28px;
  font-weight: bold;
  line-height: 42px;
  opacity: 0;
  transform: translateY(12px);
  transition: background-color 0.2s, opacity 0.2s, transform 0.2s;
  pointer-events: none;
}

.scroll-top-button.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.scroll-top-button:hover {
  background: rgba(0, 0, 0, 0.82);
}

.empty {
  padding: 50px 0;
  color: #8a8a8a;
  text-align: center;
  font-size: 18px;
}

@media (max-width: 1080px) {
  .page-tickets-list {
    zoom: 1;
  }

  body .container {
    width: auto !important;
    margin: 0 10px;
  }

  .page-tickets-list .tickets-topics,
  .page-tickets-list .tickets-list.with-topics {
    width: auto;
    float: none;
  }

  .tickets-topics {
    margin-bottom: 20px;
  }

  .ticket-container.ticket-container-small {
    width: 100%;
    height: auto;
    min-height: 512px;
  }

  .on-pagination {
    display: block;
    text-align: center;
  }

  .on-pagination .paginator {
    float: none !important;
    max-width: none;
  }

  .on-pagination .goto-ticket {
    width: 100%;
    margin-top: 10px;
  }
}
`);

  await fs.writeFile(path.join(OUT_DIR, "viewer.js"), `(() => {
  const data = window.TEORIA_AM_DATA || { tickets: [], topics: [] };
  const translations = window.TEORIA_RU_TRANSLATIONS || {};
  const topicsEl = document.querySelector("#topics");
  const paginationTopEl = document.querySelector("#pagination-top");
  const paginationBottomEl = document.querySelector("#pagination-bottom");
  const ticketsEl = document.querySelector("#tickets");
  const titleEl = document.querySelector("#page-title");
  const TOPIC_PAGE_SIZE = 20;
  let activeTopic = "all";
  let activePage = "1";

  const byId = new Map(data.tickets.map((ticket) => [ticket.id, ticket]));

  function readState() {
    const state = new URLSearchParams(location.hash.slice(1));
    activeTopic = state.get("topic") || "all";
    activePage = state.get("page") || "1";
  }

  function stateHref(topic = activeTopic, page = activePage) {
    const params = new URLSearchParams();
    if (topic !== "all") {
      params.set("topic", topic);
    }
    if (page !== "1") {
      params.set("page", page);
    }

    const hash = params.toString();
    return \`\${location.pathname}\${hash ? \`#\${hash}\` : ""}\`;
  }

  function shouldHandleNavigation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function scrollPageTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setState(topic, page = "1", scrollToTop = true) {
    activeTopic = topic;
    activePage = page;
    normalizeState();
    history.replaceState(null, "", stateHref());
    render();
    if (scrollToTop) {
      scrollPageTop();
    }
  }

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
        ticketEl.classList.toggle("desc-opened");
      });
    }
  }

  function prepareAnswerControls(ticketEl) {
    ticketEl.querySelectorAll(".t-answer:not(.ans-empty) .t-answer-inner").forEach((inner) => {
      inner.addEventListener("click", () => {
        if (ticketEl.classList.contains("answer-answered")) {
          return;
        }

        const answer = inner.closest(".t-answer");
        if (!answer) {
          return;
        }

        if (answer.hasAttribute("data-is-correct-list")) {
          answer.classList.add("ans-true");
        } else {
          ticketEl.querySelectorAll(".t-answer[data-is-correct-list]").forEach((correctAnswer) => {
            correctAnswer.classList.add("ans-true");
          });
          answer.classList.add("ans-false");
        }

        ticketEl.classList.add("answer-answered");
      });
    });
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

  function currentPages() {
    if (activeTopic === "all") {
      return allPages();
    }

    const count = topicTickets(activeTopic).length;
    const pageCount = Math.max(1, Math.ceil(count / TOPIC_PAGE_SIZE));
    return Array.from({ length: pageCount }, (_, index) => String(index + 1));
  }

  function normalizeState() {
    if (activeTopic !== "all" && !data.topics.some((topic) => topic.id === activeTopic)) {
      activeTopic = "all";
    }

    const pages = currentPages();
    if (!pages.includes(activePage)) {
      activePage = "1";
    }
  }

  function renderTopics() {
    topicsEl.innerHTML = [
      \`<li><a href="\${stateHref("all", "1")}" data-topic="all"><span class="id"></span>Все</a></li>\`,
      ...data.topics.map((topic) => \`<li><a href="\${stateHref(topic.id, "1")}" data-topic="\${topic.id}"><span class="id">\${topic.id}.</span>\${topic.title}</a></li>\`)
    ].join("");

    topicsEl.querySelectorAll("a[data-topic]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (!shouldHandleNavigation(event)) {
          return;
        }

        event.preventDefault();
        setState(link.dataset.topic, "1");
      });
    });
  }

  function paginationHtml() {
    const pages = currentPages();
    if (pages.length <= 1) {
      return "";
    }

    const index = pages.indexOf(activePage);
    const previous = pages[index - 1];
    const next = pages[index + 1];
    const options = pages.map((page) => {
      const selected = page === activePage ? ' selected="selected"' : "";
      const label = page === activePage ? \`- страница \${page} -\` : \`страница \${page}\`;
      const cls = page === activePage ? ' class="noaction"' : "";
      return \`<option\${cls}\${selected} value="\${page}">\${label}</option>\`;
    }).join("");

    return \`<div class="pull-left paginator">
      <a class="btn btn-default page-nav page-prev\${previous ? "" : " disabled"}" href="\${previous ? stateHref(activeTopic, previous) : stateHref()}" data-page="\${previous || activePage}" aria-disabled="\${previous ? "false" : "true"}">‹ Предыдущая</a>
      <select title="Перейти на страницу" class="form-control paginator-select">\${options}</select>
      <a class="btn btn-default page-nav page-next\${next ? "" : " disabled"}" href="\${next ? stateHref(activeTopic, next) : stateHref()}" data-page="\${next || activePage}" aria-disabled="\${next ? "false" : "true"}">Следующая ›</a>
    </div>
    <form class="pull-right goto-ticket">
      <div class="input-group" title="Введите номер билета">
        <span class="input-group-addon">#</span>
        <input type="number" pattern="\\\\d*" name="ticket" class="form-control number-input" placeholder="номер билета">
        <span class="input-group-btn">
          <button class="btn btn-default" type="submit">Перейти</button>
        </span>
      </div>
    </form>\`;
  }

  function bindPagination(container) {
    container.querySelectorAll("a[data-page]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (!shouldHandleNavigation(event)) {
          return;
        }

        event.preventDefault();
        if (link.classList.contains("disabled")) {
          return;
        }

        setState(activeTopic, link.dataset.page);
      });
    });

    container.querySelectorAll("a[data-page]").forEach((link) => {
      link.addEventListener("auxclick", (event) => {
        if (link.classList.contains("disabled")) {
          event.preventDefault();
          return;
        }
      });
    });

    container.querySelector(".paginator-select")?.addEventListener("change", (event) => {
      setState(activeTopic, event.target.value);
    });

    container.querySelector(".paginator-select")?.addEventListener("mousedown", (event) => {
      if (event.button === 1) {
        event.preventDefault();
        window.open(stateHref(activeTopic, event.currentTarget.value), "_blank", "noopener");
      }
    });

    container.querySelector(".paginator-select")?.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        event.preventDefault();
        window.open(stateHref(activeTopic, event.currentTarget.value), "_blank", "noopener");
      }
    });

    container.querySelector(".goto-ticket")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = new FormData(event.currentTarget).get("ticket");
      const ticket = byId.get(String(id || "").trim());
      if (!ticket) {
        return;
      }

      activeTopic = "all";
      activePage = ticket.allPage || "1";
      normalizeState();
      history.replaceState(null, "", stateHref());
      render();
      document.getElementById(\`ticket-\${ticket.id}\`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function renderPagination() {
    const html = paginationHtml();
    paginationTopEl.innerHTML = html;
    paginationBottomEl.innerHTML = html;
    bindPagination(paginationTopEl);
    bindPagination(paginationBottomEl);
  }

  function renderTitle(count) {
    titleEl.textContent = activeTopic === "all"
      ? "AM категория "
      : \`AM категория: \${data.topics.find((topic) => topic.id === activeTopic)?.title || ""} \`;

    const total = topicTickets(activeTopic).length;
    const pages = currentPages();
    const light = document.createElement("span");
    light.className = "light";
    light.textContent = activeTopic === "all"
      ? \`Всего \${data.tickets.length} билетов, страница \${activePage}\`
      : pages.length > 1
        ? \`Всего \${total} билетов, страница \${activePage}\`
        : \`Всего \${count} билетов\`;
    titleEl.append(light);
  }

  function visibleTickets() {
    let filtered = topicTickets(activeTopic);
    if (activeTopic === "all") {
      return filtered.filter((ticket) => ticket.allPage === activePage);
    }

    const pages = currentPages();
    if (pages.length <= 1) {
      return filtered;
    }

    const pageIndex = Math.max(0, Number(activePage) - 1);
    return filtered.slice(pageIndex * TOPIC_PAGE_SIZE, (pageIndex + 1) * TOPIC_PAGE_SIZE);
  }

  function setupScrollTopButton() {
    const button = document.createElement("button");
    button.className = "scroll-top-button";
    button.type = "button";
    button.title = "Наверх";
    button.setAttribute("aria-label", "Наверх");
    button.innerHTML = "↑";
    document.body.append(button);

    const updateVisibility = () => {
      button.classList.toggle("visible", window.scrollY > 350);
    };

    button.addEventListener("click", scrollPageTop);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
  }

  function render() {
    normalizeState();
    const filtered = visibleTickets();

    topicsEl.querySelectorAll("a[data-topic]").forEach((link) => {
      link.href = stateHref(link.dataset.topic, "1");
      link.classList.toggle("active", link.dataset.topic === activeTopic);
    });

    renderTitle(filtered.length);
    renderPagination();
    ticketsEl.innerHTML = filtered.length
      ? filtered.map((ticket) => \`<div class="item" id="ticket-\${ticket.id}">\${ticket.html}</div>\`).join("")
      : '<div class="empty">Ничего не найдено</div>';

    ticketsEl.querySelectorAll(".ticket-container").forEach((ticketEl) => {
      prepareTicketControls(ticketEl);
      prepareAnswerControls(ticketEl);
      applyTranslation(ticketEl);
    });
  }

  renderTopics();
  readState();
  setupScrollTopButton();
  render();
  window.addEventListener("hashchange", () => {
    readState();
    render();
    scrollPageTop();
  });
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
  await writeVendorCss();
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
