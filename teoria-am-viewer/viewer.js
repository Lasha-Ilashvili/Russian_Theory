(() => {
  const datasets = {
    ru: window.TEORIA_AM_DATA || { tickets: [], topics: [] },
    ka: window.TEORIA_AM_DATA_KA || null
  };
  const ruTranslations = window.TEORIA_RU_TRANSLATIONS || {};
  const topicsEl = document.querySelector("#topics");
  const topicsTitleEl = document.querySelector(".tickets-cats-title");
  const pageTicketsListEl = document.querySelector(".page-tickets-list");
  const ticketBrowserEl = document.querySelector("#ticket-browser");
  const paginationTopEl = document.querySelector("#pagination-top");
  const paginationBottomEl = document.querySelector("#pagination-bottom");
  const ticketsEl = document.querySelector("#tickets");
  const titleEl = document.querySelector("#page-title");
  const darkModeToggle = document.querySelector("#dark-mode-toggle");
  const languageSwitch = document.querySelector("#language-switch");
  const viewSwitch = document.querySelector("#view-switch");
  const examSetupEl = document.querySelector("#exam-setup");
  const examSetupToggle = document.querySelector("#exam-setup-toggle");
  const examSetupBody = document.querySelector("#exam-setup-body");
  const examKickerEl = document.querySelector("#exam-kicker");
  const examTitleEl = document.querySelector("#exam-title");
  const examSummaryEl = document.querySelector("#exam-summary");
  const examSelectedSummaryEl = document.querySelector("#exam-selected-summary");
  const examTopicGridEl = document.querySelector("#exam-topic-grid");
  const examToggleAllInput = document.querySelector("#exam-toggle-all");
  const examToggleAllLabel = document.querySelector("#exam-toggle-all-label");
  const examCountTitleEl = document.querySelector("#exam-count-title");
  const examCountResultEl = document.querySelector("#exam-count-result");
  const examCountOptionsEl = document.querySelector(".exam-count-options");
  const examStandardLabelEl = document.querySelector("#exam-standard-label");
  const examStandardDetailEl = document.querySelector("#exam-standard-detail");
  const examExtendedLabelEl = document.querySelector("#exam-extended-label");
  const examCountInput = document.querySelector("#exam-count-input");
  const examCountMaxButton = document.querySelector("#exam-count-max");
  const examCountNoteEl = document.querySelector("#exam-count-note");
  const TOPIC_PAGE_SIZE = 20;
  const STANDARD_EXAM_COUNT = 30;
  const EXTENDED_EXAM_DEFAULT = 150;
  const LANGUAGE_STORAGE_KEY = "teoria-am-language";
  const copyByLanguage = {
    ru: {
      all: "Все",
      category: "AM категория",
      chooseTopic: "Выберите тему:",
      darkMode: "Переключить темный режим",
      empty: "Ничего не найдено",
      examAvailable: "доступно",
      examCollapsed: "Показать настройки",
      examCountNote: "Расширенный режим принимает любое число от 31 до доступного максимума.",
      examCountTitle: "Количество вопросов",
      examExpanded: "Скрыть настройки",
      examExtended: "Расширенный",
      examKicker: "Экзамен",
      examMax: "Все",
      examNoTopics: "Выберите хотя бы одну тему",
      examQuestions: "вопросов",
      examResult: "В экзамене",
      examSelectAll: "Выбрать все",
      examSelected: "Выбрано",
      examSomeSelected: "Часть тем",
      examStandard: "Обычный тест",
      examSummarySeparator: "из",
      examTitle: "Темы билетов:",
      examTopicCount: "тем",
      examTopicTicketCount: "билетов",
      explanation: "Пояснение",
      gotoButton: "Перейти",
      gotoPlaceholder: "номер билета",
      gotoTitle: "Введите номер билета",
      next: "Следующая",
      page: "страница",
      previous: "Предыдущая",
      ticketPlural: "билетов",
      top: "Наверх",
      total: "Всего",
      viewLabel: "Раздел",
      viewTest: "Тестирование",
      viewTickets: "Билеты"
    },
    ka: {
      all: "ყველა",
      category: "AM კატეგორია",
      chooseTopic: "აირჩიეთ თემა:",
      darkMode: "მუქი რეჟიმის გადართვა",
      empty: "ვერაფერი მოიძებნა",
      examAvailable: "ხელმისაწვდომია",
      examCollapsed: "პარამეტრების ჩვენება",
      examCountNote: "გაფართოებული რეჟიმი იღებს ნებისმიერ რიცხვს 31-დან არჩეული თემების მაქსიმუმამდე.",
      examCountTitle: "კითხვების რაოდენობა",
      examExpanded: "პარამეტრების დამალვა",
      examExtended: "გაფართოებული",
      examKicker: "გამოცდა",
      examMax: "ყველა",
      examNoTopics: "აირჩიეთ მინიმუმ ერთი თემა",
      examQuestions: "კითხვა",
      examResult: "გამოცდაში",
      examSelectAll: "ყველას არჩევა",
      examSelected: "არჩეულია",
      examSomeSelected: "ნაწილი არჩეულია",
      examStandard: "ჩვეულებრივი ტესტი",
      examSummarySeparator: "/",
      examTitle: "ბილეთების თემები:",
      examTopicCount: "თემა",
      examTopicTicketCount: "ბილეთი",
      explanation: "განმარტება",
      gotoButton: "გადასვლა",
      gotoPlaceholder: "ბილეთის ნომერი",
      gotoTitle: "შეიყვანეთ ბილეთის ნომერი",
      next: "შემდეგი",
      page: "გვერდი",
      previous: "წინა",
      ticketPlural: "ბილეთი",
      top: "ზემოთ",
      total: "სულ",
      viewLabel: "განყოფილება",
      viewTest: "ტესტირება",
      viewTickets: "ბილეთები"
    }
  };
  const viewLabels = {
    tickets: "viewTickets",
    test: "viewTest"
  };
  let activeTopic = "all";
  let activePage = "1";
  let activeView = "tickets";
  let activeLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "ru";
  if (!datasets[activeLanguage]) {
    activeLanguage = "ru";
  }
  let data = datasets[activeLanguage];
  let translations = activeLanguage === "ru" ? ruTranslations : {};

  let byId = new Map(data.tickets.map((ticket) => [ticket.id, ticket]));
  let selectedExamTopics = new Set(data.topics.map((topic) => topic.id));
  let examCountMode = "standard";
  let extendedExamCount = EXTENDED_EXAM_DEFAULT;

  function copy() {
    return copyByLanguage[activeLanguage] || copyByLanguage.ru;
  }

  function setLanguageDataset(language) {
    activeLanguage = datasets[language] ? language : "ru";
    data = datasets[activeLanguage];
    translations = activeLanguage === "ru" ? ruTranslations : {};
    byId = new Map(data.tickets.map((ticket) => [ticket.id, ticket]));
  }

  function readState() {
    const previousLanguage = activeLanguage;
    const previousView = activeView;
    const state = new URLSearchParams(location.hash.slice(1));
    const requestedLanguage = state.get("lang");
    if (requestedLanguage && datasets[requestedLanguage]) {
      setLanguageDataset(requestedLanguage);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLanguage);
    }
    activeView = state.get("view") === "test" ? "test" : "tickets";
    activeTopic = state.get("topic") || "all";
    activePage = state.get("page") || "1";
    return {
      languageChanged: previousLanguage !== activeLanguage,
      viewChanged: previousView !== activeView
    };
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

  function stateHref(topic = activeTopic, page = activePage, view = activeView) {
    const params = new URLSearchParams();
    if (activeLanguage !== "ru") {
      params.set("lang", activeLanguage);
    }
    if (view === "test") {
      params.set("view", "test");
    }
    if (view !== "test" && topic !== "all") {
      params.set("topic", topic);
    }
    if (view !== "test" && page !== "1") {
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
    activeView = "tickets";
    activeTopic = topic;
    activePage = page;
    normalizeState();
    history.replaceState(null, "", stateHref());
    render();
    if (scrollToTop) {
      scrollPageTop();
    }
  }

  function setView(view, scrollToTop = true) {
    activeView = view === "test" ? "test" : "tickets";
    history.replaceState(null, "", stateHref());
    render();
    if (scrollToTop) {
      scrollPageTop();
    }
  }

  function updateViewSwitch() {
    viewSwitch?.setAttribute("aria-label", copy().viewLabel);
    viewSwitch?.querySelectorAll("[data-view]").forEach((button) => {
      const view = button.dataset.view === "test" ? "test" : "tickets";
      const isActive = view === activeView;
      button.textContent = copy()[viewLabels[view]];
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    });
  }

  function updateActiveView() {
    const isTestView = activeView === "test";
    pageTicketsListEl?.classList.toggle("view-test", isTestView);
    pageTicketsListEl?.classList.toggle("view-tickets", !isTestView);
    if (examSetupEl) {
      examSetupEl.hidden = !isTestView;
    }
    if (ticketBrowserEl) {
      ticketBrowserEl.hidden = isTestView;
    }
    updateViewSwitch();
  }

  function updateLanguageSwitch() {
    document.documentElement.lang = activeLanguage;
    document.body.dataset.language = activeLanguage;
    document.title = activeLanguage === "ka" ? "ქართული თეორია" : "Russian Theory";
    if (topicsTitleEl) {
      topicsTitleEl.textContent = copy().chooseTopic;
    }

    languageSwitch?.querySelectorAll("[data-language]").forEach((button) => {
      const isActive = button.dataset.language === activeLanguage;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (darkModeToggle) {
      darkModeToggle.title = copy().darkMode;
      darkModeToggle.setAttribute("aria-label", copy().darkMode);
    }

    const scrollTopButton = document.querySelector(".scroll-top-button");
    if (scrollTopButton) {
      scrollTopButton.title = copy().top;
      scrollTopButton.setAttribute("aria-label", copy().top);
    }
  }

  function setLanguage(language) {
    if (!datasets[language] || language === activeLanguage) {
      return;
    }

    setLanguageDataset(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLanguage);
    updateLanguageSwitch();
    updateViewSwitch();
    history.replaceState(null, "", stateHref());
    renderTopics();
    renderExamSetup();
    normalizeState();
    render();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function syncExamTopicSelectionForData() {
    const validTopicIds = new Set(data.topics.map((topic) => topic.id));
    selectedExamTopics = new Set([...selectedExamTopics].filter((id) => validTopicIds.has(id)));
  }

  function selectedExamTickets() {
    const ticketIds = new Set();
    data.topics.forEach((topic) => {
      if (selectedExamTopics.has(topic.id)) {
        topic.tickets.forEach((id) => ticketIds.add(id));
      }
    });

    return [...ticketIds].map((id) => byId.get(id)).filter(Boolean);
  }

  function normalizeExamCount(availableCount) {
    if (availableCount <= STANDARD_EXAM_COUNT) {
      examCountMode = "standard";
      return;
    }

    if (examCountMode !== "extended") {
      return;
    }

    if (!Number.isFinite(extendedExamCount) || extendedExamCount <= STANDARD_EXAM_COUNT) {
      examCountMode = "standard";
      return;
    }

    extendedExamCount = Math.min(Math.floor(extendedExamCount), availableCount);
  }

  function currentExamQuestionCount(availableCount) {
    normalizeExamCount(availableCount);
    return examCountMode === "extended"
      ? extendedExamCount
      : Math.min(STANDARD_EXAM_COUNT, availableCount);
  }

  function setExamCountMode(mode) {
    const availableCount = selectedExamTickets().length;
    if (mode === "extended" && availableCount > STANDARD_EXAM_COUNT) {
      examCountMode = "extended";
      extendedExamCount = Math.min(Math.max(extendedExamCount, EXTENDED_EXAM_DEFAULT), availableCount);
    } else {
      examCountMode = "standard";
    }
    renderExamSetup();
  }

  function renderExamSetup() {
    if (!examSetupEl) {
      return;
    }

    syncExamTopicSelectionForData();
    const copyText = copy();
    const selectedTopicsCount = selectedExamTopics.size;
    const availableCount = selectedExamTickets().length;
    const questionCount = currentExamQuestionCount(availableCount);
    const canExtend = availableCount > STANDARD_EXAM_COUNT;
    const allTopicsSelected = selectedTopicsCount === data.topics.length;
    const noTopicsSelected = selectedTopicsCount === 0;

    if (examSetupBody) {
      examSetupBody.hidden = false;
    }
    if (examSetupToggle) {
      examSetupToggle.title = copyText.examExpanded;
    }

    if (examKickerEl) {
      examKickerEl.textContent = copyText.examKicker;
    }
    if (examTitleEl) {
      examTitleEl.textContent = copyText.examTitle;
    }
    if (examSummaryEl) {
      examSummaryEl.textContent = noTopicsSelected
        ? copyText.examNoTopics
        : `${questionCount} ${copyText.examQuestions}, ${selectedTopicsCount} ${copyText.examSummarySeparator} ${data.topics.length} ${copyText.examTopicCount}`;
    }
    if (examSelectedSummaryEl) {
      examSelectedSummaryEl.textContent = noTopicsSelected
        ? copyText.examNoTopics
        : `${copyText.examSelected}: ${selectedTopicsCount} ${copyText.examSummarySeparator} ${data.topics.length} ${copyText.examTopicCount}; ${availableCount} ${copyText.examAvailable}`;
    }
    if (examToggleAllInput) {
      examToggleAllInput.checked = allTopicsSelected;
      examToggleAllInput.indeterminate = !allTopicsSelected && !noTopicsSelected;
      examToggleAllInput.setAttribute("aria-checked", examToggleAllInput.indeterminate ? "mixed" : String(allTopicsSelected));
    }
    if (examToggleAllLabel) {
      examToggleAllLabel.textContent = allTopicsSelected
        ? copyText.examSelected
        : noTopicsSelected
          ? copyText.examSelectAll
          : copyText.examSomeSelected;
    }
    if (examCountTitleEl) {
      examCountTitleEl.textContent = copyText.examCountTitle;
    }
    if (examCountOptionsEl) {
      examCountOptionsEl.setAttribute("aria-label", copyText.examCountTitle);
    }
    if (examCountResultEl) {
      examCountResultEl.textContent = `${copyText.examResult}: ${questionCount} ${copyText.examQuestions}`;
    }
    if (examStandardLabelEl) {
      examStandardLabelEl.textContent = copyText.examStandard;
    }
    if (examStandardDetailEl) {
      examStandardDetailEl.textContent = `${STANDARD_EXAM_COUNT} ${copyText.examTopicTicketCount}`;
    }
    if (examExtendedLabelEl) {
      examExtendedLabelEl.textContent = copyText.examExtended;
    }
    if (examCountMaxButton) {
      examCountMaxButton.textContent = copyText.examMax;
      examCountMaxButton.disabled = !canExtend;
    }
    if (examCountInput) {
      const inputValue = canExtend
        ? Math.min(Math.max(extendedExamCount, STANDARD_EXAM_COUNT + 1), availableCount)
        : availableCount;
      examCountInput.value = String(inputValue);
      examCountInput.max = String(Math.max(STANDARD_EXAM_COUNT + 1, availableCount));
      examCountInput.disabled = !canExtend;
    }
    if (examCountNoteEl) {
      examCountNoteEl.textContent = noTopicsSelected
        ? copyText.examNoTopics
        : `${copyText.examAvailable}: ${availableCount}. ${copyText.examCountNote}`;
    }

    document.querySelectorAll('input[name="exam-count-mode"]').forEach((radio) => {
      radio.checked = radio.value === examCountMode;
      radio.disabled = radio.value === "extended" && !canExtend;
      radio.closest(".exam-count-option")?.classList.toggle("active", radio.checked);
      radio.closest(".exam-count-option")?.classList.toggle("disabled", radio.disabled);
    });

    if (examTopicGridEl) {
      examTopicGridEl.innerHTML = data.topics.map((topic) => {
        const checked = selectedExamTopics.has(topic.id);
        return `<label class="exam-topic-option${checked ? " active" : ""}">
          <input type="checkbox" value="${escapeHtml(topic.id)}"${checked ? " checked" : ""}>
          <span class="exam-topic-index">${escapeHtml(topic.id)}.</span>
          <span class="exam-topic-name">${escapeHtml(topic.title)}</span>
          <span class="exam-topic-count">${topic.tickets.length}</span>
        </label>`;
      }).join("");
    }
  }

  function setupExamControls() {
    examToggleAllInput?.addEventListener("change", () => {
      const allTopicsSelected = selectedExamTopics.size === data.topics.length;
      selectedExamTopics = allTopicsSelected
        ? new Set()
        : new Set(data.topics.map((topic) => topic.id));
      renderExamSetup();
    });

    examTopicGridEl?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) {
        return;
      }

      if (checkbox.checked) {
        selectedExamTopics.add(checkbox.value);
      } else {
        selectedExamTopics.delete(checkbox.value);
      }
      renderExamSetup();
    });

    document.querySelectorAll('input[name="exam-count-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        setExamCountMode(radio.value);
      });
    });

    examCountOptionsEl?.addEventListener("click", (event) => {
      if (event.target.closest(".exam-count-input, .exam-max-button")) {
        return;
      }

      const option = event.target.closest(".exam-count-option");
      if (!option || !examCountOptionsEl.contains(option)) {
        return;
      }

      const radio = option.querySelector('input[name="exam-count-mode"]');
      if (!radio || radio.disabled) {
        return;
      }

      setExamCountMode(radio.value);
    });

    examCountInput?.addEventListener("input", () => {
      const value = Number(examCountInput.value);
      const availableCount = selectedExamTickets().length;
      if (!Number.isFinite(value) || value <= STANDARD_EXAM_COUNT || availableCount <= STANDARD_EXAM_COUNT) {
        return;
      }

      examCountMode = "extended";
      extendedExamCount = Math.min(Math.floor(value), availableCount);
      renderExamSetup();
    });

    examCountInput?.addEventListener("change", () => {
      const value = Number(examCountInput.value);
      const availableCount = selectedExamTickets().length;
      if (!Number.isFinite(value) || value <= STANDARD_EXAM_COUNT || availableCount <= STANDARD_EXAM_COUNT) {
        examCountMode = "standard";
      } else {
        examCountMode = "extended";
        extendedExamCount = Math.min(Math.floor(value), availableCount);
      }
      renderExamSetup();
    });

    examCountMaxButton?.addEventListener("click", () => {
      const availableCount = selectedExamTickets().length;
      if (availableCount <= STANDARD_EXAM_COUNT) {
        examCountMode = "standard";
      } else {
        examCountMode = "extended";
        extendedExamCount = availableCount;
      }
      renderExamSetup();
    });
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
      descTitle.firstChild.textContent = copy().explanation;
    }

    if (descButton) {
      descButton.setAttribute("title", copy().explanation);
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
      `<li><a href="${stateHref("all", "1", "tickets")}" data-topic="all"><span class="id"></span>${copy().all}</a></li>`,
      ...data.topics.map((topic) => `<li><a href="${stateHref(topic.id, "1", "tickets")}" data-topic="${topic.id}"><span class="id">${topic.id}.</span>${topic.title}</a></li>`)
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
    const pageLinks = pages.map((page) => {
      const href = stateHref(activeTopic, page);
      const isActive = page === activePage;
      return `<a href="${href}" data-page-select="${page}" class="page-select-item${isActive ? " active" : ""}" title="${copy().gotoButton}: ${copy().page} ${page}">${copy().page} ${page}</a>`;
    }).join("");

    return `<div class="pull-left paginator">
      <a class="btn btn-default page-nav page-prev${previous ? "" : " disabled"}" href="${previous ? stateHref(activeTopic, previous) : stateHref()}" data-page="${previous || activePage}" aria-disabled="${previous ? "false" : "true"}">‹ ${copy().previous}</a>
      <div class="page-select-dropdown">
        <button type="button" class="btn btn-default page-select-toggle" title="${copy().gotoButton}">${copy().page} ${activePage}</button>
        <div class="page-select-menu">
          ${pageLinks}
        </div>
      </div>
      <a class="btn btn-default page-nav page-next${next ? "" : " disabled"}" href="${next ? stateHref(activeTopic, next) : stateHref()}" data-page="${next || activePage}" aria-disabled="${next ? "false" : "true"}">${copy().next} ›</a>
    </div>
    <form class="pull-right goto-ticket">
      <div class="input-group" title="${copy().gotoTitle}">
        <span class="input-group-addon">#</span>
        <input type="number" pattern="\\d*" name="ticket" class="form-control number-input" placeholder="${copy().gotoPlaceholder}">
        <span class="input-group-btn">
          <button class="btn btn-default" type="submit">${copy().gotoButton}</button>
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

    container.querySelectorAll("a[data-page-select]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (!shouldHandleNavigation(event)) {
          return;
        }

        event.preventDefault();
        const page = link.dataset.pageSelect;
        setState(activeTopic, page);
      });
    });

    const pageSelectDropdown = container.querySelector(".page-select-dropdown");
    if (pageSelectDropdown) {
      const toggle = pageSelectDropdown.querySelector(".page-select-toggle");
      const menu = pageSelectDropdown.querySelector(".page-select-menu");

      toggle?.addEventListener("click", () => {
        menu?.classList.toggle("open");
        toggle?.classList.toggle("open");
      });

      document.addEventListener("click", (event) => {
        if (!pageSelectDropdown.contains(event.target)) {
          menu?.classList.remove("open");
          toggle?.classList.remove("open");
        }
      });
    }

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
      ? `${copy().category} `
      : `${copy().category}: ${data.topics.find((topic) => topic.id === activeTopic)?.title || ""} `;

    const total = topicTickets(activeTopic).length;
    const pages = currentPages();
    const light = document.createElement("span");
    light.className = "light";
    light.textContent = activeTopic === "all"
      ? `${copy().total} ${data.tickets.length} ${copy().ticketPlural}, ${copy().page} ${activePage}`
      : pages.length > 1
        ? `${copy().total} ${total} ${copy().ticketPlural}, ${copy().page} ${activePage}`
        : `${copy().total} ${count} ${copy().ticketPlural}`;
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
    button.title = copy().top;
    button.setAttribute("aria-label", copy().top);
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
    updateActiveView();

    topicsEl.querySelectorAll("a[data-topic]").forEach((link) => {
      link.href = stateHref(link.dataset.topic, "1", "tickets");
      link.classList.toggle("active", link.dataset.topic === activeTopic);
    });

    if (activeView === "test") {
      renderExamSetup();
      return;
    }

    const filtered = visibleTickets();
    renderTitle(filtered.length);
    renderPagination();
    ticketsEl.innerHTML = filtered.length
      ? filtered.map((ticket) => `<div class="item" id="ticket-${ticket.id}">${ticket.html}</div>`).join("")
      : `<div class="empty">${copy().empty}</div>`;

    ticketsEl.querySelectorAll(".ticket-container").forEach((ticketEl) => {
      prepareTicketControls(ticketEl);
      prepareAnswerControls(ticketEl);
      applyTranslation(ticketEl);
    });
  }

  languageSwitch?.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.language);
    });
  });

  viewSwitch?.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  readState();
  normalizeUrlPath();
  updateLanguageSwitch();
  updateViewSwitch();
  renderTopics();
  setupExamControls();
  renderExamSetup();
  setupScrollTopButton();
  
  // Initialize dark mode
  const isDarkMode = localStorage.getItem("dark-mode") === "true";
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
    darkModeToggle?.classList.add("active");
    darkModeToggle && (darkModeToggle.querySelector(".toggle-icon").textContent = "☀️");
  }
  
  darkModeToggle?.addEventListener("click", () => {
    const isNowDark = document.body.classList.toggle("dark-mode");
    darkModeToggle.classList.toggle("active");
    darkModeToggle.querySelector(".toggle-icon").textContent = isNowDark ? "☀️" : "🌙";
    localStorage.setItem("dark-mode", isNowDark);
  });
  
  render();
  window.addEventListener("hashchange", () => {
    const { languageChanged } = readState();
    updateLanguageSwitch();
    updateViewSwitch();
    if (languageChanged) {
      renderTopics();
      renderExamSetup();
    }
    render();
    scrollPageTop();
  });
})();
