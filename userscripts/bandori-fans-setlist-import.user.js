// ==UserScript==
// @name         bandori.live → bandori.fans 歌单导入
// @namespace    https://bandori.live
// @version      0.1.8
// @description  在 bandori.fans 补充曲目页，按活动名称从 bandori.live 拉取歌单并自动填入（不自动提交）
// @author       bandori.live
// @match        https://bandori.fans/*/contribute/setlist*
// @grant        GM_xmlhttpRequest
// @connect      bandori.live
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /** 改成你的 bandori.live 部署地址 */
  const API_BASE = "https://bandori.live";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getEventTitleFromPage() {
    const fromContext = document.querySelector(
      '[data-testid="setlist-context"] .bf-correction-context-value',
    );
    if (fromContext?.textContent?.trim()) {
      return fromContext.textContent.trim();
    }

    const form = document.querySelector("main form");
    if (!form) return null;

    for (const el of form.querySelectorAll("div")) {
      const kids = [...el.children];
      if (kids.length >= 2 && kids[0].textContent?.trim() === "演出") {
        return kids[1].textContent?.trim() ?? null;
      }
    }

    return null;
  }

  function parseOccurrenceFromSelect(select) {
    if (!select || !(select instanceof HTMLSelectElement)) {
      return { eventDate: null, occurrenceLabel: null, occurrenceId: null };
    }

    const selectedOption = select.options[select.selectedIndex];
    const optionText = selectedOption?.textContent?.trim() || null;
    const optionValue = select.value?.trim() || null;
    const occurrenceId =
      optionValue && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(optionValue)
        ? optionValue
        : null;
    const occurrenceLabel = optionText || (occurrenceId ? null : optionValue);
    const eventDate =
      occurrenceLabel?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ??
      (optionValue && /^\d{4}-\d{2}-\d{2}/.test(optionValue)
        ? optionValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
        : null) ??
      null;

    return { eventDate, occurrenceLabel, occurrenceId };
  }

  function getSelectedOccurrence() {
    return parseOccurrenceFromSelect(
      document.querySelector("#bf-setlist-perf, main form select"),
    );
  }

  function buildPromptKey(title, { eventDate, occurrenceLabel, occurrenceId }) {
    const slot = eventDate ?? occurrenceId ?? (occurrenceLabel ? occurrenceLabel.slice(0, 80) : "");
    return `${location.pathname}?${title}${slot ? `#${slot}` : ""}`;
  }

  function isOccurrenceSelect(element) {
    if (!(element instanceof HTMLSelectElement)) return false;
    if (element.id === "bf-setlist-perf") return true;
    return element.labels?.[0]?.textContent?.trim() === "场次";
  }

  function setNativeInputValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }),
    );
  }

  async function waitFor(testFn, { timeoutMs = 3000, intervalMs = 80 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = testFn();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  /** bandori.fans 曲名搜索对引号敏感；键入时去掉标点再搜更稳。 */
  function normalizePickerText(value) {
    return value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildPickerQueries(title) {
    const normalized = normalizePickerText(title);
    if (!normalized) return [title];

    const queries = [normalized];
    const firstWord = normalized.split(" ")[0];
    if (firstWord && firstWord !== normalized) queries.push(firstWord);
    return queries;
  }

  function pickSongOption(targetTitle, options) {
    const normalizedTarget = normalizePickerText(targetTitle);
    const texts = options.map((el) => el.textContent?.trim() ?? "");

    const exact = texts.findIndex((text) => normalizePickerText(text) === normalizedTarget);
    if (exact >= 0) return options[exact];

    const primary = texts.findIndex((text) => {
      const lower = text.toLowerCase();
      const normalized = normalizePickerText(text);
      return (
        (normalized.startsWith(normalizedTarget) || normalizedTarget.startsWith(normalized)) &&
        !lower.includes("instrumental") &&
        !lower.includes("english ver")
      );
    });
    if (primary >= 0) return options[primary];

    const startsWith = texts.findIndex((text) => {
      const normalized = normalizePickerText(text);
      return normalized.startsWith(normalizedTarget) || normalizedTarget.startsWith(normalized);
    });
    if (startsWith >= 0) return options[startsWith];

    return options[0] ?? null;
  }

  async function selectPicker(testId, rawQuery, { pickOption, normalizeQuery = false } = {}) {
    const input = document.querySelector(`input[data-testid="${testId}"]`);
    if (!input) {
      throw new Error(`找不到输入框 ${testId}`);
    }

    const queries = normalizeQuery ? buildPickerQueries(rawQuery) : [rawQuery];
    let lastQuery = queries[0];

    for (const query of queries) {
      lastQuery = query;
      input.focus();
      setNativeInputValue(input, "");
      await sleep(50);
      setNativeInputValue(input, query);

      const options = await waitFor(() => {
        const list = [...document.querySelectorAll('[role="option"]')].filter(
          (el) => !el.textContent?.includes("提议新歌曲"),
        );
        return list.length > 0 ? list : null;
      }, { timeoutMs: 2000 });

      if (!options?.length) continue;

      const option = pickOption ? pickOption(rawQuery, options) : options[0];
      if (!option) continue;

      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await sleep(180);

      return option.textContent?.trim() ?? rawQuery;
    }

    throw new Error(`「${rawQuery}」无匹配选项（已尝试：${queries.join(" / ")}）`);
  }

  async function ensureRowCount(count) {
    while (document.querySelectorAll(".bf-setlist-row").length < count) {
      const addBtn = [...document.querySelectorAll("button")].find((btn) =>
        btn.textContent?.includes("添加曲目"),
      );
      if (!addBtn) throw new Error("找不到「+ 添加曲目」按钮");
      addBtn.click();
      await sleep(200);
    }
  }

  async function clearExistingSetlist() {
    const deleteButtons = () =>
      [...document.querySelectorAll("button")].filter((btn) =>
        /^删除第 \d+ 首$/.test(btn.getAttribute("aria-label") ?? ""),
      );

    while (deleteButtons().length > 1) {
      deleteButtons().at(-1)?.click();
      await sleep(120);
    }

    const songInput = document.querySelector('input[data-testid="setlist-song-picker-0"]');
    const bandInput = document.querySelector('input[data-testid="setlist-band-picker-0"]');
    if (songInput) setNativeInputValue(songInput, "");
    if (bandInput) setNativeInputValue(bandInput, "");
    await sleep(100);
  }

  async function fillSetlist(entries) {
    await clearExistingSetlist();
    await ensureRowCount(entries.length);

    const failures = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      try {
        await selectPicker(`setlist-song-picker-${index}`, entry.songTitle, {
          normalizeQuery: true,
          pickOption: (_query, options) => pickSongOption(entry.songTitle, options),
        });

        if (entry.bandName) {
          const bandQuery = entry.bandName.length > 8 ? entry.bandName.slice(0, 8) : entry.bandName;
          await selectPicker(`setlist-band-picker-${index}`, bandQuery, {
            pickOption: (_query, options) =>
              options.find((opt) => opt.textContent?.includes(entry.bandName)) ?? options[0],
          });
        }
      } catch (error) {
        failures.push({
          position: entry.position,
          songTitle: entry.songTitle,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(120);
    }

    const terms = [...document.querySelectorAll('main form input[type="checkbox"]')].find((cb) =>
      cb.closest("label")?.textContent?.includes("使用条款"),
    );
    if (terms && !terms.checked) {
      terms.click();
    }

    return failures;
  }

  function removeOverlay() {
    document.getElementById("bdl-setlist-import-overlay")?.remove();
  }

  function showOverlay({ title, occurrenceDate, match, onConfirm, onDismiss }) {
    removeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "bdl-setlist-import-overlay";
    overlay.innerHTML = `
      <style>
        #bdl-setlist-import-overlay {
          position: fixed; inset: 0; z-index: 2147483646;
          background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center;
          font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
          pointer-events: none;
        }
        #bdl-setlist-import-card {
          width: min(420px, calc(100vw - 32px)); background: #fff; color: #111;
          border-radius: 12px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.25);
          pointer-events: auto;
        }
        #bdl-setlist-import-card h2 { margin: 0 0 8px; font-size: 18px; }
        #bdl-setlist-import-card p { margin: 0 0 12px; color: #444; }
        #bdl-setlist-import-card .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
        #bdl-setlist-import-card .actions { display: flex; gap: 8px; justify-content: flex-end; }
        #bdl-setlist-import-card button {
          border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit;
        }
        #bdl-setlist-import-card .cancel { background: #eee; color: #222; }
        #bdl-setlist-import-card .confirm { background: #ff3377; color: #fff; }
        #bdl-setlist-import-card .confirm:disabled { opacity: .6; cursor: wait; }
        #bdl-setlist-import-card .status { margin-top: 12px; font-size: 12px; color: #333; min-height: 1.2em; }
      </style>
      <div id="bdl-setlist-import-card" role="dialog" aria-modal="true">
        <h2>导入歌单？</h2>
        <p>从 bandori.live 导入以下活动的曲目（不会自动提交，请自行核对后提交）：</p>
        <div class="meta"><strong>${escapeHtml(title)}</strong>${occurrenceDate || match.eventDate ? `<br>${escapeHtml(occurrenceDate || match.eventDate)}` : ""}<br>${match.entries.length} 首 · ${escapeHtml(match.setlistStatus)}</div>
        <div class="actions">
          <button type="button" class="cancel">取消</button>
          <button type="button" class="confirm">导入</button>
        </div>
        <div class="status" id="bdl-setlist-import-status"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const statusEl = overlay.querySelector("#bdl-setlist-import-status");
    const confirmBtn = overlay.querySelector(".confirm");
    const cancelBtn = overlay.querySelector(".cancel");
    let importDone = false;

    const dismiss = () => {
      removeOverlay();
      onDismiss?.();
    };

    cancelBtn.addEventListener("click", dismiss);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) dismiss();
    });

    confirmBtn.addEventListener("click", async () => {
      if (importDone) {
        dismiss();
        return;
      }

      confirmBtn.disabled = true;
      statusEl.textContent = "正在填入…";
      try {
        const failures = await onConfirm();
        if (failures.length === 0) {
          importDone = true;
          statusEl.textContent = `已填入 ${match.entries.length} 首，已勾选使用条款。请核对后手动提交。`;
          confirmBtn.textContent = "完成";
          confirmBtn.disabled = false;
        } else {
          statusEl.textContent = `部分失败（${failures.length} 首）：${failures
            .slice(0, 3)
            .map((f) => f.songTitle)
            .join("、")}${failures.length > 3 ? "…" : ""}`;
          confirmBtn.disabled = false;
        }
      } catch (error) {
        statusEl.textContent = error instanceof Error ? error.message : String(error);
        confirmBtn.disabled = false;
      }
    });
  }

  function showMessage(text, onDismiss) {
    removeOverlay();
    const overlay = document.createElement("div");
    overlay.id = "bdl-setlist-import-overlay";
    overlay.innerHTML = `
      <style>
        #bdl-setlist-import-overlay {
          position: fixed; inset: 0; z-index: 2147483646;
          background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center;
          font: 14px/1.5 system-ui, sans-serif;
        }
        #bdl-setlist-import-card {
          width: min(420px, calc(100vw - 32px)); background: #fff; color: #111;
          border-radius: 12px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.25);
        }
      </style>
      <div id="bdl-setlist-import-card"><p style="margin:0 0 12px">${escapeHtml(text)}</p>
      <button type="button" style="border:0;border-radius:8px;padding:8px 14px;background:#eee;cursor:pointer">关闭</button></div>`;
    document.body.appendChild(overlay);
    const close = () => {
      removeOverlay();
      onDismiss?.();
    };
    overlay.querySelector("button")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function fetchSetlistMatch(title, eventDate) {
    const url = new URL("/api/setlist-export", API_BASE);
    url.searchParams.set("title", title);
    if (eventDate) url.searchParams.set("eventDate", eventDate);

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url.toString(),
        onload(response) {
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error("API 返回不是合法 JSON"));
            return;
          }

          if (response.status >= 400) {
            reject(new Error(body.error ?? `API 请求失败 (${response.status})`));
            return;
          }

          resolve(body);
        },
        onerror() {
          reject(
            new Error(
              "网络请求失败。请确认 bandori.live 可访问，且 Tampermonkey 已授予脚本访问 bandori.live 的权限。",
            ),
          );
        },
      });
    });
  }

  const handledPromptKeys = new Set();
  let mainGeneration = 0;

  function markHandled(promptKey) {
    handledPromptKeys.add(promptKey);
  }

  function unmarkHandled(promptKey) {
    handledPromptKeys.delete(promptKey);
  }

  function onOccurrenceChanged(select) {
    removeOverlay();
    mainGeneration += 1;

    const title = getEventTitleFromPage();
    if (!title) return;

    const occurrence = parseOccurrenceFromSelect(select);
    const promptKey = buildPromptKey(title, occurrence);
    unmarkHandled(promptKey);
    void main({ skipOverlayGuard: true, occurrence, generation: mainGeneration });
  }

  async function main({ skipOverlayGuard = false, occurrence = null, generation = null } = {}) {
    if (!location.pathname.includes("/contribute/setlist")) return;
    if (!skipOverlayGuard && document.getElementById("bdl-setlist-import-overlay")) return;

    const runId = generation ?? ++mainGeneration;

    const title = await waitFor(() => getEventTitleFromPage(), { timeoutMs: 8000 });
    if (!title || runId !== mainGeneration) {
      if (!title) console.warn("[bandori.live import] 未能读取页面上的活动名称");
      return;
    }

    const resolvedOccurrence = occurrence ?? getSelectedOccurrence();
    const { eventDate, occurrenceLabel } = resolvedOccurrence;
    const promptKey = buildPromptKey(title, resolvedOccurrence);
    if (handledPromptKeys.has(promptKey)) return;

    let payload;
    try {
      payload = await fetchSetlistMatch(title, eventDate);
    } catch (error) {
      if (runId !== mainGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[bandori.live import]", message);
      markHandled(promptKey);
      showMessage(`无法连接 bandori.live：${message}`, () => markHandled(promptKey));
      return;
    }

    if (runId !== mainGeneration) return;

    if (!payload.match?.entries?.length) {
      const dateHint = eventDate ? `（${eventDate}）` : "";
      console.info("[bandori.live import] 未在 bandori.live 找到匹配歌单:", title, eventDate);
      markHandled(promptKey);
      showMessage(
        `bandori.live 中暂无「${title}」${dateHint}的歌单数据，请先在 bandori.live 管理后台录入。`,
        () => markHandled(promptKey),
      );
      return;
    }

    if (eventDate && payload.match.eventDate !== eventDate) {
      console.warn(
        "[bandori.live import] API 返回日期与场次不符:",
        { requested: eventDate, returned: payload.match.eventDate },
      );
      markHandled(promptKey);
      showMessage(
        `bandori.live 返回了 ${payload.match.eventDate} 的歌单，但当前场次是 ${eventDate}。请确认 bandori.live 已部署最新 API，或先在后台录入该日期的歌单。`,
        () => markHandled(promptKey),
      );
      return;
    }

    const displayTitle = occurrenceLabel
      ? `${title} — ${occurrenceLabel.split("·")[0]?.trim() ?? eventDate}`
      : title;

    showOverlay({
      title: displayTitle,
      occurrenceDate: eventDate,
      match: payload.match,
      onConfirm: () => fillSetlist(payload.match.entries),
      onDismiss: () => markHandled(promptKey),
    });
  }

  function watchOccurrenceSelect() {
    if (document.documentElement.dataset.bdlOccurrenceWatch === "1") return;
    document.documentElement.dataset.bdlOccurrenceWatch = "1";

    document.addEventListener(
      "change",
      (event) => {
        if (!location.pathname.includes("/contribute/setlist")) return;
        if (!isOccurrenceSelect(event.target)) return;
        onOccurrenceChanged(event.target);
      },
      true,
    );
  }

  function boot() {
    watchOccurrenceSelect();
    void main();
    window.addEventListener("popstate", () => void main());
  }

  boot();

  // ponytail: self-check — keep in sync with normalizePickerText
  console.assert(
    normalizePickerText("EXPOSE ‘Burn out!!!’") === "expose burn out" &&
      normalizePickerText("Takin' my Heart") === "takin my heart" &&
      normalizePickerText("R·I·O·T") === "r i o t" &&
      "2026-03-21 · 神戸".match(/^(\d{4}-\d{2}-\d{2})/)?.[1] === "2026-03-21" &&
      parseOccurrenceFromSelect({
        options: [{ textContent: "2026-06-20 · SGC HALL ARIAKE · DAY2" }],
        selectedIndex: 0,
        value: "5ee0c8ff-cd49-5adc-a77f-0f071b35fc86",
      }).eventDate === "2026-06-20",
    "[bandori.live import] self-check failed",
  );
})();
