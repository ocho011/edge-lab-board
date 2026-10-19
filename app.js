// edge-lab 전략 검증 보드 — data/strategies.json(edge-lab이 자동 생성)을 읽어 그린다.
// 데이터의 문장은 외부 게시물에서 왔으므로 모든 텍스트는 이스케이프하고, 링크는 http(s)만 허용한다.
"use strict";

const ACTION = new Set(["승인 대기", "확인 필요", "확증 대기"]);
const PHASE_ORDER = ["승인 대기", "확인 필요", "확증 대기", "진행 중", "확증됨", "보류", "종결"];
const PHASE_DESC = {
  "승인 대기": "사람이 해석이나 결과를 확인하고 승인할 차례입니다.",
  "확인 필요": "실행 중 문제가 생겨 사람이 원인을 봐야 합니다.",
  "확증 대기": "플러스 결과가 나왔습니다. 아무도 안 본 데이터로 다시 잴 수 있습니다.",
  "진행 중": "해석·구현·백테스트가 자동으로 돌고 있습니다.",
  "확증됨": "다른 시대 데이터에서도 이득이 재현된 전략입니다.",
  "보류": "결론이 나지 않았습니다. 다시 하려면 새 변형이나 새 데이터가 필요합니다.",
  "종결": "손해로 판정됐거나, 규칙을 기계화할 수 없어 끝난 전략입니다.",
};
const PHASE_TONE = { "확증됨": "pos", "보류": "hold", "종결": "neg", "승인 대기": "act", "확인 필요": "act", "확증 대기": "act", "진행 중": "run" };
const RESULT_TONE = { PROCEED_POSITIVE: "pos", HOLD_UNDECIDABLE: "hold", STOP_NEGATIVE: "neg" };
const RESULT_GROUPS = [
  ["pos", "플러스", "거래당 평균 수익의 90% 범위가 0보다 위였던 전략"],
  ["hold", "판정불가", "범위가 0을 걸쳐 이득·손해를 가를 수 없었던 전략"],
  ["neg", "손해 확실", "범위 전체가 0보다 아래였던 전략"],
  ["mute", "기각·부족·무효", "측정하지 못했거나 신호가 부족했던 전략"],
  ["none", "결과 대기", "아직 결과가 나오지 않은 전략"],
];
const PLATFORM = { x: "X", youtube: "YouTube", web: "웹" };

const state = { all: [], tab: "phase", pick: "", q: "", summary: {} };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function safeUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } }
const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Number(v)).toFixed(2);
const pct = (v) => Math.round(v * 100) + "%";
const href = (s) => "#/s/" + encodeURIComponent(s.key);
// 컬러 이모지(🟢 등)는 눈이 피로해 떼고, 옅은 색 점으로 대신한다
const bare = (l) => String(l ?? "").replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");
const dot = (t) => `<i class="tdot ${t}" aria-hidden="true"></i>`;

function tone(s) {
  if (!s.result) return ACTION.has(s.phase) ? "act" : "none";
  return RESULT_TONE[s.result.code] || "mute";
}

// 숫자를 한 문장으로 — "그래서 좋다는 거야?"에 답한다
function plain(s) {
  const r = s.result;
  if (!r) return s.phase === "진행 중" ? "검증이 진행 중입니다. 결과가 나오면 여기에 표시됩니다." : "아직 결과가 없습니다.";
  if (r.mean_r != null) {
    const [lo, hi] = r.ci90;
    if (lo > 0) return `거래당 평균 ${sign(r.mean_r)}R, 범위 전체가 0보다 위 — 과거 데이터에서는 이득이었습니다.`;
    if (hi < 0) return `범위 전체가 0보다 아래 — 과거 데이터에서 손해였습니다.`;
    return `평균은 ${sign(r.mean_r)}R이지만 범위가 0을 걸쳐 — 이득인지 손해인지 가를 수 없습니다.`;
  }
  if (r.code === "REJECT_PAPER") return "규칙이 재량적이라 숫자로 바꿀 수 없어 측정하지 않았습니다.";
  if (r.code === "STOP_SAMPLE") return `신호가 ${r.n ?? 0}건뿐이라(20건 미만) 판정하지 않았습니다.`;
  return r.label;
}

