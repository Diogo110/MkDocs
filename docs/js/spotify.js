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

  function years(list) {                                           // colunas verticais: horas por ano
    const maxHours = Math.max(...list.map((a) => a.hours));        // o melhor ano define 100% da altura
    $("music-by-year").innerHTML = list.map((a, i) => `
      <div class="year reveal" style="--i:${i}; --h:${(a.hours / maxHours) * 100}%" tabindex="0" title="${a.year}: ${fmt(a.hours)} h, top artist ${esc(a.top_artist)}">
        <span class="year__hours">${fmt(a.hours)}</span>
        <div class="year__column"><i></i></div>
        <b>${a.year}</b>
        <small>${esc(a.top_artist)}</small>
      </div>`).join("");
    reveal($("music-by-year"));                                          // arranca as animações
  }

  // Mapa de calor: dia da semana x hora. Cada quadrado cresce quando o rato passa (ou ao tocar) e
  // uma linha por baixo explica o valor; a legenda mostra a escala e a coluna da direita o total do dia.
  function heatmap(s) {
    const average = s.heatmap_avg_min;                             // tabela 7x24: minutos de música, em média, em cada hora (JSON novo)
    const grid = average || s.heatmap_total_hours;                 // JSON antigo: usa os totais em horas, para a secção nunca ficar vazia
    if (!grid) throw new Error("No heatmap data in spotify_stats.json: run  python tools/spotify_stats.py");  // aviso útil em vez de um erro críptico
    const isAverage = Boolean(average);                            // true = médias em minutos; false = totais em horas
    const unit = isAverage ? "min" : "h";                          // unidade mostrada na legenda
    const max = Math.max(...grid.flat());                          // .flat() achata a tabela; o máximo define a cor mais forte
    const amount = (v) => isAverage
      ? (v === 0 ? "0" : v < 1 ? "<1" : String(Math.round(v)))     // minutos: arredonda; abaixo de 1 mostra "<1"
      : v.toLocaleString("en", { maximumFractionDigits: 1 });      // horas: uma casa decimal
    const describe = (v) => isAverage ? `${amount(v)} min of music on average` : `${amount(v)} h of music in total`; // frase do valor de um quadrado
    const rowTotal = (row) => {                                    // total mostrado no fim de cada linha (cada dia da semana)
      const sum = row.reduce((a, b) => a + b, 0);                  // soma as 24 horas do dia
      return isAverage ? `${(sum / 60).toFixed(1)} h` : `${fmt(sum)} h`; // médias: minutos -> horas por dia em que ouço; totais: horas
    };
    const hint = "Hover or tap a square to see the details.";      // texto da linha de detalhe, antes de escolher um quadrado

    // linha de cima: todas as horas existem (para poder destacar a escolhida), mas só de 3 em 3 ficam visíveis
    let html = '<div class="heatmap reveal" role="img" aria-label="Heatmap of my listening by weekday and hour"><div class="heatmap__grid">';
    html += '<div class="heatmap__row"><span></span>' +
      Array.from({ length: 24 }, (_, h) => `<span class="heatmap__hour${h % 3 ? " heatmap__hour--quiet" : ""}" data-h="${h}">${h}</span>`).join("") +
      `<span class="heatmap__total-head">${isAverage ? "per day" : "total"}</span></div>`;
    grid.forEach((row, d) => {                                     // uma linha por dia da semana
      html += `<div class="heatmap__row"><span class="heatmap__day" data-d="${d}">${DAYS[d]}</span>`; // nome do dia à esquerda
      // um quadradinho por hora; --p é a intensidade da cor (mínimo 5% para não desaparecer);
      // --delay faz os quadrados aparecerem em onda na diagonal
      html += row.map((v, h) => `<i class="heatmap__cell" data-d="${d}" data-h="${h}" style="--p:${Math.max(5, Math.round((v / max) * 100))}%; --delay:${(d + h) * 16}ms"></i>`).join("");
      html += `<span class="heatmap__total">${rowTotal(row)}</span></div>`; // total do dia à direita
    });
    const peakHour = s.by_hour.indexOf(Math.max(...s.by_hour));    // posição do maior valor = hora de pico
    html += `</div>
      <div class="heatmap__info">
        <div class="heatmap__readout">${hint}</div>
        <div class="heatmap__legend"><span>0 ${unit}</span><i class="heatmap__scale"></i><span>${amount(max)} ${unit}</span></div>
      </div></div>`;
    html += isAverage
      ? `<p class="heatmap__summary">Peak hour: <b>${pad(peakHour)}:00</b>. Each square is the average minutes of music in that hour, on days I listen (Lisbon time). Stronger colour = more listening.</p>`
      : `<p class="heatmap__summary">Peak hour: <b>${pad(peakHour)}:00</b>. Each square is the total hours of music in that hour of the week since ${s.first_year} (Lisbon time). Stronger colour = more listening.</p>`;
    $("music-heatmap").innerHTML = html;                                 // mete tudo na página

    // ---- interação: o quadrado cresce (CSS) e esta função escreve o detalhe por baixo ----
    const map = $("music-heatmap").querySelector(".heatmap");            // a caixa do mapa
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
      readout.innerHTML = `<b>${DAYS[d]}, ${pad(h)}:00-${pad((h + 1) % 24)}:00</b> · ${describe(grid[d][h])}`; // ex.: "Mon, 16:00-17:00 · 31 min of music on average"
    };
    map.addEventListener("pointerover", (e) => {                   // rato por cima, ou toque
      const cell = e.target.closest(".heatmap__cell");             // estamos num quadrado? (senão é null)
      if (cell) select(cell);                                      // se sim, escolhe-o (os intervalos entre quadrados não limpam nada)
    });
    map.addEventListener("pointerleave", (e) => {                  // o ponteiro saiu do mapa
      if (e.pointerType === "mouse") select(null);                 // com rato limpa; com toque deixa o último detalhe visível
    });
    reveal($("music-heatmap"));                                          // arranca a animação de entrada
  }

  // "Donut": um círculo cuja volta se vai preenchendo até à percentagem pedida
  function donut(pct, label) {
    const r = 26, c = 2 * Math.PI * r;                             // raio e perímetro do círculo (2·π·r)
    return `<div class="stat-card donut reveal">
      <svg viewBox="0 0 64 64"><circle class="donut__track" cx="32" cy="32" r="${r}"/><circle class="donut__value" cx="32" cy="32" r="${r}" style="--c:${c.toFixed(1)}; --p:${pct}"/></svg>
      <div><strong>${pct}%</strong><span>${label}</span></div></div>`;
  }

  function habits(s) {                                             // 2 donuts + 4 curiosidades
    const day = new Date(s.busiest_day.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); // "29 Sept 2026"
    const boxes = [
      [s.longest_streak_days + " days", "longest daily streak"],
      [s.busiest_day.hours + " h", "busiest day, " + day],
      [s.avg_hours_per_active_day + " h", "per day I listen"],
      [fmt(s.active_days), "days with music"],
    ];
    $("music-facts").innerHTML = donut(s.skip_rate, "of tracks skipped") + donut(s.shuffle_rate, "played on shuffle") +
      boxes.map(([v, label]) => `<div class="stat-card"><strong>${esc(v)}</strong><span>${esc(label)}</span></div>`).join(""); // junta donuts e cartões
    reveal($("music-facts"));                                      // anima os donuts quando aparecerem
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

  async function playlists() {                                     // mostra as playlists do Spotify em cartões
    const box = $("music-playlists");                              // a <div> onde vão aparecer (o prefixo "music-" evita colidir com o id que o MkDocs dá ao título "Playlists")
    const heading = box.previousElementSibling;                    // o título "Playlists" mesmo antes da div
    try {                                                          // tenta carregar...
      const resp = await fetch(url("data/playlists.json"));        // ...pede o ficheiro (await = espera pela resposta)
      const list = resp.ok ? await resp.json() : [];               // se correu bem lê o JSON, senão usa lista vazia
      if (!list.length) throw new Error("empty");                  // lista vazia = salta para o catch

      // cada playlist vira um cartão; a cor muda de cartão para cartão (hue = matiz, 0 a 360)
      box.innerHTML = list.map((p, i) => `
        <article class="playlist" style="--hue:${(170 + i * 70) % 360}">
          <div class="playlist__cover">
            <div class="playlist__art">${VINYL}</div>
            <div class="playlist__text">
              <strong class="playlist__title">${esc(p.title)}</strong>
              <p class="playlist__desc">${esc(p.description || "")}</p>
              ${p.track_count ? `<span class="playlist__tracks">${fmt(p.track_count)} tracks</span>` : ""}
            </div>
          </div>
          <div class="playlist__body">
            <button type="button" class="playlist__button" aria-expanded="false" data-id="${esc(p.id)}" data-title="${esc(p.title)}">Play here</button>
            <a class="playlist__link" href="https://open.spotify.com/playlist/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Open in Spotify</a>
          </div>
          <div class="playlist__player" hidden></div>
        </article>`).join("");

      // as capas carregam em segundo plano: a página aparece logo com o vinil e cada capa entra quando chegar
      Array.from(box.children).forEach((card, i) => loadCover(card, list[i]));

      // fechar um leitor: esconde a caixa e APAGA o iframe (apagar o iframe também pára a música)
      const close = (button) => {
        const player = button.closest(".playlist").querySelector(".playlist__player"); // a caixa do leitor deste cartão
        player.hidden = true;                                      // esconde-a
        player.innerHTML = "";                                     // apaga o iframe lá de dentro
        button.setAttribute("aria-expanded", "false");             // avisa leitores de ecrã que está fechado
        button.textContent = "Play here";                          // o botão volta ao texto inicial
      };

      // um único "ouvinte" para a caixa toda: reage a cliques em qualquer botão (delegação de eventos)
      // usamos onclick (e não addEventListener) para nunca ficarem dois ouvintes empilhados na mesma caixa
      box.onclick = (e) => {
        const button = e.target.closest(".playlist__button");      // o clique foi num botão destes? (senão é null)
        if (!button) return;                                       // se não foi, ignora
        const wasOpen = button.getAttribute("aria-expanded") === "true"; // este leitor já estava aberto?
        box.querySelectorAll(".playlist__button[aria-expanded='true']").forEach(close); // fecha todos (assim só toca uma playlist de cada vez)
        if (wasOpen) return;                                       // se estava aberto, ficou fechado e acabou
        const player = button.closest(".playlist").querySelector(".playlist__player"); // a caixa do leitor deste cartão
        // o iframe só é criado agora, ao clicar: a página carrega mais depressa e não gasta dados à toa
        // theme=0 = leitor escuro do Spotify
        player.innerHTML = `<iframe title="${esc(button.dataset.title)}"
          src="https://open.spotify.com/embed/playlist/${encodeURIComponent(button.dataset.id)}?utm_source=generator&theme=0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
        player.hidden = false;                                     // mostra a caixa
        button.setAttribute("aria-expanded", "true");              // marca como aberto
        button.textContent = "Close player";                       // o botão passa a fechar
      };
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
    const data = [s, s.by_month, s.top_artists, s.top_tracks, s.by_year, s, s, s];          // o que cada função recebe
    sections.forEach((section, k) => {                             // para cada secção...
      try { section(data[k]); }                                    // ...tenta desenhá-la
      catch (error) { console.error("Section " + section.name + " failed:", error); } // ...se falhar, escreve o erro na consola (F12) e segue
    });
  }

  // se alguma coisa em init() falhar, mostra o erro em vez de deixar a página em branco
  init().catch((error) => ($("music-intro").textContent = "Could not load the stats: " + error.message));
});