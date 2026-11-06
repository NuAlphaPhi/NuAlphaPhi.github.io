/* Shared document for the portal’s static section entry points. */
(async function () {
  try {
    const response = await fetch("/portal-home.html", {cache:"no-cache"});
    if (!response.ok) throw Error("Portal unavailable");
    const html = await response.text();
    document.open(); document.write(html); document.close();
  } catch (error) {
    const box = document.querySelector("#portalRouteLoading > div");
    box.querySelector("p").textContent = "Couldn’t open the portal. Please try again.";
    const retry = document.createElement("button"); retry.textContent = "Try again";
    retry.onclick = () => location.reload(); box.append(retry);
  }
})();
