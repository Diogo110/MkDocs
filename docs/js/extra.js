document.addEventListener("DOMContentLoaded", () => {
  const titulos = document.querySelectorAll(".md-typeset h2");

  titulos.forEach((titulo) => {
    titulo.addEventListener("click", () => {
      titulo.classList.toggle("destacado");
    });
  });
});
