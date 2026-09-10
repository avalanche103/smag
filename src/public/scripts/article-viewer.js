import * as pdfjsLib from "/scripts/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/scripts/pdfjs/pdf.worker.min.mjs";

const root = document.querySelector("[data-article-viewer]");
if (root) {
  const reader = root.querySelector("[data-pdf-reader]");
  const stage = root.querySelector("[data-pdf-stage]");
  const spreadEl = root.querySelector("[data-pdf-spread]");
  const leftPageEl = root.querySelector(".article-spread-page-left");
  const rightPageEl = root.querySelector(".article-spread-page-right");
  const leftCanvas = root.querySelector("[data-pdf-canvas-left]");
  const rightCanvas = root.querySelector("[data-pdf-canvas-right]");
  const leftBlank = root.querySelector("[data-pdf-blank-left]");
  const rightBlank = root.querySelector("[data-pdf-blank-right]");
  const status = root.querySelector("[data-pdf-status]");
  const pageLabel = root.querySelector("[data-pdf-page-label]");
  const openBtn = root.querySelector("[data-pdf-open]");
  const closeBtn = root.querySelector("[data-pdf-close]");
  const prevBtn = root.querySelector("[data-pdf-prev]");
  const nextBtn = root.querySelector("[data-pdf-next]");
  const zoomInBtn = root.querySelector("[data-pdf-zoom-in]");
  const zoomOutBtn = root.querySelector("[data-pdf-zoom-out]");
  const loupeBtn = root.querySelector("[data-pdf-loupe]");

  const streamUrl = stage?.getAttribute("data-stream-url") || "";
  const viewToken = stage?.getAttribute("data-view-token") || "";
  const startSide = root.getAttribute("data-start-side") === "left" ? "left" : "right";
  const mobileQuery = window.matchMedia("(max-width: 820px)");

  let pdfDoc = null;
  let viewIndex = 0;
  let rendering = false;
  let pendingIndex = null;
  let loadPromise = null;
  let zoomFactor = 1;
  let wasSinglePage = mobileQuery.matches;
  const LOUPE_ZOOM = 1.75;

  function isSinglePageMode() {
    return mobileQuery.matches;
  }

  function setStatus(message) {
    if (!status) {
      return;
    }
    status.textContent = message || "";
    status.hidden = !message;
  }

  function blockEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function syncModeClass() {
    const single = isSinglePageMode();
    reader?.classList.toggle("is-single-page", single);
    stage?.classList.toggle("is-single-page", single);
  }

  function syncZoomUi() {
    const zoomed = zoomFactor > 1.01;
    stage?.classList.toggle("is-zoomed", zoomed);
    loupeBtn?.setAttribute("aria-pressed", zoomed ? "true" : "false");
    if (zoomOutBtn) {
      zoomOutBtn.disabled = zoomFactor <= 1;
    }
    if (zoomInBtn) {
      zoomInBtn.disabled = zoomFactor >= 3;
    }
  }

  function totalViews() {
    if (!pdfDoc) {
      return 0;
    }
    return isSinglePageMode() ? pdfDoc.numPages : Math.max(1, Math.ceil(pdfDoc.numPages / 2));
  }

  function firstPageOfView(index, single) {
    if (!pdfDoc) {
      return 1;
    }
    if (single) {
      return Math.min(pdfDoc.numPages, Math.max(1, index + 1));
    }
    if (startSide === "right") {
      if (index === 0) {
        return 1;
      }
      return Math.min(pdfDoc.numPages, index * 2);
    }
    return Math.min(pdfDoc.numPages, index * 2 + 1);
  }

  function viewIndexForPage(pageNumber, single) {
    if (!pdfDoc) {
      return 0;
    }
    const page = Math.min(pdfDoc.numPages, Math.max(1, pageNumber));
    if (single) {
      return page - 1;
    }
    if (startSide === "right") {
      if (page <= 1) {
        return 0;
      }
      return Math.floor(page / 2);
    }
    return Math.floor((page - 1) / 2);
  }

  function pagesForView(index) {
    if (!pdfDoc) {
      return { left: null, right: null };
    }

    if (isSinglePageMode()) {
      const page = index + 1;
      return {
        left: page <= pdfDoc.numPages ? page : null,
        right: null
      };
    }

    if (startSide === "right") {
      if (index === 0) {
        return { left: null, right: 1 };
      }
      const left = index * 2;
      const right = index * 2 + 1;
      return {
        left: left <= pdfDoc.numPages ? left : null,
        right: right <= pdfDoc.numPages ? right : null
      };
    }

    const left = index * 2 + 1;
    const right = index * 2 + 2;
    return {
      left: left <= pdfDoc.numPages ? left : null,
      right: right <= pdfDoc.numPages ? right : null
    };
  }

  root.addEventListener("contextmenu", blockEvent);
  root.addEventListener("dragstart", blockEvent);
  document.addEventListener("keydown", (event) => {
    if (!reader || reader.hidden) {
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ["s", "p", "u", "c"].includes(key)) {
      blockEvent(event);
    }
    if (key === "escape") {
      closeReader();
    }
    if (key === "arrowleft") {
      goPrev();
    }
    if (key === "arrowright") {
      goNext();
    }
    if (key === "+" || key === "=") {
      bumpZoom(0.25);
    }
    if (key === "-" || key === "_") {
      bumpZoom(-0.25);
    }
  });
  window.addEventListener("beforeprint", () => {
    root.classList.add("is-print-blocked");
  });
  window.addEventListener("afterprint", () => {
    root.classList.remove("is-print-blocked");
  });

  async function measurePage(pageNumber) {
    if (!pageNumber || !pdfDoc) {
      return null;
    }
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    return { page, width: viewport.width, height: viewport.height };
  }

  function fitScaleForPages(leftSize, rightSize, single) {
    if (!stage) {
      return 1;
    }

    const pad = zoomFactor > 1.01 ? 24 : 8;
    const availableWidth = Math.max(120, stage.clientWidth - pad);
    const availableHeight = Math.max(120, stage.clientHeight - pad);
    const pageWidth = leftSize?.width || rightSize?.width || 1;
    const pageHeight = leftSize?.height || rightSize?.height || 1;
    const contentWidth = single ? pageWidth : pageWidth * 2;
    const byWidth = availableWidth / contentWidth;
    const byHeight = availableHeight / pageHeight;
    const raw = Math.max(0.2, Math.min(byWidth, byHeight) * zoomFactor);
    // Snap to whole CSS pixels so the browser does not rescale the canvas.
    const cssPageWidth = Math.max(1, Math.floor(pageWidth * raw));
    return cssPageWidth / pageWidth;
  }

  async function paintPage(canvas, blank, measured, scale, fallbackSize) {
    if (!canvas || !blank) {
      return;
    }

    const width = measured?.width || fallbackSize?.width || 400;
    const height = measured?.height || fallbackSize?.height || 560;
    const cssWidth = Math.max(1, Math.round(width * scale));
    const cssHeight = Math.max(1, Math.round(height * scale));

    if (!measured?.page) {
      canvas.hidden = true;
      blank.hidden = false;
      if (blank.parentElement) {
        blank.parentElement.style.width = `${cssWidth}px`;
        blank.parentElement.style.height = `${cssHeight}px`;
      }
      return;
    }

    blank.hidden = true;
    canvas.hidden = false;

    // Render at CSS pixel size, then multiply by DPR via transform (PDF.js HiDPI pattern).
    const outputScale = Math.min(2, window.devicePixelRatio || 1);
    const cssScale = cssWidth / width;
    const viewport = measured.page.getViewport({ scale: cssScale });
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    if (canvas.parentElement) {
      canvas.parentElement.style.width = `${cssWidth}px`;
      canvas.parentElement.style.height = `${cssHeight}px`;
    }

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    await measured.page.render({
      canvasContext: context,
      viewport,
      transform
    }).promise;
  }

  async function renderView(index) {
    if (!pdfDoc) {
      return;
    }

    rendering = true;
    syncModeClass();
    const single = isSinglePageMode();
    const pages = pagesForView(index);

    if (rightPageEl) {
      rightPageEl.hidden = single;
    }
    if (leftPageEl) {
      leftPageEl.classList.toggle("is-solo", single);
    }

    const [leftMeasured, rightMeasured] = await Promise.all([
      measurePage(pages.left),
      single ? Promise.resolve(null) : measurePage(pages.right)
    ]);
    const fallback = leftMeasured || rightMeasured;
    const scale = fitScaleForPages(leftMeasured, rightMeasured, single);

    await paintPage(leftCanvas, leftBlank, leftMeasured, scale, fallback);
    if (!single) {
      await paintPage(rightCanvas, rightBlank, rightMeasured, scale, fallback);
    }

    if (spreadEl && zoomFactor <= 1.01) {
      spreadEl.style.maxWidth = "100%";
      spreadEl.style.maxHeight = "100%";
    } else if (spreadEl) {
      spreadEl.style.maxWidth = "none";
      spreadEl.style.maxHeight = "none";
    }

    if (pageLabel) {
      if (single) {
        const page = pages.left ?? 1;
        pageLabel.textContent = `Стр. ${page} / ${pdfDoc.numPages}`;
      } else {
        const leftText = pages.left ?? "—";
        const rightText = pages.right ?? "—";
        pageLabel.textContent = `Разворот ${index + 1} / ${totalViews()} · ${leftText} | ${rightText}`;
      }
    }
    if (prevBtn) {
      prevBtn.disabled = index <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = index >= totalViews() - 1;
    }

    syncZoomUi();
    rendering = false;
    if (pendingIndex !== null) {
      const next = pendingIndex;
      pendingIndex = null;
      queueRender(next);
    }
  }

  function queueRender(index) {
    if (rendering) {
      pendingIndex = index;
      return;
    }
    viewIndex = index;
    void renderView(viewIndex);
  }

  function bumpZoom(delta) {
    const next = Math.min(3, Math.max(1, Math.round((zoomFactor + delta) * 100) / 100));
    if (next === zoomFactor) {
      return;
    }
    zoomFactor = next;
    syncZoomUi();
    queueRender(viewIndex);
  }

  function toggleLoupe() {
    zoomFactor = zoomFactor > 1.01 ? 1 : LOUPE_ZOOM;
    syncZoomUi();
    queueRender(viewIndex);
    if (zoomFactor > 1 && stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    }
  }

  async function ensurePdfLoaded() {
    if (pdfDoc) {
      return pdfDoc;
    }
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = (async () => {
      if (!streamUrl || !viewToken) {
        throw new Error("Missing stream credentials");
      }
      setStatus("Загрузка…");
      const response = await fetch(`${streamUrl}?token=${encodeURIComponent(viewToken)}`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/pdf" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = new Uint8Array(await response.arrayBuffer());
      pdfDoc = await pdfjsLib.getDocument({ data, disableStream: true, disableAutoFetch: true }).promise;
      setStatus("");
      return pdfDoc;
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });

    return loadPromise;
  }

  async function openReader() {
    if (!reader) {
      return;
    }
    zoomFactor = 1;
    wasSinglePage = isSinglePageMode();
    syncModeClass();
    syncZoomUi();
    reader.hidden = false;
    openBtn?.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-article-reader-open");
    try {
      await ensurePdfLoaded();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      queueRender(0);
      stage?.focus({ preventScroll: true });
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить документ. Обновите страницу.");
    }
  }

  function closeReader() {
    if (!reader) {
      return;
    }
    reader.hidden = true;
    zoomFactor = 1;
    syncZoomUi();
    openBtn?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-article-reader-open");
    openBtn?.focus();
  }

  function goPrev() {
    if (viewIndex > 0) {
      queueRender(viewIndex - 1);
    }
  }

  function goNext() {
    if (pdfDoc && viewIndex < totalViews() - 1) {
      queueRender(viewIndex + 1);
    }
  }

  function handleViewportChange() {
    if (!reader || reader.hidden || !pdfDoc) {
      return;
    }

    const single = isSinglePageMode();
    if (single !== wasSinglePage) {
      const page = firstPageOfView(viewIndex, wasSinglePage);
      wasSinglePage = single;
      syncModeClass();
      queueRender(viewIndexForPage(page, single));
      return;
    }

    queueRender(viewIndex);
  }

  openBtn?.addEventListener("click", () => {
    void openReader();
  });
  closeBtn?.addEventListener("click", closeReader);
  prevBtn?.addEventListener("click", goPrev);
  nextBtn?.addEventListener("click", goNext);
  zoomInBtn?.addEventListener("click", () => bumpZoom(0.25));
  zoomOutBtn?.addEventListener("click", () => bumpZoom(-0.25));
  loupeBtn?.addEventListener("click", toggleLoupe);

  window.addEventListener("resize", handleViewportChange);
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", handleViewportChange);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(handleViewportChange);
  }

  void openReader();
}
