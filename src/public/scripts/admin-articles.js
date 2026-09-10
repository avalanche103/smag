(() => {
  document.querySelectorAll("[data-copy-trigger]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.getAttribute("data-copy-target");
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        const original = button.textContent;
        button.textContent = "Скопировано";
        window.setTimeout(() => {
          button.textContent = original || "Копировать";
        }, 1600);
      } catch {
        window.prompt("Скопируйте ссылку:", value);
      }
    });
  });
})();
