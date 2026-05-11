(() => {
  const data = window.TEORIA_AM_DATA || { tickets: [], topics: [] };
  const translations = window.TEORIA_RU_TRANSLATIONS || {};
  const topicsEl = document.querySelector("#topics");
  const paginationTopEl = document.querySelector("#pagination-top");
  const paginationBottomEl = document.querySelector("#pagination-bottom");
  const ticketsEl = document.querySelector("#tickets");
  const titleEl = document.querySelector("#page-title");
  const initialState = new URLSearchParams(location.hash.slice(1));
  let activeTopic = initialState.get("topic") || "all";
  let activePage = initialState.get("page") || "1";

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

  function writeHash() {
    const params = new URLSearchParams();
    if (activeTopic !== "all") {
      params.set("topic", activeTopic);
    }
    if (activeTopic === "all" && activePage !== "1") {
      params.set("page", activePage);
    }

    const hash = params.toString();
    history.replaceState(null, "", hash ? `${location.pathname}#${hash}` : location.pathname);
  }

  function renderTopics() {
    topicsEl.innerHTML = [
      `<li><a href="#" data-topic="all"><span class="id"></span>Все</a></li>`,
      ...data.topics.map((topic) => `<li><a href="#" data-topic="${topic.id}"><span class="id">${topic.id}.</span>${topic.title}</a></li>`)
    ].join("");

    topicsEl.querySelectorAll("a[data-topic]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        activeTopic = link.dataset.topic;
        activePage = "1";
        writeHash();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function paginationHtml() {
    if (activeTopic !== "all") {
      return "";
    }

    const pages = allPages();
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
      <button class="btn btn-default page-prev" type="button"${previous ? "" : " disabled"}>‹ Предыдущая</button>
      <select title="" class="form-control paginator-select">${options}</select>
      <button class="btn btn-default page-next" type="button"${next ? "" : " disabled"}>Следующая ›</button>
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
    const pages = allPages();
    const index = pages.indexOf(activePage);
    const previous = pages[index - 1];
    const next = pages[index + 1];

    container.querySelector(".paginator-select")?.addEventListener("change", (event) => {
      activePage = event.target.value;
      writeHash();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    container.querySelector(".page-prev")?.addEventListener("click", () => {
      if (previous) {
        activePage = previous;
        writeHash();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    container.querySelector(".page-next")?.addEventListener("click", () => {
      if (next) {
        activePage = next;
        writeHash();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
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
      writeHash();
      render();
      document.getElementById(`ticket-${ticket.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
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

    const light = document.createElement("span");
    light.className = "light";
    light.textContent = activeTopic === "all"
      ? `Всего ${data.tickets.length} билетов, страница ${activePage}`
      : `Всего ${count} билетов`;
    titleEl.append(light);
  }

  function render() {
    let filtered = topicTickets(activeTopic);
    if (activeTopic === "all") {
      filtered = filtered.filter((ticket) => ticket.allPage === activePage);
    }

    topicsEl.querySelectorAll("a[data-topic]").forEach((link) => {
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
  render();
})();
