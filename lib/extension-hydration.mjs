export const hydrationReadyEvent = "ayngaran:hydration-ready";

// Next owns its hidden metadata wrapper, so application JSX cannot put
// suppressHydrationWarning on it. Remove only this known extension attribute
// before React hydrates; never modify hidden, data-*, or application content.
export const metadataExtensionCleanup = `(() => {
  const selector = 'div[hidden][bis_skin_checked]';
  const cleaned = new WeakSet();
  const cleanElement = (element) => {
    if (!cleaned.has(element) && element.matches(selector)) {
      cleaned.add(element);
      element.removeAttribute('bis_skin_checked');
    }
  };
  const clean = (root) => {
    if (root.nodeType === 1) cleanElement(root);
    root.querySelectorAll?.(selector).forEach(cleanElement);
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') cleanElement(record.target);
      else record.addedNodes.forEach(clean);
    }
  });
  let timer;
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    window.removeEventListener('${hydrationReadyEvent}', stop);
  };
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['bis_skin_checked']
  });
  clean(document);
  window.addEventListener('${hydrationReadyEvent}', stop, { once: true });
  timer = window.setTimeout(stop, 10000);
})();`;
