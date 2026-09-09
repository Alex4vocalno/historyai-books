'use strict';

// UI-only state: drafts and request lifetimes never change the writing pipeline.
(function (root) {
  function createDrafts(storage, userId) {
    const memory = new Map();
    const key = project => `studioDraft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(project)}`;
    return {
      get(project) {
        if (memory.has(project)) return memory.get(project);
        try { return storage.getItem(key(project)) || ''; } catch { return ''; }
      },
      set(project, text) {
        memory.set(project, text);
        try {
          if (text) storage.setItem(key(project), text);
          else storage.removeItem(key(project));
        } catch { /* Keep this tab's draft when browser storage is unavailable. */ }
      },
    };
  }

  function createRequests() {
    let generation = 0;
    let controller = new AbortController();
    return {
      next() {
        controller.abort();
        controller = new AbortController();
        const current = ++generation;
        return { signal: controller.signal, current: () => current === generation };
      },
    };
  }

  async function readJson(url, { signal, timeoutMs = 12000, ...options } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }

  function composerHint(project, english = false) {
    if (project.publication && project.publication.published) {
      return english ? 'Ask about this book or discuss changes to its working draft…' : '查看已发布版本，或讨论这本书的后续修改…';
    }
    if (project.completion && (project.completion.finished || project.completion.everFinished)) {
      return english ? 'Ask about the completed manuscript, assessment or publishing…' : '讨论成品稿、作品评测或发布安排…';
    }
    return english ? 'Ask about this book, its progress or the next step…' : '问我这本书的进度、大纲、章节状态或下一步怎么走…';
  }

  function rightLimit(viewport, rail, separators) {
    return Math.max(300, Math.min(1120, viewport - rail - separators - 480));
  }

  function bindLayout(doc, win) {
    const rail = doc.getElementById('rail');
    const right = doc.getElementById('right');
    const width = id => doc.getElementById(id).getBoundingClientRect().width;
    const limit = () => rightLimit(win.innerWidth, width('rail'), width('leftbar') + width('dragbar'));
    const sync = () => {
      if (win.innerWidth < 1280) return;
      const max = limit();
      right.style.maxWidth = `${max}px`;
      if (parseFloat(right.style.width) > max) right.style.width = `${max}px`;
    };
    const observer = new ResizeObserver(sync);
    observer.observe(rail);
    win.addEventListener('resize', sync);
    sync();
    return limit;
  }

  function trustedPublicationMessage(event, frame, origin) {
    return Boolean(frame && event.origin === origin && event.source === frame.contentWindow
      && event.data && event.data.type === 'historyai-published'
      && event.data.projectId === frame.dataset.projectId);
  }

  function reconcileThreads(container, fragment) {
    const scrollTop = container.scrollTop;
    const focused = container.ownerDocument.activeElement;
    const existing = new Map(Array.from(container.children).filter(n => n.dataset.threadId).map(n => [n.dataset.threadId, n]));
    let cursor = container.firstChild;
    for (const next of Array.from(fragment.children)) {
      const node = existing.get(next.dataset.threadId) || next;
      if (node !== next) {
        node.className = next.className;
        node.title = next.title;
        node.onclick = next.onclick;
        node.onkeydown = next.onkeydown;
        if (node.innerHTML !== next.innerHTML) node.innerHTML = next.innerHTML;
      }
      if (node !== cursor) container.insertBefore(node, cursor);
      cursor = node.nextSibling;
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
    if (focused && focused.isConnected && container.contains(focused)) focused.focus({ preventScroll: true });
    container.scrollTop = scrollTop;
  }

  const api = { createDrafts, createRequests, readJson, composerHint, rightLimit, bindLayout, trustedPublicationMessage, reconcileThreads };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HAIStudioSession = api;
})(typeof window === 'undefined' ? globalThis : window);
