import { useEffect, useRef, useCallback } from "react";

import type { LayoutChange } from "@/types";

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
    // Poll until Babel transpiles and React renders, then set up drag
    (function() {
      let dragEl = null;
      let startX, startY, origX, origY;
      const changes = [];

      function getDesc(el) {
        // Try to identify by semantic tag, className hints, or role
        const tag = el.tagName.toLowerCase();
        // Get direct text (not deeply nested) for better identification
        let text = '';
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) text += el.childNodes[i].textContent;
        }
        if (!text.trim()) text = (el.textContent || '').trim();
        text = text.trim().slice(0, 60);
        // Extract className hints (first few tailwind-like classes)
        const cls = (el.className || '').toString().split(' ').slice(0, 5).join(' ');
        return { elementTag: tag, elementText: text, elementClasses: cls };
      }

      function getSiblings() {
        // Get ordered list of draggable siblings for position context
        const els = Array.from(document.querySelectorAll('[data-draggable]'));
        return els.map(function(el, i) {
          const desc = getDesc(el);
          const rect = el.getBoundingClientRect();
          return { index: i, tag: desc.elementTag, text: desc.elementText.slice(0, 40), y: Math.round(rect.top), x: Math.round(rect.left) };
        });
      }

      document.addEventListener('mousedown', function(e) {
        const el = e.target.closest('[data-draggable]');
        if (!el) return;
        dragEl = el;
        dragEl._siblingsBefore = getSiblings();
        var rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origX = rect.left;
        origY = rect.top;
        el._offsetX = parseFloat(el.style.left) || 0;
        el._offsetY = parseFloat(el.style.top) || 0;
        el.style.position = 'relative';
        el.style.zIndex = '9999';
        el.style.cursor = 'grabbing';
        e.preventDefault();
      });

      document.addEventListener('mousemove', function(e) {
        if (!dragEl) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        dragEl.style.left = (dragEl._offsetX + dx) + 'px';
        dragEl.style.top = (dragEl._offsetY + dy) + 'px';
      });

      document.addEventListener('mouseup', function(e) {
        if (!dragEl) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          var desc = getDesc(dragEl);
          var siblingsAfter = getSiblings();
          var change = {
            elementTag: desc.elementTag,
            elementText: desc.elementText,
            elementClasses: desc.elementClasses,
            deltaX: Math.round(dx),
            deltaY: Math.round(dy),
            direction: Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right'),
            siblingsBefore: dragEl._siblingsBefore,
            siblingsAfter: siblingsAfter,
            from: { x: Math.round(origX), y: Math.round(origY) },
            to: { x: Math.round(origX + dx), y: Math.round(origY + dy) }
          };
          changes.push(change);
          window.parent.postMessage({ type: 'layout-changes', changes: changes.slice() }, '*');
        }
        dragEl.style.cursor = 'grab';
        dragEl = null;
      });

      function markDraggable(el) {
        el.setAttribute('data-draggable', 'true');
        el.style.cursor = 'grab';
      }

      function setupDrag() {
        const root = document.getElementById('preview-root');
        if (!root || !root.firstElementChild) return false;
        const container = root.firstElementChild;

        // If root component is a single wrapper div, go one level deeper
        // to find the actual content sections
        let target = container;
        if (target.children.length === 1 && target.firstElementChild.children.length > 1) {
          target = target.firstElementChild;
        }

        // Mark each direct child as draggable
        if (target.children.length > 1) {
          Array.from(target.children).forEach(markDraggable);
        } else {
          // Fallback: mark semantic elements anywhere
          root.querySelectorAll('section, nav, header, footer, aside, article, form, main, div > div').forEach(function(el) {
            // Only mark if it has meaningful content
            if (el.children.length > 0 || (el.textContent || '').trim().length > 0) {
              markDraggable(el);
            }
          });
        }
        return document.querySelectorAll('[data-draggable]').length > 0;
      }

      // Poll every 200ms for up to 10s until content renders
      let attempts = 0;
      const poll = setInterval(function() {
        attempts++;
        if (setupDrag() || attempts > 50) {
          clearInterval(poll);
        }
      }, 200);
    })();
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
