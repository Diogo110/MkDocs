document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  if (!$("music-cards")) return;

  const root = typeof __md_scope !== "undefined" ? __md_scope : new URL("../", location.href);
  const url = (path) => new URL(path, root).href;

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en");
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const pad = (n) => String(n).padStart(2, "0");

  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        observer.unobserve(e.target);
      }),
    { threshold: 0.15 }
  );
  const reveal = (box) => box.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function countUp(el) {
    const target = Number(el.dataset.value);
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / 1200, 1);
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function cards(s) {
    const items = [[s.total_hours, "hours listened"], [s.total_plays, "plays"], [s.unique_artists, "artists"], [s.unique_tracks, "different tracks"]];

    $("music-cards").innerHTML = items.map(([v, label]) => `<div class="stat-card"><strong data-value="${v}">0</strong><span>${label}</span></div>`).join("");
    $("music-cards").querySelectorAll("strong").forEach(countUp);
  }

  function timeline(list) {
    const W = 700, H = 190, BASE = 168;
    const idx = (m) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; };
    const i0 = idx(list[0].month);
    const values = new Array(idx(list[list.length - 1].month) - i0 + 1).fill(0);
    list.forEach((p) => (values[idx(p.month) - i0] = p.hours));
    const max = Math.max(...values);
    const x = (i) => (i / (values.length - 1)) * W;
    const y = (v) => BASE - (v / max) * (BASE - 12);
    const line = "M" + values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L");
    const area = `${line}L${W},${BASE}L0,${BASE}Z`;
    const colWidth = (W / values.length).toFixed(2);
    let axis = "";
    let zones = "";
    values.forEach((v, i) => {
      const n = i0 + i;
      if (n % 12 === 0) axis += `<text x="${x(i).toFixed(1)}" y="${H - 4}">${n / 12}</text>`;
      const label = `${n / 12 | 0}-${pad((n % 12) + 1)}`;
      zones += `<rect x="${(x(i) - colWidth / 2).toFixed(1)}" width="${colWidth}" height="${BASE}"><title>${label}: ${fmt(v)} h</title></rect>`;
    });

    $("music-timeline").innerHTML = `<svg viewBox="-12 0 ${W + 24} ${H}" role="img" aria-label="Hours listened per month">
      <defs><linearGradient id="timeline-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--md-accent-fg-color);stop-opacity:.45"/>
        <stop offset="1" style="stop-color:var(--md-accent-fg-color);stop-opacity:0"/>
      </linearGradient></defs>
      <path class="timeline__area" d="${area}" fill="url(#timeline-gradient)"/>
      <path class="timeline__line" d="${line}" pathLength="1"/>
      <line class="timeline__axis" x1="0" x2="${W}" y1="${BASE}" y2="${BASE}"/>
      ${axis}<g class="timeline__zones">${zones}</g></svg>
      <p class="timeline__note">Peak: <b>${fmt(max)} h</b> in a single month. Hover to see each month.</p>`;
    observer.observe($("music-timeline"));
  }

  function artists(list) {
    const top = list.slice(0, 10);
    const maxHours = top[0].hours;

    $("music-top-artists").innerHTML = "<p class='subtitle'>Artists, by hours</p>" + top.map((a, i) => `
      <div class="rank reveal ${i ? "" : "rank--top"}" style="--i:${i}; --w:${(a.hours / maxHours) * 100}%" title="${fmt(a.plays)} plays">
        <span class="rank__num">${i + 1}</span>
        <div><div class="rank__row"><b>${esc(a.name)}</b><span>${fmt(a.hours)} h</span></div><div class="rank__bar"><i></i></div></div>
      </div>`).join("");
    reveal($("music-top-artists"));
  }

  function tracks(list) {
    $("music-top-tracks").innerHTML = "<p class='subtitle'>Tracks, by plays</p><ol class='tracks'>" + list.slice(0, 10).map((m, i) => `
      <li class="reveal" style="--i:${i}">
        <span class="tracks__name">${esc(m.name)}<small>${esc(m.artist)}</small></span>
        <span class="tracks__plays">${fmt(m.plays)}</span>
      </li>`).join("") + "</ol>";
    reveal($("music-top-tracks"));
  }

  function years(s) {
    const list = s.by_year;
    const maxHours = Math.max(...list.map((a) => a.hours));

    const endIso = s.last_date || new Date().toISOString().slice(0, 10);
    const end = new Date(endIso + "T12:00:00");
    const ytd = end.getFullYear() === s.last_year && !(end.getMonth() === 11 && end.getDate() === 31);

    const step = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((st) => maxHours / st <= 4) || 5000;
    const top = Math.ceil(maxHours / step) * step;
    const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
    const hoursText = (h) => (h < 10 ? h.toFixed(1) : fmt(h));

    const grid = ticks.map((t) => `<div class="ychart__tick" style="--y:${(t / top) * 100}%"><span>${t ? fmt(t) + " h" : "0"}</span></div>`).join("");
    const bars = list.map((a, i) => {
      const partial = ytd && a.year === s.last_year;
      const cls = `ybar reveal${partial ? " ybar--partial" : ""}${a.hours === maxHours ? " ybar--peak" : ""}`;
      return `
      <div class="${cls}" style="--i:${i}; --h:${(a.hours / top) * 100}%" tabindex="0" title="${a.year}${partial ? " (so far)" : ""}: ${fmt(a.hours)} h, top artist ${esc(a.top_artist)}">
        <div class="ybar__plot"><div class="ybar__col"><span class="ybar__val">${hoursText(a.hours)}<em> h</em></span></div></div>
        <b class="ybar__year">${a.year}</b>
        ${partial ? '<span class="ybar__tag">so far</span>' : ""}
        <small class="ybar__artist">${esc(a.top_artist)}</small>
      </div>`;
    }).join("");
    const legend = `<div class="ychart__legend"><span><i></i>Full year</span>${ytd ? `<span><i class="is-dashed"></i>Year to date (up to ${fmtDate(endIso)}): still in progress</span>` : ""}</div>`;
    $("music-by-year").innerHTML = `<div class="ychart"><span class="ychart__unit">Hours listened per year</span><div class="ychart__grid">${grid}</div><div class="ychart__bars">${bars}</div></div>${legend}`;
    reveal($("music-by-year"));
  }

  function averageFromTotals(s) {
    const totals = s.heatmap_total_hours;
    if (!totals) throw new Error("No heatmap data in spotify_stats.json: run  python tools/spotify_stats.py");
    const [y0, m0] = s.by_month[0].month.split("-").map(Number);
    const [y1, m1] = s.by_month[s.by_month.length - 1].month.split("-").map(Number);
    const counts = new Array(7).fill(0);
    for (let t = Date.UTC(y0, m0 - 1, 1); t <= Date.UTC(y1, m1, 0); t += 86400000) {
      counts[(new Date(t).getUTCDay() + 6) % 7]++;
    }
    return totals.map((row, d) => row.map((hours) => (hours * 60) / counts[d]));
  }

  function heatmap(s) {
    const grid = s.heatmap_avg_min || averageFromTotals(s);
    const max = Math.max(...grid.flat());

    const sorted = grid.flat().filter((v) => v > 0).sort((a, b) => a - b);
    const level = (v) => (v <= 0 ? 0 : 1 + Math.min(4, Math.floor((sorted.indexOf(v) * 5) / sorted.length)));
    const minutes = (v) => (v === 0 ? "0" : v < 1 ? "<1" : String(Math.round(v)));
    const describe = (v) => `${minutes(v)} min of music on average`;
    const dayHours = (row) => (row.reduce((a, b) => a + b, 0) / 60).toFixed(1) + " h";
    const hint = "Hover or tap a square to see the details.";
    const hy = s.heatmap_years;
    const scope = hy && hy.length ? `It only uses the years with more than 1,000 h of music (${hy.join(", ")}) and counts every day in that period, including days without music,` : `It counts every day since ${s.first_year}, including days without music,`;

    let html = '<div class="heatmap reveal" role="img" aria-label="Heatmap of the average minutes of music I listen to, by weekday and hour">';
    html += '<div class="subtitle">Average minutes of music per hour, on a typical day</div><div class="heatmap__grid">';
    html += '<div class="heatmap__row"><span></span>' +
      Array.from({ length: 24 }, (_, h) => `<span class="heatmap__hour${h % 3 ? " heatmap__hour--quiet" : ""}" data-h="${h}">${h}</span>`).join("") +
      '<span class="heatmap__total-head">per day</span></div>';
    grid.forEach((row, d) => {
      html += `<div class="heatmap__row"><span class="heatmap__day" data-d="${d}">${DAYS[d]}</span>`;

      html += row.map((v, h) => `<i class="heatmap__cell" data-level="${level(v)}" data-d="${d}" data-h="${h}" style="--delay:${(d + h) * 16}ms"></i>`).join("");
      html += `<span class="heatmap__total">${dayHours(row)}</span></div>`;
    });
    const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((sum, row) => sum + row[h], 0));
    const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
    html += `</div>
      <div class="heatmap__info">
        <div class="heatmap__readout">${hint}</div>
        <div class="heatmap__legend"><span>Less</span><span class="heatmap__scale">${[1, 2, 3, 4, 5].map((n) => `<i data-level="${n}"></i>`).join("")}</span><span>More</span></div>
      </div>
      <p class="heatmap__summary">Peak hour: <b>${pad(peakHour)}:00</b>. Each square is how many minutes of music I listen to, on average, in that hour of that weekday (Lisbon time). ${scope} so the busiest hour of all averages ${minutes(max)} min. Colours are relative: each shade covers about a fifth of the squares. The column on the right is the average total per day.</p></div>`;
    $("music-heatmap").innerHTML = html;

    const map = $("music-heatmap").querySelector(".heatmap");
    const readout = map.querySelector(".heatmap__readout");
    let active = null;
    const select = (cell) => {
      if (cell === active) return;
      map.querySelectorAll(".is-active, .is-hot").forEach((el) => el.classList.remove("is-active", "is-hot"));
      active = cell;
      if (!cell) { readout.textContent = hint; return; }
      const d = Number(cell.dataset.d), h = Number(cell.dataset.h);
      cell.classList.add("is-active");
      map.querySelector(`.heatmap__day[data-d="${d}"]`).classList.add("is-hot");
      map.querySelector(`.heatmap__hour[data-h="${h}"]`).classList.add("is-hot");
      readout.innerHTML = `<b>${DAYS[d]}, ${pad(h)}:00-${pad((h + 1) % 24)}:00</b> · ${describe(grid[d][h])}`;
    };
    map.addEventListener("pointerover", (e) => {
      const cell = e.target.closest(".heatmap__cell");
      if (cell) select(cell);
    });
    map.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") select(null);
    });
    reveal($("music-heatmap"));
  }

  const UNITS = ["hm", "min", "d"];
  const UNIT_LABEL = { hm: "h · min", min: "min", d: "days" };
  const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  function timeParts(minutes, unit) {
    minutes = Math.round(minutes);
    if (unit === "min") return [[fmt(minutes), "min"]];
    if (unit === "d") return [[(minutes / 1440).toFixed(2), "days"]];
    const h = Math.floor(minutes / 60), m = minutes - h * 60;
    if (!h) return [[String(m), "min"]];
    return m ? [[fmt(h), "h"], [String(m), "min"]] : [[fmt(h), "h"]];
  }
  const timeText = (minutes, unit) => timeParts(minutes, unit).map(([v, u]) => `${v} ${u}`).join(" ");
  const SWAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';

  function timeCard(t, unit) {
    const value = timeParts(t.minutes, unit).map(([v, u]) => `${v}<em>${u}</em>`).join(" ");
    const others = UNITS.filter((u) => u !== unit).map((u) => timeText(t.minutes, u)).join(" · ");
    return `<span>${esc(t.label)}</span>
      <button type="button" class="unit-chip" data-key="${t.key}" aria-label="Change the unit of this card">${SWAP}${UNIT_LABEL[unit]}</button>
      <strong>${value}</strong><small>= ${others}</small><small>${esc(t.note)}</small>`;
  }

  function donut(pct, label, detail) {
    const r = 26, c = 2 * Math.PI * r;
    return `<div class="donut__row">
      <svg viewBox="0 0 64 64"><circle class="donut__track" cx="32" cy="32" r="${r}"/><circle class="donut__value" cx="32" cy="32" r="${r}" style="--c:${c.toFixed(1)}; --p:${pct}"/></svg>
      <div><strong>${pct}%</strong><span>${label}</span>${detail ? `<small>${detail}</small>` : ""}</div></div>`;
  }

  function habits(s) {
    const times = [
      { key: "avg", label: "per day I listen", minutes: s.avg_minutes_per_active_day ?? s.avg_hours_per_active_day * 60, note: `${fmt(s.total_hours)} h ÷ ${fmt(s.active_days)} days with music` },
      { key: "peak", label: "busiest day", minutes: s.busiest_day.minutes ?? s.busiest_day.hours * 60, note: fmtDate(s.busiest_day.date) },
      { key: "total", label: `listened since ${s.first_year}`, minutes: s.total_minutes ?? s.total_hours * 60, note: `${fmt(s.total_plays)} plays` },
    ];
    const boxes = [[s.longest_streak_days + " days", "longest daily streak"], [fmt(s.active_days), "days with music"]];
    const skipInfo = s.skipped_plays === undefined ? "" : `${fmt(s.skipped_plays)} of ${fmt(s.total_attempts)} tracks started`;
    const shuffleInfo = s.shuffled_plays === undefined ? "" : `${fmt(s.shuffled_plays)} of ${fmt(s.total_plays)} plays`;
    const box = $("music-facts");
    box.innerHTML = times.map((t) => `<div class="stat-card stat-card--time" data-card="${t.key}"></div>`).join("") +
      boxes.map(([v, label]) => `<div class="stat-card"><strong>${esc(v)}</strong><span>${esc(label)}</span></div>`).join("") +
      `<div class="stat-card donut donut-pair reveal">${donut(s.skip_rate, "of tracks skipped", skipInfo)}${donut(s.shuffle_rate, "played on shuffle", shuffleInfo)}</div>`;

    let global = "hm";
    const own = {};
    const unitOf = (key) => own[key] || global;
    const paintCard = (t) => { box.querySelector(`[data-card="${t.key}"]`).innerHTML = timeCard(t, unitOf(t.key)); };
    times.forEach(paintCard);

    let bar = $("music-unit-bar");
    if (!bar) {
      box.insertAdjacentHTML("beforebegin", `<div class="unit-bar" id="music-unit-bar" role="group" aria-label="Time unit"><span>Show time as</span>
        <div class="unit-seg">${UNITS.map((u) => `<button type="button" data-unit="${u}">${UNIT_LABEL[u]}</button>`).join("")}</div>
        <small>Use the chip on a card to change just that one.</small></div>`);
      bar = $("music-unit-bar");
    }
    const paintBar = () => bar.querySelectorAll("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === global)));
    bar.onclick = (e) => {
      const b = e.target.closest("[data-unit]");
      if (!b) return;
      global = b.dataset.unit;
      Object.keys(own).forEach((k) => delete own[k]);
      paintBar();
      times.forEach(paintCard);
    };
    box.onclick = (e) => {
      const chip = e.target.closest(".unit-chip");
      if (!chip) return;
      const t = times.find((x) => x.key === chip.dataset.key);
      own[t.key] = UNITS[(UNITS.indexOf(unitOf(t.key)) + 1) % UNITS.length];
      paintCard(t);
      box.querySelector(`.unit-chip[data-key="${t.key}"]`).focus();
    };
    paintBar();
    reveal(box);
  }

  const VINYL = `<svg class="vinyl" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="vinyl__disc" cx="50" cy="50" r="40"/>
    <circle class="vinyl__groove" cx="50" cy="50" r="33"/>
    <circle class="vinyl__groove" cx="50" cy="50" r="26"/>
    <circle class="vinyl__label" cx="50" cy="50" r="14"/>
    <circle class="vinyl__hole" cx="50" cy="50" r="2.5"/>
    <path class="vinyl__shine" d="M50 10A40 40 0 0 1 90 50L50 50Z"/></svg>`;

  async function fetchSpotifyCover(id) {
    const target = encodeURIComponent(`https://open.spotify.com/playlist/${id}`);
    const resp = await fetch(`https://open.spotify.com/oembed?url=${target}`, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) throw new Error("oEmbed " + resp.status);
    const { thumbnail_url } = await resp.json();
    if (!/^https:\/\//.test(thumbnail_url || "")) throw new Error("no thumbnail");
    return thumbnail_url;
  }

  function showCover(card, src) {
    const img = new Image();
    img.alt = "";
    img.onload = () => {
      card.querySelector(".playlist__art").replaceChildren(img);
      card.style.setProperty("--art", `url("${src.replace(/"/g, "%22")}")`);
      card.classList.add("has-art");
    };
    img.src = src;
  }

  async function loadCover(card, p) {
    try {

      showCover(card, p.image ? url(p.image) : await fetchSpotifyCover(p.id));
    } catch {

    }
  }

  const PLAYER_MIN = 352, PLAYER_MAX = 720, PLAYER_HEADER = 96, PLAYER_ROW = 56;
  const playerHeight = (n) => Math.min(PLAYER_MAX, Math.max(PLAYER_MIN, PLAYER_HEADER + (n || 0) * PLAYER_ROW));

  async function playlists() {
    const box = $("music-playlists");
    const heading = box.previousElementSibling;
    try {
      const resp = await fetch(url("data/playlists.json"));
      const list = resp.ok ? await resp.json() : [];
      if (!list.length) throw new Error("empty");

      box.innerHTML = list.map((p, i) => `
        <article class="playlist" style="--hue:${(170 + i * 70) % 360}; --player-h:${playerHeight(p.track_count)}px">
          <div class="playlist__info">
            <div class="playlist__art">${VINYL}</div>
            <div class="playlist__text">
              <strong class="playlist__title">${esc(p.title)}</strong>
              <p class="playlist__desc">${esc(p.description || "")}</p>
              <div class="playlist__meta">
                ${p.track_count ? `<span class="playlist__tracks">${fmt(p.track_count)} tracks</span>` : ""}
                <a class="playlist__link" href="https://open.spotify.com/playlist/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Open in Spotify ↗</a>
              </div>
            </div>
          </div>
          <div class="playlist__player">
            <iframe title="${esc(p.title)}" loading="lazy"
              src="https://open.spotify.com/embed/playlist/${encodeURIComponent(p.id)}?utm_source=generator&theme=0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
          </div>
        </article>`).join("");

      Array.from(box.children).forEach((card, i) => loadCover(card, list[i]));
    } catch {
      box.hidden = true;
      if (heading && heading.tagName === "H2") heading.hidden = true;
    }
  }

  async function init() {
    const resp = await fetch(url("data/spotify_stats.json"));
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const s = await resp.json();
    $("music-intro").innerHTML = `Since <b>${s.first_year}</b> I've listened to <b>${fmt(s.total_hours)} hours</b> of music on Spotify. That's about <b>${fmt(s.total_hours / 24)} days</b> non-stop.`;

    const sections = [cards, timeline, artists, tracks, years, heatmap, habits, playlists];
    const data = [s, s.by_month, s.top_artists, s.top_tracks, s, s, s, s];
    sections.forEach((section, k) => {
      try { section(data[k]); }
      catch (error) { console.error("Section " + section.name + " failed:", error); }
    });
  }

  init().catch((error) => ($("music-intro").textContent = "Could not load the stats: " + error.message));
});