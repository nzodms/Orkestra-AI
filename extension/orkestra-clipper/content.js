/* Orkestra Clipper — outil de sélection injecté au clic sur l'icône.
 * Trace un rectangle, capture l'onglet visible, RECADRE la zone (capture pixel
 * réelle), stocke le crop puis ouvre Orkestra Lens. La page Lens récupère le crop
 * via bridge.js (chrome.storage → window.postMessage).
 *
 * ⚠️ ÉDITEZ ORKESTRA_BASE avec l'URL de votre Orkestra (local ou Vercel).
 */
(function () {
  if (window.__orkestraClipper) return;
  window.__orkestraClipper = true;

  var ORKESTRA_BASE = "http://localhost:3000"; // ← à adapter (ex: https://votre-app.vercel.app)
  var V = "#6d5ef2";
  var prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  var overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(15,17,28,.45);cursor:crosshair;";
  var rect = document.createElement("div");
  rect.style.cssText = "position:fixed;display:none;border:2px solid " + V + ";border-radius:10px;box-shadow:0 0 0 9999px rgba(15,17,28,.45),0 8px 30px rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;";
  var bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:#fff;color:#15111c;box-shadow:0 10px 40px rgba(0,0,0,.25);font:500 14px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;";
  bar.innerHTML = '<span style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#6d5ef2,#4f46b5);color:#fff;font-size:13px">◎</span><span id="ork-msg">Sélectionnez le produit à rechercher</span>';
  var analyze = mkBtn("Analyser cette zone", true); analyze.style.display = "none";
  var cancel = mkBtn("Annuler", false);
  bar.appendChild(analyze); bar.appendChild(cancel);
  function mkBtn(label, primary) {
    var b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "border:0;cursor:pointer;border-radius:10px;padding:8px 12px;font:600 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;" + (primary ? "background:" + V + ";color:#fff;" : "background:#f0eefe;color:#4f46b5;");
    return b;
  }
  document.body.appendChild(overlay); document.body.appendChild(rect); document.body.appendChild(bar);

  var sx = 0, sy = 0, drawing = false;
  overlay.addEventListener("mousedown", function (e) { drawing = true; sx = e.clientX; sy = e.clientY; rect.style.display = "block"; place(sx, sy, 0, 0); analyze.style.display = "none"; setMsg("Glissez pour entourer le produit"); e.preventDefault(); });
  window.addEventListener("mousemove", function (e) { if (!drawing) return; place(Math.min(sx, e.clientX), Math.min(sy, e.clientY), Math.abs(e.clientX - sx), Math.abs(e.clientY - sy)); });
  window.addEventListener("mouseup", function (e) { if (!drawing) return; drawing = false; if (Math.abs(e.clientX - sx) < 12 && Math.abs(e.clientY - sy) < 12) place(e.clientX - 50, e.clientY - 50, 100, 100); analyze.style.display = "block"; setMsg("Ajustez si besoin, puis analysez"); });
  function place(x, y, w, h) { rect.style.left = x + "px"; rect.style.top = y + "px"; rect.style.width = w + "px"; rect.style.height = h + "px"; }
  function setMsg(t) { var m = document.getElementById("ork-msg"); if (m) m.textContent = t; }
  function cleanup() { document.documentElement.style.overflow = prevOverflow;[overlay, rect, bar].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); }); window.__orkestraClipper = false; }
  cancel.onclick = cleanup;
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") cleanup(); });

  analyze.onclick = function () {
    var r = rect.getBoundingClientRect();
    setMsg("Capture…"); analyze.style.display = "none";
    // On masque l'overlay AVANT la capture pour ne pas l'inclure dans l'image.
    overlay.style.display = "none"; rect.style.display = "none"; bar.style.opacity = "0";
    requestAnimationFrame(function () { setTimeout(function () {
      chrome.runtime.sendMessage({ type: "ORK_CAPTURE" }, function (resp) {
        var dataUrl = resp && resp.dataUrl;
        if (!dataUrl) { finishUrlOnly(); return; }
        cropAndSend(dataUrl, r);
      });
    }, 60); });
  };

  function cropAndSend(dataUrl, r) {
    var img = new Image();
    img.onload = function () {
      var dpr = window.devicePixelRatio || 1;
      var sxp = Math.max(0, r.left * dpr), syp = Math.max(0, r.top * dpr);
      var sw = Math.max(1, r.width * dpr), sh = Math.max(1, r.height * dpr);
      var c = document.createElement("canvas"); c.width = sw; c.height = sh;
      c.getContext("2d").drawImage(img, sxp, syp, sw, sh, 0, 0, sw, sh);
      var cropped;
      try { cropped = c.toDataURL("image/png"); } catch (e) { finishUrlOnly(); return; }
      chrome.storage.local.set({ orkestra_clip: { imageData: cropped, productUrl: location.href, title: document.title, ts: Date.now() } }, function () {
        chrome.runtime.sendMessage({ type: "ORK_OPEN_LENS", url: ORKESTRA_BASE + "/lens?clip=1" }, function () { cleanup(); });
      });
    };
    img.onerror = finishUrlOnly;
    img.src = dataUrl;
  }
  function finishUrlOnly() {
    // Repli : pas de capture → on envoie au moins l'URL de la page.
    var u = ORKESTRA_BASE + "/lens?via=clipper&productUrl=" + encodeURIComponent(location.href) + "&title=" + encodeURIComponent(document.title || "");
    chrome.runtime.sendMessage({ type: "ORK_OPEN_LENS", url: u }, function () { cleanup(); });
  }
})();
