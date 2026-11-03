document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("music-intro")) return;

  document.querySelectorAll(".md-typeset h2").forEach((title) => {
    title.addEventListener("click", () => title.classList.toggle("destacado"));
  });
});
