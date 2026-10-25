// Página Photography: lê data/photos.json e cria uma galeria em mosaico
// com filtros por categoria e um lightbox (setas, Esc, swipe).
document.addEventListener("DOMContentLoaded", () => {
  const grelha = document.getElementById("gallery");
  if (!grelha) return; // só corre na página Photography

  const raiz = typeof __md_scope !== "undefined" ? __md_scope : new URL("../", location.href);
  const url = (caminho) => new URL(caminho, raiz).href;
  const esc = (t) =>
    String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let fotos = [];
  let visiveis = []; // índices das fotos que passam o filtro atual
  let atual = 0; // posição dentro de "visiveis"
  let lightbox, ultimoFoco;

  // ---------- mosaico ----------
  function desenhar() {
    grelha.innerHTML = fotos
      .map(
        (f, i) => `
      <figure class="foto ${esc(f.formato)}" data-i="${i}" data-cat="${esc(f.categoria)}" style="--i:${i % 12}">
        <button type="button" aria-label="Open photo: ${esc(f.titulo)}">
          <img src="${url(f.src)}" alt="${esc(f.titulo)}" loading="lazy" decoding="async">
          <figcaption>
            <b>${esc(f.titulo)}</b>
            <span>${esc([f.categoria, f.local].filter(Boolean).join(" · "))}</span>
          </figcaption>
        </button>
      </figure>`
      )
      .join("");

    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), obs.unobserve(e.target))),
      { threshold: 0.1 }
    );
    grelha.querySelectorAll(".foto").forEach((el) => obs.observe(el));

    grelha.addEventListener("click", (ev) => {
      const fig = ev.target.closest(".foto");
      if (!fig) return;
      abrir(visiveis.indexOf(Number(fig.dataset.i)));
    });
  }

  // ---------- filtros ----------
  function filtros() {
    const caixa = document.getElementById("gallery-filtros");
    const categorias = ["All", ...new Set(fotos.map((f) => f.categoria).filter(Boolean))];
    caixa.innerHTML = categorias
      .map((c, i) => `<button type="button" class="chip${i === 0 ? " ativo" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");

    caixa.addEventListener("click", (ev) => {
      const botao = ev.target.closest(".chip");
      if (!botao) return;
      caixa.querySelectorAll(".chip").forEach((b) => b.classList.toggle("ativo", b === botao));
      aplicarFiltro(botao.dataset.cat);
    });
  }

  function aplicarFiltro(cat) {
    visiveis = [];
    grelha.querySelectorAll(".foto").forEach((fig) => {
      const mostra = cat === "All" || fig.dataset.cat === cat;
      fig.hidden = !mostra;
      if (mostra) {
        visiveis.push(Number(fig.dataset.i));
        fig.classList.add("in");
      }
    });
  }

  // ---------- lightbox ----------
  function criarLightbox() {
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Photo viewer");
    lightbox.innerHTML = `
      <div class="lightbox__fundo"></div>
      <button type="button" class="lightbox__fechar" aria-label="Close">&times;</button>
      <button type="button" class="lightbox__nav lightbox__nav--ant" aria-label="Previous photo">&#8249;</button>
      <button type="button" class="lightbox__nav lightbox__nav--seg" aria-label="Next photo">&#8250;</button>
      <figure class="lightbox__palco">
        <img alt="">
        <figcaption></figcaption>
      </figure>`;
    document.body.appendChild(lightbox);

    lightbox.querySelector(".lightbox__fundo").addEventListener("click", fechar);
    lightbox.querySelector(".lightbox__fechar").addEventListener("click", fechar);
    lightbox.querySelector(".lightbox__nav--ant").addEventListener("click", () => mover(-1));
    lightbox.querySelector(".lightbox__nav--seg").addEventListener("click", () => mover(1));

    // swipe em ecrãs tácteis
    let x0 = null;
    lightbox.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    lightbox.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
      x0 = null;
    });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") mover(1);
      else if (e.key === "ArrowLeft") mover(-1);
    });
  }

  function mostrar() {
    const f = fotos[visiveis[atual]];
    const img = lightbox.querySelector("img");
    img.classList.remove("in");
    img.onload = () => img.classList.add("in");
    img.src = url(f.src);
    img.alt = f.titulo;

    const meta = [f.categoria, f.local, f.camera].filter(Boolean).join(" · ");
    lightbox.querySelector("figcaption").innerHTML =
      `<b>${esc(f.titulo)}</b><span>${esc(meta)}</span><em>${atual + 1} / ${visiveis.length}</em>`;

    // pré-carrega a vizinha seguinte
    const prox = fotos[visiveis[(atual + 1) % visiveis.length]];
    new Image().src = url(prox.src);
  }

  function abrir(pos) {
    if (pos < 0) return;
    if (!lightbox) criarLightbox();
    ultimoFoco = document.activeElement;
    atual = pos;
    lightbox.hidden = false;
    document.body.classList.add("lightbox-aberto");
    mostrar();
    lightbox.querySelector(".lightbox__fechar").focus();
  }

  function fechar() {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-aberto");
    if (ultimoFoco) ultimoFoco.focus();
  }

  function mover(passo) {
    atual = (atual + passo + visiveis.length) % visiveis.length;
    mostrar();
  }

  // ---------- arranque ----------
  fetch(url("data/photos.json"))
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((dados) => {
      fotos = dados;
      visiveis = fotos.map((_, i) => i);
      desenhar();
      filtros();
    })
    .catch((erro) => {
      grelha.textContent = "Could not load the photos: " + erro.message;
    });
});
