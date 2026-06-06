/* Orkestra Clipper — service worker (MV3).
 * - Au clic sur l'icône : injecte l'outil de sélection (content.js) dans l'onglet.
 * - Sur demande : capture l'onglet visible (captureVisibleTab) pour le recadrage.
 * - Ouvre Orkestra Lens dans un nouvel onglet.
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
    // Pages restreintes (chrome://, Web Store, PDF…) : non injectables.
    console.warn("[OrkestraClipper] injection impossible:", e && e.message);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "ORK_CAPTURE") {
    const winId = sender.tab ? sender.tab.windowId : undefined;
    chrome.tabs.captureVisibleTab(winId, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl: chrome.runtime.lastError ? "" : dataUrl });
    });
    return true; // réponse asynchrone
  }
  if (msg && msg.type === "ORK_OPEN_LENS") {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return true;
  }
});
