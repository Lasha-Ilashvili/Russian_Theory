(() => {
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
    history.replaceState(null, "", hash ? `${location.pathname}#${hash}` : location.pathname);
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
      return `<button class="topic-button" type="button" data-topic="${topic.id}"><span>${topic.id}. ${topic.title}</span><span class="topic-count">${count}</span></button>`;
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
      `<button class="page-button page-button-all" type="button" data-page="all">Все</button>`,
      ...allPages().map((page) => `<button class="page-button" type="button" data-page="${page}">${page}</button>`)
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
    summaryEl.textContent = `Показано ${filtered.length} из ${data.tickets.length}`;
    ticketsEl.innerHTML = filtered.length
      ? filtered.map((ticket) => `<div class="ticket-shell" id="ticket-${ticket.id}">${ticket.html}</div>`).join("")
      : '<div class="empty">Ничего не найдено</div>';

    ticketsEl.querySelectorAll(".ticket-container").forEach((ticketEl) => {
      prepareTicketControls(ticketEl);
      applyTranslation(ticketEl);
    });
  }

  searchEl.addEventListener("input", render);
  renderTopics();
  render();
})();
