(function () {
  "use strict";
  const P = P985;
  let map,
    layer,
    rows = [],
    filter = "";
  P.ready(() => {
    const root = P.root("globe");
    root.replaceChildren(
      P.header(
        "Where brothers are",
        "Approximate areas shared in 985. Locations disappear after seven days.",
      ),
    );
    const search = P.field("Find a brother or city", "search"),
      canvas = P.el("div", "p-map"),
      list = P.el("div", "p-map-people");
    search.input.placeholder = "Search a brother or city";
    const layout = P.el("div", "p-map-layout"),
      side = P.el("aside", "p-map-sidebar"),
      count = P.el("p", "p-map-count");
    canvas.id = "p985-world-map";
    canvas.setAttribute("aria-label", "Map of approximate brother locations");
    side.append(search.wrap, count, list);
    layout.append(canvas, side);
    root.append(
      layout,
      P.el(
        "p",
        "p-map-privacy",
        "Approximate areas only · Shared voluntarily · Updated in the 985 app · Expires after 7 days",
      ),
    );
    const controls = P.row(
      P.button("World view", () => {
        ensure();
        map?.setView([20, 0], 1);
      }),
      P.button("Fit brothers", () => {
        ensure();
        const points = rows
          .filter((r) => P985Policy.freshArea(r) && !P.blocks.has(r.id))
          .map((r) => [r.latitudeCell / 50, r.longitudeCell / 50]);
        if (points.length)
          map.fitBounds(points, { padding: [45, 45], maxZoom: 10 });
      }),
    );
    controls.classList.add("p-map-controls");
    canvas.append(controls);
    function draw() {
      list.replaceChildren();
      layer?.clearLayers();
      const fresh = rows.filter(
        (r) =>
          P985Policy.freshArea(r) &&
          !P.blocks.has(r.id) &&
          (r.label + " " + P.name(P.person(r.id)))
            .toLowerCase()
            .includes(filter.toLowerCase()),
      );
      const groups = new Map();
      for (const r of fresh) {
        const k = r.latitudeCell + "," + r.longitudeCell;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      count.textContent =
        fresh.length +
        (fresh.length === 1 ? " brother" : " brothers") +
        " · " +
        groups.size +
        (groups.size === 1 ? " area" : " areas");
      for (const group of groups.values()) {
        const r = group[0],
          card = P.el("div", "p-map-area");
        card.append(P.el("h3", "", r.label));
        group.forEach((b) =>
          card.append(
            P.author(b.id),
            P.el("small", "", "Updated " + P.when(b.updatedAt)),
          ),
        );
        card.append(
          P.button("Show area", () => {
            ensure();
            map.setView([r.latitudeCell / 50, r.longitudeCell / 50], 11);
          }),
        );
        list.append(card);
        if (layer) {
          const popup = P.el("div", "p985");
          popup.append(P.el("strong", "", r.label));
          group.forEach((b) =>
            popup.append(
              P.button(P.name(P.person(b.id)), () => P.profile(b.id)),
            ),
          );
          L.circleMarker([r.latitudeCell / 50, r.longitudeCell / 50], {
            radius: Math.min(18, 7 + group.length * 2),
            color: "#fff",
            weight: 2,
            fillColor: "#a92251",
            fillOpacity: 0.95,
          })
            .bindPopup(popup)
            .addTo(layer);
        }
      }
      if (!fresh.length)
        list.append(P.empty("No recently shared locations match."));
    }
    function ensure() {
      if (map) return;
      if (!window.L) {
        P.error(
          root,
          Error(
            "The map could not load. You can still browse shared areas below.",
          ),
        );
        return;
      }
      map = L.map(canvas, {
        worldCopyJump: true,
        attributionControl: false,
        minZoom: 1,
        maxZoom: 13,
      }).setView([20, 0], 1);
      const credit = P.el("div", "p-map-credit");
      const creditLink = P.el("a", "", "© OpenStreetMap contributors");
      creditLink.href = "https://www.openstreetmap.org/copyright";
      creditLink.target = "_blank";
      creditLink.rel = "noopener";
      credit.append(creditLink);
      const info = P.button(
        "i",
        () => {
          credit.hidden = !credit.hidden;
        },
        "p-map-info",
      );
      info.setAttribute("aria-label", "Map data information");
      canvas.append(credit, info);
      L.DomEvent.disableClickPropagation(info);
      L.DomEvent.disableClickPropagation(credit);
      setTimeout(() => {
        credit.hidden = true;
      }, 5000);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 13,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      draw();
    }
    search.input.oninput = () => {
      filter = search.input.value;
      draw();
    };
    P.watch(
      db.collection("brotherLocations"),
      (data) => {
        rows = data;
        draw();
      },
      root,
    );
    document.addEventListener("nap:tab-changed", (e) => {
      if (e.detail.tab === "globe") {
        ensure();
        setTimeout(() => map?.invalidateSize(), 100);
        draw();
      }
    });
    document.addEventListener("p985:people", draw);
    document.addEventListener("p985:blocks", draw);
    setInterval(draw, 60000);
    if (window.napCurrentTab === "globe") ensure();
  });
})();
