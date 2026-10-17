// edge-lab 전략 보드 — data/strategies.json(edge-lab이 자동 생성)을 읽어 그린다.
// 데이터의 문장은 외부 게시물에서 왔으므로 모든 텍스트는 이스케이프하고, 링크는 http(s)만 허용한다.
"use strict";

const PHASES = ["전체", "지금 할 일", "진행 중", "승인 대기", "확증 대기", "확증됨", "보류", "종결", "확인 필요"];
const ACTION = new Set(["승인 대기", "확인 필요", "확증 대기"]);
const PHASE_CLASS = { "확증됨": "pos", "종결": "neg", "보류": "hold", "승인 대기": "act", "확인 필요": "act", "확증 대기": "act" };
const PLATFORM = { x: "X", youtube: "YouTube", web: "웹" };

const state = { all: [], phase: "전체", tf: "", q: "" };
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch { return ""; }
}
const sign = (v) => (v > 0 ? "+" : "") + Number(v).toFixed(2);
const pct = (v) => Math.round(v * 100) + "%";

function card(s) {
  const tags = [];
  if (s.interval) tags.push(`<span class="tag">${esc(s.interval)}${s.symbols.length ? " · " + s.symbols.length + "종" : ""}</span>`);
  if (s.result) tags.push(`<span class="tag">${esc(s.result.label)}${s.result.mean_r != null ? " " + sign(s.result.mean_r) + "R" : ""}</span>`);
  if (s.confirm) tags.push(`<span class="tag">확증 ${esc(s.confirm.label)}</span>`);
  if (s.decision) tags.push(`<span class="tag decision">내 결정: ${esc(s.decision)}</span>`);
  return `<button class="card" data-key="${esc(s.key)}">
    <div class="meta"><span>${esc(PLATFORM[s.platform] || s.platform || "출처")} · ${esc(s.author)}</span>
      <span class="phase ${PHASE_CLASS[s.phase] || ""}">${esc(s.phase)}</span></div>
    <h3>${esc(s.title)}</h3>
    <p>${esc(s.summary)}</p>
    <div class="tags">${tags.join("")}</div>
    <div class="next">→ ${esc(s.next_step)}</div>
  </button>`;
}

function rangeBar(r) {
  const [lo, hi] = r.ci90; const m = r.mean_r;
  const min = Math.min(lo, 0, m) - 0.2, max = Math.max(hi, 0, m) + 0.2;
  const x = (v) => ((v - min) / (max - min)) * 100;
  const color = lo > 0 ? "var(--pos)" : hi < 0 ? "var(--neg)" : "var(--hold)";
  return `<div class="range" role="img" aria-label="거래당 평균 ${sign(m)}R, 90% 범위 ${sign(lo)}~${sign(hi)}R">
      <div class="axis"></div><div class="zero" style="left:${x(0)}%"></div>
      <div class="bar" style="left:${x(lo)}%;width:${x(hi) - x(lo)}%;background:${color};opacity:.35"></div>
      <div class="dot" style="left:${x(m)}%;background:${color}"></div></div>
    <div class="range-cap">
      <span style="left:${x(lo)}%">${sign(lo)}R</span><span class="z" style="left:${x(0)}%">0</span><span style="left:${x(hi)}%">${sign(hi)}R</span>
    </div>`;
}