function rangeBar(r) {
  const [lo, hi] = r.ci90, m = r.mean_r;
  const min = Math.min(lo, 0) - 0.25, max = Math.max(hi, 0) + 0.25;
  const x = (v) => ((v - min) / (max - min)) * 100;
  const t = lo > 0 ? "pos" : hi < 0 ? "neg" : "hold";
  const near = (a, b) => Math.abs(x(a) - x(b)) < 12; // 라벨 겹침이면 0 라벨은 생략(0선은 남음)
  return `<div class="range" role="img" aria-label="90% 범위 ${sign(lo)}R ~ ${sign(hi)}R, 평균 ${sign(m)}R">
      <div class="axis"></div><div class="bar ${t}" style="left:${x(lo)}%;width:${x(hi) - x(lo)}%"></div>
      <div class="zero" style="left:${x(0)}%"></div><div class="mean" style="left:${x(m)}%"></div></div>
    <div class="range-cap"><span style="left:${x(lo)}%">${sign(lo)}</span>${near(0, lo) || near(0, hi) ? "" : `<span style="left:${x(0)}%">0</span>`}<span style="left:${x(hi)}%">${sign(hi)}R</span></div>`;
}

function thumb(s) {
  const r = s.result, t = tone(s);
  const head = `<div class="verdict"><span>${dot(t)}${esc(r ? bare(r.label) : "결과 대기")}</span><span class="phase ${PHASE_TONE[s.phase] || ""}">${esc(s.phase)}</span></div>`;
  let big = "";
  if (r && r.mean_r != null) big = `<div class="big"><b>${sign(r.mean_r)}R</b><span>거래당 평균 · ${r.n}건 · 승률 ${pct(r.win_rate)}</span></div>`;
  else big = `<div class="big"><b>${r ? "—" : "…"}</b><span>${r ? "측정값 없음" : "검증 중"}</span></div>`;
  return `<div class="thumb ${t}">${head}${big}<p class="plain">${esc(plain(s))}</p>${r && r.mean_r != null ? rangeBar(r) : ""}</div>`;
}

function card(s) {
  const minis = [];
  if (s.confirm) minis.push(`<span class="mini confirm">확증 · ${esc(bare(s.confirm.label))}</span>`);
  if (s.decision) minis.push(`<span class="mini decision">내 결정 · ${esc(s.decision)}</span>`);
  return `<a class="card box" href="${href(s)}">
    ${thumb(s)}
    <div class="card-body">
      <h4>${esc(s.title)}</h4>
      <p>${esc(s.summary)}</p>
      ${minis.length ? `<div class="card-meta">${minis.join("")}</div>` : ""}
    </div>
    <div class="card-foot"><span class="who">${esc(PLATFORM[s.platform] || s.platform || "출처")} · ${esc(s.author)}</span>
      <span class="tf mono">${esc((s.interval || "—").toUpperCase())}${s.symbols.length ? " · " + s.symbols.length + "종" : ""}</span></div>
  </a>`;
}

/* ---------- list view ---------- */

function groupsFor(items) {
  if (state.tab === "phase") {
    return PHASE_ORDER.map((p) => [p, p, PHASE_DESC[p], items.filter((s) => s.phase === p)]).filter((g) => g[3].length);
  }
  if (state.tab === "result") {
    return RESULT_GROUPS.map(([t, name, desc]) => [t, name, desc, items.filter((s) => tone(s) === t || (t === "none" && tone(s) === "act"))])
      .filter((g) => g[3].length);
  }
  const ivs = [...new Set(items.map((s) => s.interval || "—"))].sort();
  return ivs.map((iv) => [iv, `${iv.toUpperCase()} 봉`, `${iv} 봉 기준으로 신호를 판단하는 전략`, items.filter((s) => (s.interval || "—") === iv)]);
}

