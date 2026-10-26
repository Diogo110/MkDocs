document.addEventListener("DOMContentLoaded", () => {
  const titulos = document.querySelectorAll(".md-typeset h2");

  titulos.forEach((titulo) => {
    titulo.addEventListener("click", () => {
      titulo.classList.toggle("destacado");
    });
  });

  // Animação de entrada: os blocos com a classe "appear" aparecem quando entram no ecrã
  // (a página Music tem o seu próprio vigia, no spotify.js, por isso lá usa-se a classe "reveal")
  const appear = document.querySelectorAll(".appear");                 // todos os blocos que querem animar
  if (!("IntersectionObserver" in window)) {                           // browser muito antigo: mostra tudo logo
    appear.forEach((el) => el.classList.add("in"));
    return;
  }
  const observer = new IntersectionObserver(                           // o "vigia" que avisa quando algo fica visível
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;                                 // ainda não está visível: ignora
        e.target.classList.add("in");                                  // visível: o CSS faz a animação
        observer.unobserve(e.target);                                  // anima só uma vez
      }),
    { threshold: 0.12 }                                                // basta 12% do bloco visível
  );
  appear.forEach((el) => observer.observe(el));                        // começa a vigiar cada bloco
});