function detail(s) {
  const src = safeUrl(s.url);
  let res = "<dd>아직 없음</dd>";
  if (s.result) {
    res = `<dd><b>${esc(s.result.label)}</b>`;
    if (s.result.mean_r != null) {
      res += `<div class="stats">
        <div class="stat"><b>${sign(s.result.mean_r)}R</b><span>거래당 평균</span></div>
        <div class="stat"><b>${s.result.n}</b><span>거래 수</span></div>
        <div class="stat"><b>${pct(s.result.win_rate)}</b><span>승률</span></div></div>
        ${rangeBar(s.result)}`;
    }
    res += "</dd>";
  }
  const conf = s.confirm ? `<dd><b>${esc(s.confirm.label)}</b>${s.confirm.reason ? " — " + esc(s.confirm.reason) : ""}</dd>` : "<dd>해당 없음</dd>";
  const tl = s.timeline.map((t) => `<li class="${t.confirm ? "c" : ""}"><time>${esc(t.at)}</time>${t.confirm ? "확증 · " : ""}${esc(t.label)}</li>`).join("");
  return `<h2 id="d-title">${esc(s.title)}</h2>
    <div class="src">${esc(s.author)} · ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>` : "원문 링크 없음"}</div>
    <dl class="kv">
      <dt>무엇을 하나</dt><dd>${esc(s.summary) || "—"}</dd>
      <dt>검증한 규칙</dt><dd>${esc(s.rule) || "—"}</dd>
      <dt>시간·시장</dt><dd>${esc(s.interval) || "—"}${s.symbols.length ? " · " + esc(s.symbols.join(", ")) : ""}</dd>
      <dt>결과</dt>${res}
      <dt>확증</dt>${conf}
      <dt>다음 할 일</dt><dd>${esc(s.next_step)}</dd>
      <dt>내 결정</dt><dd>${esc(s.decision) || "—"}</dd>
      <dt>상태</dt><dd><span class="phase ${PHASE_CLASS[s.phase] || ""}">${esc(s.phase)}</span> · ${esc(s.stage_label)}${s.updated ? " · " + esc(s.updated) : ""}</dd>
    </dl>
    ${tl ? `<details><summary>진행 기록 (${s.timeline.length})</summary><ol class="timeline">${tl}</ol></details>` : ""}`;
}

function matches(s) {
  if (state.phase === "지금 할 일" && !ACTION.has(s.phase)) return false;
  if (state.phase !== "전체" && state.phase !== "지금 할 일" && s.phase !== state.phase) return false;
  if (state.tf && s.interval !== state.tf) return false;
  if (!state.q) return true;
  const hay = [s.title, s.author, s.summary, s.rule, s.next_step, s.decision, ...(s.symbols || [])].join(" ").toLowerCase();
  return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function chips(el, values, current, counts, onPick) {
  el.innerHTML = values.map((v) => {
    const n = counts ? counts[v] : null;
    return `<button class="chip" aria-pressed="${v === current}" data-v="${esc(v)}">${esc(v || "전체 봉")}${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
  }).join("");
  el.onclick = (e) => { const b = e.target.closest(".chip"); if (b) onPick(b.dataset.v); };
}

function render() {
  const counts = { "전체": state.all.length, "지금 할 일": state.all.filter((s) => ACTION.has(s.phase)).length };
  for (const s of state.all) counts[s.phase] = (counts[s.phase] || 0) + 1;
  const phases = PHASES.filter((p) => p === "전체" || counts[p]);
  chips($("phase-chips"), phases, state.phase, counts, (v) => { state.phase = v; render(); });
  const tfs = ["", ...new Set(state.all.map((s) => s.interval).filter(Boolean))];
  chips($("tf-chips"), tfs, state.tf, null, (v) => { state.tf = v; render(); });
  const shown = state.all.filter(matches);
  $("cards").innerHTML = shown.map(card).join("");
  $("empty").hidden = shown.length > 0;
}

function open(key) {
  const s = state.all.find((x) => x.key === key);
  if (!s) return;
  $("d-body").innerHTML = detail(s);
  $("detail").showModal();
  history.replaceState(null, "", "#" + encodeURIComponent(key));
}

async function main() {
  const res = await fetch("data/strategies.json?t=" + Date.now());
  const data = await res.json();
  state.all = data.strategies;
  const sm = data.summary;
  $("eyebrow").textContent = `전략 ${sm.strategies}개 · 누적 검증 시도 ${sm.trials ?? "?"}회 · 자동 갱신`;
  const todo = state.all.filter((s) => ACTION.has(s.phase));
  $("todo").hidden = todo.length === 0;
  $("todo-count").textContent = todo.length ? `${todo.length}건` : "";
  $("todo-cards").innerHTML = todo.map(card).join("");
  $("generated").textContent = "마지막 갱신 " + new Date(data.generated).toLocaleString("ko-KR");
  render();
  document.body.addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) open(c.dataset.key); });
  $("q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("detail").addEventListener("close", () => history.replaceState(null, "", location.pathname));
  if (location.hash) open(decodeURIComponent(location.hash.slice(1)));
}

main().catch((e) => { $("eyebrow").textContent = "데이터를 불러오지 못했습니다"; console.error(e); });
