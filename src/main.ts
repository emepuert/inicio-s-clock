import "./style.css";

interface ClockModel {
  mode: "running" | "paused";
  /** Instantané virtuel (ms depuis epoch) figé au dernier ancrage + dérivé si running */
  virtualAnchorMs: number;
  perfAnchor: number;
  /** Multiplicateur : 1 = temps réel, 0.5 = deux fois plus lent */
  multiplier: number;
}

let wakeLock: WakeLockSentinel | null = null;

const model: ClockModel = {
  mode: "running",
  virtualAnchorMs: Date.now(),
  perfAnchor: performance.now(),
  multiplier: 1,
};

let rafId = 0;


/** Vitesse en % du temps réel (100 % = réel), sans décimale */
function formatSpeedPercent(m: number): string {
  const p = Math.round(m * 100);
  return `${p}\u202f%`;
}

function getDisplayedMs(): number {
  if (model.mode === "paused") return model.virtualAnchorMs;
  return (
    model.virtualAnchorMs +
    model.multiplier * (performance.now() - model.perfAnchor)
  );
}

function reanchorFromRunning(): void {
  model.virtualAnchorMs = getDisplayedMs();
  model.perfAnchor = performance.now();
}

function setMultiplier(next: number): void {
  const clamped = Math.min(1, Math.max(0.01, next));
  if (model.mode === "running") reanchorFromRunning();
  model.multiplier = clamped;
}

function pause(): void {
  if (model.mode !== "running") return;
  reanchorFromRunning();
  model.mode = "paused";
}

function resume(): void {
  if (model.mode !== "paused") return;
  model.perfAnchor = performance.now();
  model.mode = "running";
}

function syncRealTime(): void {
  model.virtualAnchorMs = Date.now();
  model.perfAnchor = performance.now();
  model.mode = "running";
}

function sliderToMultiplier(sliderVal: number): number {
  const v = sliderVal / 100;
  return 0.01 + (1 - v) * 0.99;
}

function multiplierToSlider(m: number): number {
  return Math.round(((1 - (m - 0.01) / 0.99) * 100 + Number.EPSILON) * 100) / 100;
}

/** Indice 0–100 (pas entiers), une ligne = un pas */
const SPEED_INDEX_MAX = 100;
const SPEED_TICK_PX = 12;

function buildSpeedTrackMarkup(): string {
  let html = "";
  for (let i = 0; i <= SPEED_INDEX_MAX; i++) {
    const major = i % 10 === 0;
    const mid = !major && i % 5 === 0;
    const cls = major
      ? "speed-tick speed-tick--major"
      : mid
        ? "speed-tick speed-tick--mid"
        : "speed-tick";
    html += `<div class="${cls}" data-idx="${i}" style="height:${SPEED_TICK_PX}px"><span class="speed-tick__line"></span></div>`;
  }
  return html;
}

function scrollTopToIndex(scrollTop: number): number {
  const idx = Math.round(scrollTop / SPEED_TICK_PX);
  return Math.min(SPEED_INDEX_MAX, Math.max(0, idx));
}

