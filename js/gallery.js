document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("gallery");
  if (!grid) return;

  const filters = document.getElementById("gallery-filtros");
  const base = typeof __md_scope !== "undefined" ? __md_scope : new URL("../", location.href);
  const url = (path) => new URL(path, base).href;

  try {
    const response = await fetch(url("data/photos.json"));
    const photos = await response.json();

    for (const photo of photos) {
      const link = document.createElement("a");
      link.className = "photo";
      link.href = url(photo.src);
      link.target = "_blank";
      link.dataset.category = photo.categoria;

      const image = document.createElement("img");
      image.src = url(photo.src);
      image.alt = photo.titulo;
      image.loading = "lazy";

      const caption = document.createElement("span");
      caption.textContent = [photo.titulo, photo.local].filter(Boolean).join(", ");

      link.append(image, caption);
      grid.append(link);
    }

    const categories = ["All", ...new Set(photos.map((photo) => photo.categoria))];

    for (const category of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;

      button.addEventListener("click", () => {
        filters.querySelectorAll("button").forEach((other) => other.classList.toggle("active", other === button));
        grid.querySelectorAll(".photo").forEach((photo) => {
          photo.hidden = category !== "All" && photo.dataset.category !== category;
        });
      });

      filters.append(button);
    }

    filters.firstElementChild.classList.add("active");
  } catch (error) {
    grid.textContent = "Could not load the photos.";
  }
});
