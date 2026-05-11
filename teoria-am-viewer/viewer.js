(() => {
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

  function appPath() {
    return location.pathname.replace(/\/index\.html$/i, "/") || "/";
  }

  function normalizeUrlPath() {
    const cleanPath = appPath();
    if (cleanPath !== location.pathname) {
      history.replaceState(null, "", `${cleanPath}${location.hash || ""}`);
    }
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
    return `${appPath()}${hash ? `#${hash}` : ""}`;
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
    const id = ticketEl.querySelector(".t-num")?.textContent.match(/\d+/)?.[0];
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
      `<li><a href="${stateHref("all", "1")}" data-topic="all"><span class="id"></span>Все</a></li>`,
      ...data.topics.map((topic) => `<li><a href="${stateHref(topic.id, "1")}" data-topic="${topic.id}"><span class="id">${topic.id}.</span>${topic.title}</a></li>`)
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
      const label = page === activePage ? `- страница ${page} -` : `страница ${page}`;
      const cls = page === activePage ? ' class="noaction"' : "";
      return `<option${cls}${selected} value="${page}">${label}</option>`;
    }).join("");

    return `<div class="pull-left paginator">
      <a class="btn btn-default page-nav page-prev${previous ? "" : " disabled"}" href="${previous ? stateHref(activeTopic, previous) : stateHref()}" data-page="${previous || activePage}" aria-disabled="${previous ? "false" : "true"}">‹ Предыдущая</a>
      <select title="Перейти на страницу" class="form-control paginator-select">${options}</select>
      <a class="btn btn-default page-nav page-next${next ? "" : " disabled"}" href="${next ? stateHref(activeTopic, next) : stateHref()}" data-page="${next || activePage}" aria-disabled="${next ? "false" : "true"}">Следующая ›</a>
    </div>
    <form class="pull-right goto-ticket">
      <div class="input-group" title="Введите номер билета">
        <span class="input-group-addon">#</span>
        <input type="number" pattern="\\d*" name="ticket" class="form-control number-input" placeholder="номер билета">
        <span class="input-group-btn">
          <button class="btn btn-default" type="submit">Перейти</button>
        </span>
      </div>
    </form>`;
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
      if (event.button !== 1) {
        return;
      }

      event.preventDefault();

      const page = event.currentTarget.value;
      window.open(stateHref(activeTopic, page), "_blank", "noopener");
    });

    container.querySelector(".goto-ticket")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const id = String(new FormData(event.currentTarget).get("ticket") || "").trim();
      if (!id) {
        return;
      }

      const ticketsInCurrentTopic = topicTickets(activeTopic);
      const index = ticketsInCurrentTopic.findIndex((ticket) => String(ticket.id) === id);

      if (index === -1) {
        return;
      }

      if (activeTopic === "all") {
        const ticket = ticketsInCurrentTopic[index];
        activePage = ticket.allPage || "1";
      } else {
        activePage = String(Math.floor(index / TOPIC_PAGE_SIZE) + 1);
      }

      normalizeState();
      history.replaceState(null, "", stateHref());
      render();

      document.getElementById(`ticket-${id}`)?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
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
      : `AM категория: ${data.topics.find((topic) => topic.id === activeTopic)?.title || ""} `;

    const total = topicTickets(activeTopic).length;
    const pages = currentPages();
    const light = document.createElement("span");
    light.className = "light";
    light.textContent = activeTopic === "all"
      ? `Всего ${data.tickets.length} билетов, страница ${activePage}`
      : pages.length > 1
        ? `Всего ${total} билетов, страница ${activePage}`
        : `Всего ${count} билетов`;
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
      ? filtered.map((ticket) => `<div class="item" id="ticket-${ticket.id}">${ticket.html}</div>`).join("")
      : '<div class="empty">Ничего не найдено</div>';

    ticketsEl.querySelectorAll(".ticket-container").forEach((ticketEl) => {
      prepareTicketControls(ticketEl);
      prepareAnswerControls(ticketEl);
      applyTranslation(ticketEl);
    });
  }

  renderTopics();
  readState();
  normalizeUrlPath();
  setupScrollTopButton();
  render();
  window.addEventListener("hashchange", () => {
    readState();
    render();
    scrollPageTop();
  });
})();
