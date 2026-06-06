/* Orkestra Clipper — sélection visuelle de zone (type Alibaba Lens).
 *
 * Chargé par le bookmarklet : il injecte un overlay, laisse l'utilisateur tracer
 * un rectangle autour d'un produit, puis envoie vers Orkestra Lens l'IMAGE située
 * dans la zone (la plus grande image intersectant la sélection) + l'URL / le titre
 * / le texte proche de la page.
 *
 * Limite navigateur : un bookmarklet ne peut PAS capturer les pixels d'une zone
 * (canvas « taint » par les images cross-origin). On résout donc l'image produit
 * sous la sélection — ce que fait aussi Alibaba Lens en pratique. Pour une vraie
 * capture pixel de la zone, utiliser l'extension locale (/extension/orkestra-clipper).
 */
(function () {
  if (window.__orkestraClipper) return;
  window.__orkestraClipper = true;

  // Origine Orkestra = origine du script injecté.
  var BASE = "";
  try { BASE = new URL(document.currentScript.src).origin; } catch (e) { BASE = ""; }
  var V = "#6d5ef2"; // violet Orkestra

  var prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  // ── Overlay sombre ──
  var overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(15,17,28,.45);cursor:crosshair;backdrop-filter:saturate(.85);";
  // ── Rectangle de sélection ──
  var rect = document.createElement("div");
  rect.style.cssText = "position:fixed;display:none;border:2px solid " + V + ";border-radius:10px;box-shadow:0 0 0 9999px rgba(15,17,28,.45),0 8px 30px rgba(0,0,0,.25);background:transparent;z-index:2147483647;pointer-events:none;transition:opacity .1s;";
  // ── Toolbar flottante ──
  var bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:#fff;color:#15111c;box-shadow:0 10px 40px rgba(0,0,0,.25);font:500 14px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;";
  var dot = '<span style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#6d5ef2,#4f46b5);color:#fff;font-size:13px">◎</span>';
  bar.innerHTML = dot + '<span id="ork-msg">Sélectionnez le produit à rechercher</span>';

  var btnAnalyze = mkBtn("Analyser cette zone", true);
  var btnCancel = mkBtn("Annuler", false);
  btnAnalyze.style.display = "none";
  bar.appendChild(btnAnalyze); bar.appendChild(btnCancel);

  function mkBtn(label, primary) {
    var b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "border:0;cursor:pointer;border-radius:10px;padding:8px 12px;font:600 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;transition:filter .15s;" +
      (primary ? "background:" + V + ";color:#fff;" : "background:#f0eefe;color:#4f46b5;");
    b.onmouseenter = function () { b.style.filter = "brightness(.95)"; };
    b.onmouseleave = function () { b.style.filter = "none"; };
    return b;
  }

  document.body.appendChild(overlay);
  document.body.appendChild(rect);
  document.body.appendChild(bar);

  var sx = 0, sy = 0, drawing = false, has = false;

  overlay.addEventListener("mousedown", function (e) {
    drawing = true; has = false; sx = e.clientX; sy = e.clientY;
    rect.style.display = "block"; rect.style.opacity = "1";
    place(sx, sy, 0, 0);
    btnAnalyze.style.display = "none";
    setMsg("Glissez pour entourer le produit");
    e.preventDefault();
  });
  window.addEventListener("mousemove", function (e) {
    if (!drawing) return;
    var x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
    place(x, y, Math.abs(e.clientX - sx), Math.abs(e.clientY - sy));
  });
  window.addEventListener("mouseup", function (e) {
    if (!drawing) return; drawing = false;
    var w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
    if (w < 12 && h < 12) {
      // Simple clic → sélectionne l'image sous le curseur.
      place(e.clientX - 40, e.clientY - 40, 80, 80);
    }
    has = true;
    btnAnalyze.style.display = "block";
    setMsg("Ajustez si besoin, puis analysez");
  });

  function place(x, y, w, h) { rect.style.left = x + "px"; rect.style.top = y + "px"; rect.style.width = w + "px"; rect.style.height = h + "px"; }
  function setMsg(t) { var m = document.getElementById("ork-msg"); if (m) m.textContent = t; }
  function cleanup() {
    document.documentElement.style.overflow = prevOverflow;
    [overlay, rect, bar].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    window.__orkestraClipper = false;
  }

  // Meilleure image intersectant le rectangle (aire d'intersection max, taille mini).
  function bestImage() {
    var r = rect.getBoundingClientRect();
    var best = null, bestArea = 0;
    var imgs = document.images || [];
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var b = im.getBoundingClientRect();
      if (b.width < 32 || b.height < 32) continue;
      var ix = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
      var iy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
      var area = ix * iy;
      if (area > bestArea) { bestArea = area; best = im; }
    }
    if (best && bestArea > 0) return best.currentSrc || best.src || "";
    return "";
  }
  function ogImage() {
    var m = document.querySelector('meta[property="og:image"],meta[name="og:image"]');
    return m ? (m.getAttribute("content") || "") : "";
  }
  function nearText() {
    try {
      var r = rect.getBoundingClientRect();
      var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      var t = el ? (el.closest("[class],section,article,div") || el).innerText || "" : "";
      return t.replace(/\s+/g, " ").trim().slice(0, 300);
    } catch (e) { return ""; }
  }

  btnCancel.onclick = cleanup;
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") cleanup(); });

  btnAnalyze.onclick = function () {
    setMsg("Envoi vers Orkestra…");
    btnAnalyze.style.display = "none";
    var img = bestImage() || ogImage();
    var q = "/lens?via=clipper&productUrl=" + encodeURIComponent(location.href) + "&title=" + encodeURIComponent(document.title || "");
    if (img) {
      // Résout les URL relatives en absolu.
      try { img = new URL(img, location.href).href; } catch (e) {}
      q += "&imageUrl=" + encodeURIComponent(img);
    }
    var nt = nearText();
    if (nt) q += "&text=" + encodeURIComponent(nt);
    window.open((BASE || "") + q, "_blank");
    setTimeout(cleanup, 200);
  };
})();