function indexToScrollTop(idx: number): number {
  return Math.min(SPEED_INDEX_MAX, Math.max(0, idx)) * SPEED_TICK_PX;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function formatTime(ms: number): { main: string; sub: string } {
  const d = new Date(ms);
  const sub = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hh = d.getHours();
  const mm = d.getMinutes();
  const ss = d.getSeconds();
  const milli = pad3(d.getMilliseconds());

  return {
    main: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${milli}`,
    sub,
  };
}

function renderClock(clockEl: HTMLElement, subEl: HTMLElement): void {
  const { main, sub } = formatTime(getDisplayedMs());
  clockEl.textContent = main;
  subEl.textContent = sub;
}

function tick(
  clockEl: HTMLElement,
  subEl: HTMLElement,
  pauseBtn: HTMLButtonElement,
  resumeBtn: HTMLButtonElement
): void {
  renderClock(clockEl, subEl);
  const running = model.mode === "running";
  pauseBtn.disabled = !running;
  resumeBtn.disabled = running;
  rafId = requestAnimationFrame(() =>
    tick(clockEl, subEl, pauseBtn, resumeBtn)
  );
}

async function requestWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator) || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    /* refus ou indisponible */
  }
}

function releaseWakeLock(): void {
  void wakeLock?.release();
  wakeLock = null;
}

function buildUI(root: HTMLElement): void {
  root.innerHTML = `
    <main class="clock-zone">
      <div class="clock clock--lg" id="clock" aria-live="polite"></div>
      <p class="clock--sub" id="clock-sub"></p>
    </main>
    <section class="controls" aria-label="Contrôles">
      <div id="controls-panel" class="controls-panel">
      <div class="rate-row">
        <div
          class="speed-scroller"
          id="speed-scroller"
          role="slider"
          aria-label="Vitesse du temps affiché"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-orientation="vertical"
          tabindex="0"
        >
          <div class="speed-scroller__viewport" id="speed-viewport">
            <div class="speed-scroller__track" id="speed-track"></div>
          </div>
          <div class="speed-scroller__fade speed-scroller__fade--top" aria-hidden="true"></div>
          <div class="speed-scroller__fade speed-scroller__fade--bottom" aria-hidden="true"></div>
          <div class="speed-scroller__value" aria-live="polite">
            <span id="rate-label" class="speed-scroller__value-text"></span>
          </div>
        </div>
      </div>
      <div class="actions actions--triple">
        <button type="button" class="primary" id="btn-pause">Pause</button>
        <button type="button" id="btn-resume" disabled>Reprendre</button>
        <button type="button" id="btn-sync">Heure réelle</button>
      </div>
      <div class="secondary-actions">
        <button type="button" id="btn-wake">Garder l’écran actif</button>
        <button type="button" class="ghost" id="btn-fs" aria-pressed="false">
          Plein écran
        </button>
      </div>
      </div>
    </section>
    <button
      type="button"
      class="controls-toggle"
      id="btn-controls-toggle"
      aria-expanded="true"
      aria-controls="controls-panel"
      title="Masquer les réglages"
    >
      <span class="sr-only">Afficher ou masquer les réglages</span>
      <span class="controls-toggle__glyph" aria-hidden="true">···</span>
    </button>
  `;

  const clockEl = root.querySelector<HTMLElement>("#clock")!;
  const subEl = root.querySelector<HTMLElement>("#clock-sub")!;
  const speedViewport = root.querySelector<HTMLElement>("#speed-viewport")!;
  const speedTrack = root.querySelector<HTMLElement>("#speed-track")!;
  const speedScroller = root.querySelector<HTMLElement>("#speed-scroller")!;
  const rateLabel = root.querySelector<HTMLElement>("#rate-label")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("#btn-pause")!;
  const resumeBtn = root.querySelector<HTMLButtonElement>("#btn-resume")!;
  const syncBtn = root.querySelector<HTMLButtonElement>("#btn-sync")!;
  const wakeBtn = root.querySelector<HTMLButtonElement>("#btn-wake")!;
  const fsBtn = root.querySelector<HTMLButtonElement>("#btn-fs")!;

  speedTrack.innerHTML = buildSpeedTrackMarkup();
  rateLabel.textContent = formatSpeedPercent(model.multiplier);

  let speedScrollRaf = 0;
  let speedScrollProgrammatic = false;
  let lastSpeedIdx = -1;

  function applyMultiplierFromIndex(idx: number): void {
    const clamped = Math.min(SPEED_INDEX_MAX, Math.max(0, Math.round(idx)));
    if (clamped === lastSpeedIdx) return;
    lastSpeedIdx = clamped;
    const m = sliderToMultiplier(clamped);
    setMultiplier(m);
    rateLabel.textContent = formatSpeedPercent(model.multiplier);
    speedScroller.setAttribute("aria-valuenow", String(clamped));
    speedScroller.setAttribute(
      "aria-valuetext",
      `${Math.round(model.multiplier * 100)} pour cent de la vitesse réelle, ${clamped <= 33 ? "plutôt rapide" : clamped <= 66 ? "ralenti" : "très lent"}`
    );
  }

  function syncScrollToMultiplier(m: number): void {
    const idx = Math.round(multiplierToSlider(m));
    lastSpeedIdx = -1;
    speedScrollProgrammatic = true;
    speedViewport.scrollTop = indexToScrollTop(idx);
    requestAnimationFrame(() => {
      speedScrollProgrammatic = false;
      applyMultiplierFromIndex(idx);
    });
  }

  function onSpeedScroll(): void {
    if (speedScrollProgrammatic) return;
    cancelAnimationFrame(speedScrollRaf);
    speedScrollRaf = requestAnimationFrame(() => {
      const idx = scrollTopToIndex(speedViewport.scrollTop);
      applyMultiplierFromIndex(idx);
    });
  }

  speedViewport.addEventListener("scroll", onSpeedScroll, { passive: true });
  speedViewport.addEventListener(
    "scrollend",
    () => {
      if (speedScrollProgrammatic) return;
      const idx = scrollTopToIndex(speedViewport.scrollTop);
      const snapped = indexToScrollTop(idx);
      if (Math.abs(speedViewport.scrollTop - snapped) > 0.5) {
        speedScrollProgrammatic = true;
        speedViewport.scrollTop = snapped;
        requestAnimationFrame(() => {
          speedScrollProgrammatic = false;
        });
      }
      applyMultiplierFromIndex(idx);
    },
    { passive: true }
  );

  speedScroller.addEventListener("keydown", (e) => {
    const idx = scrollTopToIndex(speedViewport.scrollTop);
    let next = idx;
    if (e.key === "ArrowUp" || e.key === "PageUp") next = Math.max(0, idx - 1);
    else if (e.key === "ArrowDown" || e.key === "PageDown")
      next = Math.min(SPEED_INDEX_MAX, idx + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SPEED_INDEX_MAX;
    else return;
    e.preventDefault();
    speedScrollProgrammatic = true;
    speedViewport.scrollTop = indexToScrollTop(next);
    requestAnimationFrame(() => {
      speedScrollProgrammatic = false;
      applyMultiplierFromIndex(next);
    });
  });

  {
    const ix = Math.round(multiplierToSlider(model.multiplier));
    lastSpeedIdx = -1;
    speedScrollProgrammatic = true;
    speedViewport.scrollTop = indexToScrollTop(ix);
    requestAnimationFrame(() => {
      speedScrollProgrammatic = false;
      applyMultiplierFromIndex(ix);
    });
  }

  pauseBtn.addEventListener("click", () => pause());
  resumeBtn.addEventListener("click", () => resume());
  syncBtn.addEventListener("click", () => {
    syncRealTime();
    syncScrollToMultiplier(model.multiplier);
  });

  wakeBtn.addEventListener("click", () => {
    void requestWakeLock();
  });

  function syncFullscreenButton(): void {
    const on = document.fullscreenElement !== null;
    fsBtn.textContent = on ? "Quitter le plein écran" : "Plein écran";
    fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  fsBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* refus ou indisponible */
    }
  });
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  syncFullscreenButton();

  const controlsPanel = root.querySelector<HTMLElement>("#controls-panel")!;
  const controlsToggle = root.querySelector<HTMLButtonElement>("#btn-controls-toggle")!;
  function setControlsPanelVisible(visible: boolean): void {
    controlsPanel.classList.toggle("controls-panel--hidden", !visible);
    controlsPanel.setAttribute("aria-hidden", visible ? "false" : "true");
    controlsToggle.setAttribute("aria-expanded", visible ? "true" : "false");
    controlsToggle.title = visible ? "Masquer les réglages" : "Afficher les réglages";
  }
  controlsToggle.addEventListener("click", () => {
    const hidden = controlsPanel.classList.contains("controls-panel--hidden");
    setControlsPanelVisible(hidden);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && model.mode === "running") {
      reanchorFromRunning();
    }
    if (document.visibilityState === "hidden") releaseWakeLock();
  });

  cancelAnimationFrame(rafId);
  tick(clockEl, subEl, pauseBtn, resumeBtn);
}

{
  const el = document.querySelector("#app");
  if (!(el instanceof HTMLElement)) throw new Error("#app manquant");
  buildUI(el);
}
