/* Orkestra Clipper — pont vers la page Lens.
 * Sur une page /lens, récupère le crop stocké par content.js et le transmet à la
 * page React via window.postMessage (la page écoute { source: "orkestra-clipper" }).
 */
(function () {
  try {
    if (!location.pathname.startsWith("/lens")) return;
    chrome.storage.local.get("orkestra_clip", function (res) {
      var clip = res && res.orkestra_clip;
      if (!clip || !clip.imageData) return;
      if (Date.now() - (clip.ts || 0) > 60000) { chrome.storage.local.remove("orkestra_clip"); return; }
      var payload = { source: "orkestra-clipper", imageData: clip.imageData, productUrl: clip.productUrl, title: clip.title };
      // Re-poste quelques fois : la page React peut ne pas encore écouter au tout début.
      var tries = 0;
      window.postMessage(payload, location.origin);
      var iv = setInterval(function () {
        tries++;
        window.postMessage(payload, location.origin);
        if (tries >= 4) { clearInterval(iv); chrome.storage.local.remove("orkestra_clip"); }
      }, 500);
    });
  } catch (e) { /* extension non disponible */ }
})();
