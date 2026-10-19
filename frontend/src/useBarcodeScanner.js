import { useEffect, useRef } from "react";

function isFormField(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = String(el.type || "text").toLowerCase();
    return !["button", "submit", "checkbox", "radio", "file", "hidden", "reset"].includes(type);
  }
  return false;
}

function isScanField(el) {
  return Boolean(el && el.classList && el.classList.contains("scan-input"));
}

export function useBarcodeScanner({ onScan, enabled = true }) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastAt = 0;
    let flushTimer = 0;
    let burst = false;

    const reset = () => {
      buffer = "";
      lastAt = 0;
      burst = false;
      if (flushTimer) {
        window.clearTimeout(flushTimer);
        flushTimer = 0;
      }
    };

    const commit = () => {
      const code = buffer.trim();
      reset();
      if (code.length >= 3) onScanRef.current(code);
    };

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      const now = Date.now();
      const rapid = lastAt > 0 && now - lastAt < 50;

      if (event.key === "Enter" || event.key === "Tab") {
        if (buffer.length >= 3 && (burst || rapid || isScanField(target))) {
          event.preventDefault();
          event.stopPropagation();
          commit();
        } else {
          reset();
        }
        return;
      }

      if (event.key.length !== 1) return;

      if (!rapid && isFormField(target) && !isScanField(target)) {
        reset();
        return;
      }

      if (!rapid) buffer = "";
      if (rapid) burst = true;
      lastAt = now;
      buffer += event.key;

      if (burst) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (flushTimer) window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => {
        if (buffer.length >= 3) commit();
        else reset();
      }, 70);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      reset();
    };
  }, [enabled]);
}
