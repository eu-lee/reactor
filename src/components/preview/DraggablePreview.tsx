import { useEffect, useRef, useCallback } from "react";

interface LayoutChange {
  elementTag: string;
  elementText: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Props {
  code: string;
  onLayoutChange: (changes: LayoutChange[]) => void;
}

function buildPreviewHtml(code: string): string {
  // Detect the exported component name BEFORE stripping exports
  let componentName = "__Component__";

  // Match "export default function X" or "export default X"
  const exportFnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  const exportVarMatch = code.match(/export\s+default\s+(\w+)\s*;?\s*$/m);
  if (exportFnMatch) {
    componentName = exportFnMatch[1];
  } else if (exportVarMatch) {
    componentName = exportVarMatch[1];
  }

  // Strip imports and exports so it works in a plain script context
  const cleaned = code
    .replace(/^import\s+.*$/gm, "")
    .replace(/export\s+default\s+function\s+(\w+)/g, "function $1")
    .replace(/^export\s+default\s+\w+\s*;?\s*$/gm, "");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
    #preview-root { min-height: 100vh; }
    [data-draggable]:hover { outline: 2px dashed #8b5cf6; outline-offset: 2px; }
    [data-draggable] { transition: outline 0.15s; }
  </style>
</head>
<body>
  <div id="preview-root"></div>
  <script type="text/babel" data-type="module">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;

    ${cleaned}

    const root = ReactDOM.createRoot(document.getElementById('preview-root'));
    root.render(React.createElement(${componentName}));
  </script>
  <script>
    // Wait for Babel to transpile and render, then set up drag
    setTimeout(function() {
      let dragEl = null;
      let startX, startY, origX, origY;
      const changes = [];

      function getDesc(el) {
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().slice(0, 30);
        return { elementTag: tag, elementText: text };
      }

      document.addEventListener('mousedown', function(e) {
        const el = e.target.closest('[data-draggable]');
        if (!el) return;
        dragEl = el;
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origX = rect.left;
        origY = rect.top;
        el.style.position = 'relative';
        el.style.zIndex = '9999';
        el.style.cursor = 'grabbing';
        e.preventDefault();
      });

      document.addEventListener('mousemove', function(e) {
        if (!dragEl) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragEl.style.left = dx + 'px';
        dragEl.style.top = dy + 'px';
      });

      document.addEventListener('mouseup', function(e) {
        if (!dragEl) return;
        const rect = dragEl.getBoundingClientRect();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          const desc = getDesc(dragEl);
          const change = {
            ...desc,
            from: { x: Math.round(origX), y: Math.round(origY) },
            to: { x: Math.round(rect.left), y: Math.round(rect.top) }
          };
          changes.push(change);
          window.parent.postMessage({ type: 'layout-changes', changes: changes.slice() }, '*');
        }
        dragEl.style.cursor = '';
        dragEl = null;
      });

      // Mark elements as draggable
      const root = document.getElementById('preview-root');
      if (root) {
        const container = root.firstElementChild;
        if (container) {
          Array.from(container.children).forEach(function(child) {
            child.setAttribute('data-draggable', 'true');
            child.style.cursor = 'grab';
          });
        }
        root.querySelectorAll('section, nav, header, footer, aside, article, form, main').forEach(function(el) {
          el.setAttribute('data-draggable', 'true');
          el.style.cursor = 'grab';
        });
      }
    }, 1000);
  </script>
</body>
</html>`;
}

export default function DraggablePreview({ code, onLayoutChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type === "layout-changes") {
        onLayoutChange(e.data.changes);
      }
    },
    [onLayoutChange]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(buildPreviewHtml(code));
    doc.close();
  }, [code]);

  return (
    <iframe
      ref={iframeRef}
      title="Preview"
      className="h-full w-full rounded-lg border border-zinc-700 bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

export type { LayoutChange };