function matches(s) {
  if (!state.q) return true;
  const hay = [s.title, s.author, s.summary, s.rule, s.next_step, s.decision, s.phase, ...(s.symbols || [])].join(" ").toLowerCase();
  return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function renderList() {
  const searched = state.all.filter(matches);
  const groups = groupsFor(searched);
  const chips = [["", "전체", searched.length], ...groupsFor(state.all.filter(matches)).map((g) => [g[0], g[1], g[3].length])];
  if (!chips.some((c) => c[0] === state.pick)) state.pick = "";
  $("chips").innerHTML = chips.map(([v, label, n]) =>
    `<button class="chip" data-v="${esc(v)}" aria-pressed="${v === state.pick}">${esc(label)}<span class="n">${n}</span></button>`).join("");
  const shown = state.pick ? groups.filter((g) => g[0] === state.pick) : groups;
  $("groups").innerHTML = shown.map(([, name, desc, list], i) => `<div class="group">
      <div class="group-head"><span class="g-no">${String(i + 1).padStart(2, "0")}</span><h3>${esc(name)}</h3><span class="g-desc">${esc(desc)}</span></div>
      <div class="grid">${list.map(card).join("")}</div></div>`).join("");
  $("empty").hidden = shown.length > 0;
}

function renderTop() {
  const all = state.all, sm = state.summary;
  const pos = all.filter((s) => s.result && s.result.code === "PROCEED_POSITIVE").length;
  const conf = all.filter((s) => s.phase === "확증됨").length;
  const run = all.filter((s) => s.phase === "진행 중").length;
  const tiles = [
    ["", "검증한 전략", all.length, "X·유튜브 등에서 수집"],
    ["", "누적 검증 시도", sm.trials ?? "—", "운을 걸러내려고 모두 셉니다"],
    ["", "플러스 결과", pos, "과거 데이터에서 이득"],
    ["", "확증됨", conf, "다른 시대에서도 재현"],
    ["", "진행 중", run, "자동으로 검증 중"],
  ];
  $("stats").innerHTML = tiles.map(([i, k, v, s]) => `<div class="stat box"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join("");

  const todo = all.filter((s) => ACTION.has(s.phase));
  $("todo").hidden = todo.length === 0;
  $("todo-list").innerHTML = todo.map((s, i) => `<a class="todo-item box" href="${href(s)}">
      <span class="t-no mono">#${String(i + 1).padStart(2, "0")}</span>
      <span><b>${esc(s.title)}</b><span class="t-next">→ ${esc(s.next_step)}</span></span><span class="arrow">›</span></a>`).join("");

  // 주목할 전략: 할 일이 있으면 그것, 없으면 가장 최근에 갱신된 결과
  const pick = todo[0] || [...all].filter((s) => s.result).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))[0];
  const f = $("feature");
  if (pick) {
    f.hidden = false;
    f.className = "feature box";
    f.innerHTML = `${thumb(pick)}<div class="f-top"><div class="f-label"><span class="tag-yellow">${todo[0] ? "지금 할 일" : "최근 결과"}</span>
        <span class="mono" style="font-size:12px;color:var(--muted)">${esc(pick.updated || "")}</span></div>
        <h3>${esc(pick.title)}</h3><p>${esc(pick.summary)}</p></div>
      <a class="f-open" href="${href(pick)}"><span>자세히 보기</span><span>→</span></a>`;
  }
}

/* ---------- detail view ---------- */

function detail(s) {
  const r = s.result, src = safeUrl(s.url);
  const initial = esc((s.author || "?").replace(/^@/, "").slice(0, 1).toUpperCase());
  const tiles = r && r.mean_r != null ? `<div class="tiles">
      <div class="tile"><div class="k">거래당 평균</div><div class="v">${sign(r.mean_r)}R</div></div>
      <div class="tile"><div class="k">거래 수</div><div class="v">${r.n}</div></div>
      <div class="tile"><div class="k">승률</div><div class="v">${pct(r.win_rate)}</div></div>
      <div class="tile"><div class="k">90% 범위</div><div class="v" style="font-size:16px">${sign(r.ci90[0])} ~ ${sign(r.ci90[1])}</div></div></div>` : "";
  const confirm = s.confirm ? `<div class="d-sec"><h3><span class="ico">✓</span>확증 (다른 시대 데이터로 재검증)</h3>
      <div class="rule-box box"><b>${esc(bare(s.confirm.label))}</b>${s.confirm.reason ? `<p class="d-text" style="margin-top:6px">${esc(s.confirm.reason)}</p>` : ""}</div></div>` : "";
  const tl = s.timeline.map((t) => `<li class="${t.confirm ? "c" : ""}"><time>${esc(t.at)}</time>${t.confirm ? "확증 · " : ""}${esc(t.label)}</li>`).join("");
  return `<nav class="crumb"><a href="#/">전략</a> › ${esc(s.phase)} › ${esc(s.author)}</nav>
    <span class="phase ${PHASE_TONE[s.phase] || ""}">${esc(s.phase)}</span>
    <h1 class="d-title">${esc(s.title)}</h1>
    <div class="d-grid">
      <div>
        <div class="d-hero box">${thumb(s)}</div>
        <div class="d-sec"><h3><span class="ico">✎</span>무엇을 하는 전략인가</h3><p class="d-text">${esc(s.summary) || "—"}</p></div>
        <div class="d-sec"><h3><span class="ico">⚙</span>edge-lab이 실제로 검증한 규칙</h3>
          <div class="rule-box box"><div class="rb-head">원문을 숫자 규칙으로 바꾼 것 · 결과를 보기 전에 봉인됨</div>${esc(s.rule) || "아직 해석 전"}</div></div>
        ${confirm}
        <div class="d-sec"><div class="callout box"><div class="c-head">→ 다음 할 일</div><p>${esc(s.next_step)}</p></div></div>
        ${tl ? `<div class="d-sec"><details class="more"><summary>진행 기록 ${s.timeline.length}건 보기</summary><ol class="timeline" style="margin-top:12px">${tl}</ol></details></div>` : ""}
        <a class="back box" href="#/">← 전략 목록으로</a>
      </div>
      <aside class="side">
        <div class="box who-card"><div class="avatar">${initial}</div><div><b>${esc(s.author)}</b><br>
          ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>` : "원문 링크 없음"}</div></div>
        <div class="box"><dl class="kv">
          <dt>상태</dt><dd>${esc(s.stage_label)}</dd>
          <dt>출처</dt><dd>${esc(PLATFORM[s.platform] || s.platform || "—")}</dd>
          <dt>봉</dt><dd>${esc(s.interval || "—")}</dd>
          <dt>등록</dt><dd>${esc(s.registered || "—")}</dd>
          <dt>마지막 갱신</dt><dd>${esc(s.updated || "—")}</dd>
          <dt>내 결정</dt><dd>${esc(s.decision || "—")}</dd></dl>
          ${s.symbols.length ? `<div class="syms">${s.symbols.map((x) => `<span class="sym">${esc(x)}</span>`).join("")}</div>` : ""}</div>
        ${tiles}
      </aside>
    </div>`;
}

/* ---------- routing ---------- */

function route() {
  let h = decodeURIComponent(location.hash.slice(1));
  if (h && !h.startsWith("/") && state.all.some((s) => s.key === h)) h = "/s/" + h; // 예전 링크(#key)
  const m = h.match(/^\/s\/(.+)$/);
  const s = m && state.all.find((x) => x.key === m[1]);
  const about = !s && (h === "how" || h === "guide");
  $("list-view").hidden = !!s || about;
  $("about-view").hidden = !about;
  $("detail-view").hidden = !s;
  if (s) {
    $("detail-view").innerHTML = detail(s);
    document.title = `${s.title} — edge-lab 전략 검증 보드`;
    window.scrollTo(0, 0);
  } else {
    document.title = "edge-lab 전략 검증 보드";
    if (h && h !== "/" && !h.startsWith("/s/")) document.getElementById(h)?.scrollIntoView();
  }
}

async function main() {
  const data = await (await fetch("data/strategies.json?t=" + Date.now())).json();
  state.all = data.strategies;
  state.summary = data.summary || {};
  $("eyebrow").textContent = `전략 ${state.all.length}개 · 누적 검증 시도 ${state.summary.trials ?? "?"}회 · 자동 갱신`;
  $("generated").textContent = "마지막 갱신 " + new Date(data.generated).toLocaleString("ko-KR");
  renderTop();
  renderList();
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.tab = b.dataset.tab; state.pick = "";
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    renderList();
  });
  $("chips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { state.pick = c.dataset.v; renderList(); } });
  $("q").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderList(); });
  window.addEventListener("hashchange", route);
  route();
}

main().catch((e) => { $("eyebrow").textContent = "데이터를 불러오지 못했습니다"; console.error(e); });
