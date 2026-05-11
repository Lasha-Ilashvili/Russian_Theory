(function () {
  var translations = window.TEORIA_RU_TRANSLATIONS || {};

  function usableText(value) {
    return typeof value === "string" && value.trim() ? value : null;
  }

  function setText(node, value) {
    var text = usableText(value);
    if (node && text) {
      node.textContent = text;
    }
  }

  function ticketId(ticket) {
    var number = ticket.querySelector(".t-num");
    var match = number && number.textContent.match(/\d+/);
    return match ? match[0] : null;
  }

  function answerNumber(answer, fallback) {
    var number = answer.querySelector(".t-a-num span");
    return number && number.textContent.trim() ? number.textContent.trim() : String(fallback + 1);
  }

  function explanationTarget(ticket) {
    var box = ticket.querySelector(".desc-box-inner");
    if (!box) {
      return null;
    }

    var children = Array.prototype.slice.call(box.children);
    var current = children.find(function (child) {
      return child.tagName === "P" && !child.classList.contains("sorry");
    });

    if (current) {
      return current;
    }

    current = document.createElement("p");
    var ticketLink = box.querySelector(".ticket-link");
    box.insertBefore(current, ticketLink || null);
    return current;
  }

  function applyTicketTranslation(ticket) {
    var id = ticketId(ticket);
    var data = id && translations[id];
    if (!data) {
      return;
    }

    setText(ticket.querySelector(".t-question .text-wrap"), data.question);

    var answers = data.answers || {};
    Array.prototype.forEach.call(ticket.querySelectorAll(".t-answer:not(.ans-empty)"), function (answer, index) {
      var number = answerNumber(answer, index);
      var translated = Array.isArray(answers) ? answers[index] : answers[number];
      setText(answer.querySelector(".t-a-text .text-wrap"), translated);
    });

    setText(explanationTarget(ticket), data.explanation);
  }

  function applyTranslations() {
    Array.prototype.forEach.call(document.querySelectorAll(".ticket-container"), applyTicketTranslation);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTranslations);
  } else {
    applyTranslations();
  }
})();
