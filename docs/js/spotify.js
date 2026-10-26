// Página Music: lê data/spotify_stats.json (criado por tools/spotify_stats.py)
// e desenha tudo com HTML + SVG + CSS. Não usa bibliotecas externas.
document.addEventListener("DOMContentLoaded", () => {              // "quando a página acabar de carregar, corre isto"
  const $ = (id) => document.getElementById(id);                   // atalho: $("x") em vez de document.getElementById("x")
  if (!$("music-cards")) return;                                   // se esta página não é a Music, pára aqui

  // __md_scope é uma variável do tema Material com o endereço raiz do site; se não existir, calculamos nós
  const root = typeof __md_scope !== "undefined" ? __md_scope : new URL("../", location.href);
  const url = (path) => new URL(path, root).href;                  // transforma "data/x.json" num endereço completo

  // esc() torna o texto seguro: troca < > & " ' por códigos, para nunca ser tratado como HTML
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en");           // 8157 -> "8,157"
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];  // nomes curtos (segunda = posição 0)
  const pad = (n) => String(n).padStart(2, "0");                   // 7 -> "07" (para as horas)

  // ---------- animações ----------
  // O observador avisa quando um elemento aparece no ecrã; aí damos-lhe a classe "in" e o CSS faz a animação
  const observer = new IntersectionObserver(                       // cria o "vigia" de elementos
    (entries) =>                                                   // função chamada quando algo muda de visibilidade
      entries.forEach((e) => {                                     // para cada elemento que mudou...
        if (!e.isIntersecting) return;                             // ...se ainda não está visível, ignora
        e.target.classList.add("in");                              // ...se está visível, junta a classe "in"
        observer.unobserve(e.target);                              // e deixa de o vigiar (anima só uma vez)
      }),
    { threshold: 0.15 }                                            // basta 15% do elemento visível para disparar
  );
  const reveal = (box) => box.querySelectorAll(".reveal").forEach((el) => observer.observe(el)); // vigia todos os .reveal dentro da caixa

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches; // true se o utilizador pediu "menos animações"
  function countUp(el) {                                           // faz um número "subir" de 0 até ao valor final
    const target = Number(el.dataset.value);                       // lê o valor final do atributo data-value
    if (reduceMotion) { el.textContent = fmt(target); return; }    // sem animações: mostra logo o valor final
    const start = performance.now();                               // hora de arranque (em milissegundos)
    const step = (now) => {                                        // chamada a cada imagem desenhada (~60x por segundo)
      const t = Math.min((now - start) / 1200, 1);                 // progresso de 0 a 1 ao longo de 1,2 s
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));     // fórmula "ease-out": começa rápido, acaba devagar
      if (t < 1) requestAnimationFrame(step);                      // se ainda não acabou, pede a próxima imagem
    };
    requestAnimationFrame(step);                                   // dá o primeiro passo
  }

  // ---------- secções ----------
  function cards(s) {                                              // os 4 números grandes do topo
    const items = [[s.total_hours, "hours listened"], [s.total_plays, "plays"], [s.unique_artists, "artists"], [s.unique_tracks, "different tracks"]];
    // para cada [valor, texto] cria um cartão; o número começa em 0 e o countUp() anima-o
    $("music-cards").innerHTML = items.map(([v, label]) => `<div class="stat-card"><strong data-value="${v}">0</strong><span>${label}</span></div>`).join("");
    $("music-cards").querySelectorAll("strong").forEach(countUp);  // arranca a animação de cada número
  }

  // Gráfico de área: horas ouvidas em cada mês (SVG feito à mão)
  function timeline(list) {
    const W = 700, H = 190, BASE = 168;                            // largura, altura total e altura do eixo X (tudo em unidades do SVG)
    const idx = (m) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; }; // "2024-05" -> nº do mês desde o ano 0
    const i0 = idx(list[0].month);                                 // nº do primeiro mês com dados
    const values = new Array(idx(list[list.length - 1].month) - i0 + 1).fill(0); // um lugar por mês (os meses sem dados ficam a 0)
    list.forEach((p) => (values[idx(p.month) - i0] = p.hours));    // põe as horas de cada mês no seu lugar
    const max = Math.max(...values);                               // mês mais forte (define a altura máxima do gráfico)
    const x = (i) => (i / (values.length - 1)) * W;                // posição horizontal do mês i
    const y = (v) => BASE - (v / max) * (BASE - 12);               // posição vertical: mais horas = mais alto (y cresce para baixo)
    const line = "M" + values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L"); // caminho SVG "M x,y L x,y L..."
    const area = `${line}L${W},${BASE}L0,${BASE}Z`;                // fecha o caminho pela base para poder pintar por baixo da linha
    const colWidth = (W / values.length).toFixed(2);               // largura de cada coluna invisível de hover
    let axis = "";                                                 // aqui juntamos os anos do eixo X
    let zones = "";                                                // aqui juntamos as colunas de hover
    values.forEach((v, i) => {                                     // para cada mês...
      const n = i0 + i;                                            // ...nº absoluto do mês
      if (n % 12 === 0) axis += `<text x="${x(i).toFixed(1)}" y="${H - 4}">${n / 12}</text>`; // janeiro: escreve o ano
      const label = `${n / 12 | 0}-${pad((n % 12) + 1)}`;          // texto "2024-05" para o tooltip
      zones += `<rect x="${(x(i) - colWidth / 2).toFixed(1)}" width="${colWidth}" height="${BASE}"><title>${label}: ${fmt(v)} h</title></rect>`; // <title> = tooltip nativo
    });
    // pathLength="1" deixa o CSS animar o desenho da linha com valores simples (0 a 1)
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
    observer.observe($("music-timeline"));                               // pede ao vigia para animar o gráfico quando aparecer (a classe .reveal já está no music.md)
  }

  function artists(list) {                                         // barras horizontais: top 10 artistas
    const top = list.slice(0, 10);                                 // fica só com os 10 primeiros
    const maxHours = top[0].hours;                                 // o nº 1 define 100% da largura
    // --i atrasa cada linha um pouco (efeito cascata); --w é a largura final da barra
    $("music-top-artists").innerHTML = "<p class='subtitle'>Artists, by hours</p>" + top.map((a, i) => `
      <div class="rank reveal ${i ? "" : "rank--top"}" style="--i:${i}; --w:${(a.hours / maxHours) * 100}%" title="${fmt(a.plays)} plays">
        <span class="rank__num">${i + 1}</span>
        <div><div class="rank__row"><b>${esc(a.name)}</b><span>${fmt(a.hours)} h</span></div><div class="rank__bar"><i></i></div></div>
      </div>`).join("");
    reveal($("music-top-artists"));                                      // arranca as animações
  }

  function tracks(list) {                                          // lista: top 10 músicas
    $("music-top-tracks").innerHTML = "<p class='subtitle'>Tracks, by plays</p><ol class='tracks'>" + list.slice(0, 10).map((m, i) => `
      <li class="reveal" style="--i:${i}">
        <span class="tracks__name">${esc(m.name)}<small>${esc(m.artist)}</small></span>
        <span class="tracks__plays">${fmt(m.plays)}</span>
      </li>`).join("") + "</ol>";
    reveal($("music-top-tracks"));                                       // arranca as animações
  }

  function years(s) {                                              // gráfico de barras: horas por ano, com eixo e unidades (recebe o JSON todo)
    const list = s.by_year;
    const maxHours = Math.max(...list.map((a) => a.hours));        // o melhor ano
    // ano em curso = parcial. Se o JSON não tiver last_date (versão antiga), usa a data de hoje
    const endIso = s.last_date || new Date().toISOString().slice(0, 10);
    const end = new Date(endIso + "T12:00:00");
    const ytd = end.getFullYear() === s.last_year && !(end.getMonth() === 11 && end.getDate() === 31); // true = o último ano ainda não acabou
    // eixo "redondo": escolhe o passo mais pequeno que dê no máximo 4 intervalos (ex.: 0, 500, 1000, 1500, 2000 h)
    const step = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((st) => maxHours / st <= 4) || 5000;
    const top = Math.ceil(maxHours / step) * step;                 // topo do eixo
    const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
    const hoursText = (h) => (h < 10 ? h.toFixed(1) : fmt(h));     // anos minúsculos mostram 1 casa decimal (2.6 h em vez de 3 h)

    const grid = ticks.map((t) => `<div class="ychart__tick" style="--y:${(t / top) * 100}%"><span>${t ? fmt(t) + " h" : "0"}</span></div>`).join("");
    const bars = list.map((a, i) => {
      const partial = ytd && a.year === s.last_year;               // só o último ano pode ser parcial
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
    reveal($("music-by-year"));                                    // arranca as animações
  }

  // Converte os totais do JSON antigo (horas somadas ao longo dos anos) em média de minutos por hora, num dia típico.
  // Divide pelo nº de dias de calendário de cada dia da semana (ex.: quantas segundas-feiras houve desde o início).
  function averageFromTotals(s) {
    const totals = s.heatmap_total_hours;                          // tabela 7x24 com HORAS TOTAIS (a soma de todos os anos)
    if (!totals) throw new Error("No heatmap data in spotify_stats.json: run  python tools/spotify_stats.py");  // aviso útil em vez de um erro críptico
    const [y0, m0] = s.by_month[0].month.split("-").map(Number);   // primeiro mês com dados, ex.: [2016, 9]
    const [y1, m1] = s.by_month[s.by_month.length - 1].month.split("-").map(Number); // último mês com dados
    const counts = new Array(7).fill(0);                           // quantas segundas, terças... houve no período
    for (let t = Date.UTC(y0, m0 - 1, 1); t <= Date.UTC(y1, m1, 0); t += 86400000) { // do dia 1 do primeiro mês ao último dia do último (dia 0 do mês seguinte)
      counts[(new Date(t).getUTCDay() + 6) % 7]++;                 // getUTCDay(): domingo=0; o "+6 % 7" põe a segunda em 0
    }
    return totals.map((row, d) => row.map((hours) => (hours * 60) / counts[d])); // horas -> minutos, por dia
  }

  // Mapa de calor: dia da semana x hora.
  // O que mede: a MÉDIA de minutos de música que ouço em cada hora de um dia típico (ex.: uma segunda-feira qualquer),
  // contando todos os dias desde o início, mesmo os que não ouvi nada. Por isso nunca passa de 60 minutos por quadrado.
  // Cada quadrado cresce quando o rato passa (ou ao tocar), uma linha por baixo explica o valor,
  // a legenda mostra a escala e a coluna da direita o total médio de cada dia.
  function heatmap(s) {
    const grid = s.heatmap_avg_min || averageFromTotals(s);        // JSON novo: já vem em médias; JSON antigo: converte os totais
    const max = Math.max(...grid.flat());                          // .flat() achata a tabela; o máximo define o nível mais forte
    // Níveis de cor por "quantis": ordenamos todos os valores e cada um dos 5 tons fica com ~1/5 dos quadrados.
    // Assim as cores ficam sempre bem distintas (com uma escala linear, quase tudo ficava com o mesmo tom). 0 = sem música
    const sorted = grid.flat().filter((v) => v > 0).sort((a, b) => a - b); // todos os valores acima de zero, do menor para o maior
    const level = (v) => (v <= 0 ? 0 : 1 + Math.min(4, Math.floor((sorted.indexOf(v) * 5) / sorted.length))); // posição do valor na lista -> tom 1 a 5
    const minutes = (v) => (v === 0 ? "0" : v < 1 ? "<1" : String(Math.round(v))); // arredonda; abaixo de 1 mostra "<1"
    const describe = (v) => `${minutes(v)} min of music on average`; // frase do valor de um quadrado
    const dayHours = (row) => (row.reduce((a, b) => a + b, 0) / 60).toFixed(1) + " h"; // soma das 24 horas, em horas: o total médio desse dia
    const hint = "Hover or tap a square to see the details.";
    const hy = s.heatmap_years;                                    // anos usados (JSON novo); o JSON antigo não os tem
    const scope = hy && hy.length ? `It only uses the years with more than 1,000 h of music (${hy.join(", ")}) and counts every day in that period, including days without music,` : `It counts every day since ${s.first_year}, including days without music,`;      // texto da linha de detalhe, antes de escolher um quadrado

    // linha de cima: todas as horas existem (para poder destacar a escolhida), mas só de 3 em 3 ficam visíveis
    let html = '<div class="heatmap reveal" role="img" aria-label="Heatmap of the average minutes of music I listen to, by weekday and hour">';
    html += '<div class="subtitle">Average minutes of music per hour, on a typical day</div><div class="heatmap__grid">';
    html += '<div class="heatmap__row"><span></span>' +
      Array.from({ length: 24 }, (_, h) => `<span class="heatmap__hour${h % 3 ? " heatmap__hour--quiet" : ""}" data-h="${h}">${h}</span>`).join("") +
      '<span class="heatmap__total-head">per day</span></div>';
    grid.forEach((row, d) => {                                     // uma linha por dia da semana
      html += `<div class="heatmap__row"><span class="heatmap__day" data-d="${d}">${DAYS[d]}</span>`; // nome do dia à esquerda
      // um quadradinho por hora; data-level escolhe a cor no CSS; --delay faz os quadrados aparecerem em onda na diagonal
      html += row.map((v, h) => `<i class="heatmap__cell" data-level="${level(v)}" data-d="${d}" data-h="${h}" style="--delay:${(d + h) * 16}ms"></i>`).join("");
      html += `<span class="heatmap__total">${dayHours(row)}</span></div>`; // total médio do dia à direita
    });
    const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((sum, row) => sum + row[h], 0)); // soma de cada hora nos 7 dias (só os anos do mapa)
    const peakHour = hourTotals.indexOf(Math.max(...hourTotals));  // posição do maior valor = hora de pico
    html += `</div>
      <div class="heatmap__info">
        <div class="heatmap__readout">${hint}</div>
        <div class="heatmap__legend"><span>Less</span><span class="heatmap__scale">${[1, 2, 3, 4, 5].map((n) => `<i data-level="${n}"></i>`).join("")}</span><span>More</span></div>
      </div>
      <p class="heatmap__summary">Peak hour: <b>${pad(peakHour)}:00</b>. Each square is how many minutes of music I listen to, on average, in that hour of that weekday (Lisbon time). ${scope} so the busiest hour of all averages ${minutes(max)} min. Colours are relative: each shade covers about a fifth of the squares. The column on the right is the average total per day.</p></div>`;
    $("music-heatmap").innerHTML = html;                           // mete tudo na página

    // ---- interação: o quadrado cresce (CSS) e esta função escreve o detalhe por baixo ----
    const map = $("music-heatmap").querySelector(".heatmap");      // a caixa do mapa
    const readout = map.querySelector(".heatmap__readout");        // a linha de detalhe
    let active = null;                                             // o quadrado escolhido neste momento
    const select = (cell) => {                                     // escolhe um quadrado (ou nenhum, com null)
      if (cell === active) return;                                 // já era este: nada a fazer
      map.querySelectorAll(".is-active, .is-hot").forEach((el) => el.classList.remove("is-active", "is-hot")); // limpa o destaque anterior
      active = cell;                                               // guarda o novo
      if (!cell) { readout.textContent = hint; return; }           // sem quadrado: volta à dica inicial
      const d = Number(cell.dataset.d), h = Number(cell.dataset.h); // dia e hora do quadrado
      cell.classList.add("is-active");                             // mantém-no crescido (útil no telemóvel, onde não há hover)
      map.querySelector(`.heatmap__day[data-d="${d}"]`).classList.add("is-hot");   // destaca o nome do dia...
      map.querySelector(`.heatmap__hour[data-h="${h}"]`).classList.add("is-hot");  // ...e o número da hora
      readout.innerHTML = `<b>${DAYS[d]}, ${pad(h)}:00-${pad((h + 1) % 24)}:00</b> · ${describe(grid[d][h])}`; // ex.: "Mon, 16:00-17:00 · 11 min of music on average"
    };
    map.addEventListener("pointerover", (e) => {                   // rato por cima, ou toque
      const cell = e.target.closest(".heatmap__cell");             // estamos num quadrado? (senão é null)
      if (cell) select(cell);                                      // se sim, escolhe-o (os intervalos entre quadrados não limpam nada)
    });
    map.addEventListener("pointerleave", (e) => {                  // o ponteiro saiu do mapa
      if (e.pointerType === "mouse") select(null);                 // com rato limpa; com toque deixa o último detalhe visível
    });
    reveal($("music-heatmap"));                                    // arranca a animação de entrada
  }

  // ---------- unidades de tempo: h · min / min / days ----------
  const UNITS = ["hm", "min", "d"];                                // as 3 formas de mostrar um tempo
  const UNIT_LABEL = { hm: "h · min", min: "min", d: "days" };     // texto dos botões e dos chips
  const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); // "29 Sept 2026"
  // devolve o tempo como lista de [número, unidade]; ex.: 996 min em "hm" -> [["16","h"],["36","min"]]
  function timeParts(minutes, unit) {
    minutes = Math.round(minutes);                                 // trabalhamos sempre com minutos inteiros
    if (unit === "min") return [[fmt(minutes), "min"]];
    if (unit === "d") return [[(minutes / 1440).toFixed(2), "days"]];
    const h = Math.floor(minutes / 60), m = minutes - h * 60;      // horas inteiras + minutos que sobram
    if (!h) return [[String(m), "min"]];
    return m ? [[fmt(h), "h"], [String(m), "min"]] : [[fmt(h), "h"]];
  }
  const timeText = (minutes, unit) => timeParts(minutes, unit).map(([v, u]) => `${v} ${u}`).join(" "); // "16 h 36 min"
  const SWAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>'; // ícone ⇄ do chip

  // Conteúdo de um cartão de tempo: legenda + chip da unidade + valor + equivalências exatas + nota
  function timeCard(t, unit) {
    const value = timeParts(t.minutes, unit).map(([v, u]) => `${v}<em>${u}</em>`).join(" ");
    const others = UNITS.filter((u) => u !== unit).map((u) => timeText(t.minutes, u)).join(" · "); // as outras duas unidades
    return `<span>${esc(t.label)}</span>
      <button type="button" class="unit-chip" data-key="${t.key}" aria-label="Change the unit of this card">${SWAP}${UNIT_LABEL[unit]}</button>
      <strong>${value}</strong><small>= ${others}</small><small>${esc(t.note)}</small>`;
  }

  // "Donut": um círculo cuja volta se vai preenchendo até à percentagem pedida (+ uma linha com o valor absoluto)
  function donut(pct, label, detail) {
    const r = 26, c = 2 * Math.PI * r;                             // raio e perímetro do círculo (2·π·r)
    return `<div class="donut__row">
      <svg viewBox="0 0 64 64"><circle class="donut__track" cx="32" cy="32" r="${r}"/><circle class="donut__value" cx="32" cy="32" r="${r}" style="--c:${c.toFixed(1)}; --p:${pct}"/></svg>
      <div><strong>${pct}%</strong><span>${label}</span>${detail ? `<small>${detail}</small>` : ""}</div></div>`;
  }

  function habits(s) {                                             // 3 tempos (com seletor de unidade) + 2 curiosidades + skips/shuffle
    const times = [
      { key: "avg", label: "per day I listen", minutes: s.avg_minutes_per_active_day ?? s.avg_hours_per_active_day * 60, note: `${fmt(s.total_hours)} h ÷ ${fmt(s.active_days)} days with music` },
      { key: "peak", label: "busiest day", minutes: s.busiest_day.minutes ?? s.busiest_day.hours * 60, note: fmtDate(s.busiest_day.date) },
      { key: "total", label: `listened since ${s.first_year}`, minutes: s.total_minutes ?? s.total_hours * 60, note: `${fmt(s.total_plays)} plays` },
    ];
    const boxes = [[s.longest_streak_days + " days", "longest daily streak"], [fmt(s.active_days), "days with music"]];
    const skipInfo = s.skipped_plays === undefined ? "" : `${fmt(s.skipped_plays)} of ${fmt(s.total_attempts)} tracks started`; // JSON antigo: sem esta linha
    const shuffleInfo = s.shuffled_plays === undefined ? "" : `${fmt(s.shuffled_plays)} of ${fmt(s.total_plays)} plays`;
    const box = $("music-facts");
    box.innerHTML = times.map((t) => `<div class="stat-card stat-card--time" data-card="${t.key}"></div>`).join("") +
      boxes.map(([v, label]) => `<div class="stat-card"><strong>${esc(v)}</strong><span>${esc(label)}</span></div>`).join("") +
      `<div class="stat-card donut donut-pair reveal">${donut(s.skip_rate, "of tracks skipped", skipInfo)}${donut(s.shuffle_rate, "played on shuffle", shuffleInfo)}</div>`;

    // estado: unidade global + unidade própria de cada cartão (quando se clica no chip)
    let global = "hm";
    const own = {};
    const unitOf = (key) => own[key] || global;
    const paintCard = (t) => { box.querySelector(`[data-card="${t.key}"]`).innerHTML = timeCard(t, unitOf(t.key)); };
    times.forEach(paintCard);

    // barra com o seletor global (criada aqui, por isso o music.md não precisa de mudar)
    let bar = $("music-unit-bar");
    if (!bar) {
      box.insertAdjacentHTML("beforebegin", `<div class="unit-bar" id="music-unit-bar" role="group" aria-label="Time unit"><span>Show time as</span>
        <div class="unit-seg">${UNITS.map((u) => `<button type="button" data-unit="${u}">${UNIT_LABEL[u]}</button>`).join("")}</div>
        <small>Use the chip on a card to change just that one.</small></div>`);
      bar = $("music-unit-bar");
    }
    const paintBar = () => bar.querySelectorAll("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === global)));
    bar.onclick = (e) => {                                         // onclick (e não addEventListener) para nunca empilhar ouvintes
      const b = e.target.closest("[data-unit]");
      if (!b) return;
      global = b.dataset.unit;
      Object.keys(own).forEach((k) => delete own[k]);              // a escolha global limpa as escolhas por cartão
      paintBar();
      times.forEach(paintCard);
    };
    box.onclick = (e) => {
      const chip = e.target.closest(".unit-chip");
      if (!chip) return;
      const t = times.find((x) => x.key === chip.dataset.key);
      own[t.key] = UNITS[(UNITS.indexOf(unitOf(t.key)) + 1) % UNITS.length]; // h·min -> min -> days -> h·min
      paintCard(t);
      box.querySelector(`.unit-chip[data-key="${t.key}"]`).focus(); // o cartão foi redesenhado: devolve o foco ao chip (teclado)
    };
    paintBar();
    reveal(box);                                                   // anima os donuts quando aparecerem
  }

  // Disco de vinil desenhado em SVG: é a capa "de reserva" quando ainda não há (ou não carrega) a imagem verdadeira
  // As cores vêm do CSS (variável --hue de cada cartão), por isso cada playlist fica com a sua cor
  const VINYL = `<svg class="vinyl" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="vinyl__disc" cx="50" cy="50" r="40"/>
    <circle class="vinyl__groove" cx="50" cy="50" r="33"/>
    <circle class="vinyl__groove" cx="50" cy="50" r="26"/>
    <circle class="vinyl__label" cx="50" cy="50" r="14"/>
    <circle class="vinyl__hole" cx="50" cy="50" r="2.5"/>
    <path class="vinyl__shine" d="M50 10A40 40 0 0 1 90 50L50 50Z"/></svg>`;

  // Pede ao Spotify a capa da playlist (oEmbed devolve o endereço da imagem num JSON)
  async function fetchSpotifyCover(id) {
    const target = encodeURIComponent(`https://open.spotify.com/playlist/${id}`); // o endereço da playlist, seguro para meter noutro endereço
    const resp = await fetch(`https://open.spotify.com/oembed?url=${target}`, { signal: AbortSignal.timeout(6000) }); // desiste ao fim de 6 s
    if (!resp.ok) throw new Error("oEmbed " + resp.status);        // erro do servidor: salta para o catch de quem chamou
    const { thumbnail_url } = await resp.json();                   // só nos interessa o endereço da imagem
    if (!/^https:\/\//.test(thumbnail_url || "")) throw new Error("no thumbnail"); // só aceitamos imagens https
    return thumbnail_url;
  }

  // Troca o vinil pela capa verdadeira (e usa a mesma imagem, desfocada, como fundo do cartão)
  function showCover(card, src) {
    const img = new Image();                                       // carrega a imagem "à parte"...
    img.alt = "";                                                  // decorativa: o título já está escrito ao lado
    img.onload = () => {                                           // ...e só quando estiver pronta mexemos no cartão (sem piscar)
      card.querySelector(".playlist__art").replaceChildren(img);   // põe a imagem no lugar do vinil
      card.style.setProperty("--art", `url("${src.replace(/"/g, "%22")}")`); // o CSS usa --art para o fundo desfocado
      card.classList.add("has-art");                               // liga o fundo desfocado
    };
    img.src = src;                                                 // começa a descarregar
  }

  async function loadCover(card, p) {                              // procura a capa de uma playlist; se falhar, fica o vinil
    try {
      // "image" no playlists.json tem prioridade (ficheiro teu, ex.: assets/playlists/indie.jpg); senão pergunta ao Spotify
      showCover(card, p.image ? url(p.image) : await fetchSpotifyCover(p.id));
    } catch {
      /* sem capa: o vinil continua à vista */
    }
  }

  // Altura do leitor do Spotify = cabeçalho + uma linha por faixa, para a lista aparecer toda sem scroll.
  // Se a playlist for muito comprida, o leitor tem scroll próprio a partir do máximo. Ajusta estes números à vontade.
  const PLAYER_MIN = 352, PLAYER_MAX = 720, PLAYER_HEADER = 96, PLAYER_ROW = 56;
  const playerHeight = (n) => Math.min(PLAYER_MAX, Math.max(PLAYER_MIN, PLAYER_HEADER + (n || 0) * PLAYER_ROW));

  async function playlists() {                                     // mostra as playlists: capa à esquerda, lista de faixas logo ao lado
    const box = $("music-playlists");                              // a <div> onde vão aparecer (o prefixo "music-" evita colidir com o id que o MkDocs dá ao título "Playlists")
    const heading = box.previousElementSibling;                    // o título "Playlists" mesmo antes da div
    try {                                                          // tenta carregar...
      const resp = await fetch(url("data/playlists.json"));        // ...pede o ficheiro (await = espera pela resposta)
      const list = resp.ok ? await resp.json() : [];               // se correu bem lê o JSON, senão usa lista vazia
      if (!list.length) throw new Error("empty");                  // lista vazia = salta para o catch

      // cada playlist vira um cartão largo: informação à esquerda, leitor do Spotify (com todas as faixas) à direita. Sem botões.
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

      // as capas carregam em segundo plano: a página aparece logo com o vinil e cada capa (e o fundo desfocado) entra quando chegar
      Array.from(box.children).forEach((card, i) => loadCover(card, list[i]));
    } catch {                                                      // se algo falhou ou não há playlists...
      box.hidden = true;                                           // ...esconde a caixa
      if (heading && heading.tagName === "H2") heading.hidden = true; // ...e o título também
    }
  }

  async function init() {                                          // função principal: carrega os dados e desenha tudo
    const resp = await fetch(url("data/spotify_stats.json"));      // pede o ficheiro de estatísticas
    if (!resp.ok) throw new Error("HTTP " + resp.status);          // se o servidor respondeu com erro, avisa
    const s = await resp.json();                                   // transforma o texto JSON em objeto JavaScript
    $("music-intro").innerHTML = `Since <b>${s.first_year}</b> I've listened to <b>${fmt(s.total_hours)} hours</b> of music on Spotify. That's about <b>${fmt(s.total_hours / 24)} days</b> non-stop.`; // frase de abertura
    // cada secção corre "isolada": se uma falhar, as outras continuam a aparecer
    const sections = [cards, timeline, artists, tracks, years, heatmap, habits, playlists]; // a ordem em que aparecem
    const data = [s, s.by_month, s.top_artists, s.top_tracks, s, s, s, s];          // o que cada função recebe
    sections.forEach((section, k) => {                             // para cada secção...
      try { section(data[k]); }                                    // ...tenta desenhá-la
      catch (error) { console.error("Section " + section.name + " failed:", error); } // ...se falhar, escreve o erro na consola (F12) e segue
    });
  }

  // se alguma coisa em init() falhar, mostra o erro em vez de deixar a página em branco
  init().catch((error) => ($("music-intro").textContent = "Could not load the stats: " + error.message));
});