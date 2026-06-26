# Deprecation Log

This file tracks deprecated features, legacy code removals, and data migrations in the FormBhar project.

---

## 1. Deprecated CSS-in-JS style injection & Javascript Dynamic Hover Animations
- **Deprecated in**: `v2.4.4`
- **Replaced by**: Encapsulated Shadow DOM `<style>` stylesheet.
- **Details**: Buttons previously relied on inline styles mutated dynamically by JavaScript `mouseenter` and `mouseleave` event listeners. This was deprecated to resolve input latency (INP) issues and eliminate visual glitches. The code was completely removed in v2.4.4.
- **Reference**: [ADR-002: UI Widgets Encapsulation inside Shadow DOM Host](decisions/ADR-002-shadow-dom-encapsulation.md)

---

## 2. Deprecated Tab-bound sessionStorage Cache
- **Deprecated in**: `v2.4.0`
- **Replaced by**: `chrome.storage.local` persistent cache.
- **Details**: Transient sessionStorage was used to preserve answers across pages, but it was lost on page refresh or tab duplication. sessionStorage was deprecated, and code was migrated to asynchronous `chrome.storage.local` mapped by form ID.
- **Reference**: [ADR-001: Switch from sessionStorage to persistent chrome.storage.local caching](decisions/ADR-001-storage-migration.md)

---

## 3. Deprecated Inline Script Context Extraction (CSP Violation)
- **Deprecated in**: `v2.4.2`
- **Replaced by**: Native DOM bracket depth scanning extraction.
- **Details**: To read the form structure, the extension previously injected an inline script to read `window.FB_PUBLIC_LOAD_DATA_`. This violated Content Security Policy (CSP) on Google Forms. The inline script approach was deprecated and disabled in v2.4.2. A fallback bracket depth scanner reads the raw text of the HTML document to pull the configuration securely.
