# ADR-001: Switch from sessionStorage to persistent chrome.storage.local caching

## Status
Accepted

## Date
2026-06-27

## Context
In earlier versions of the FormBhar extension (prior to v2.4.0), active form states and generated AI answers were cached temporarily within `sessionStorage`. However, `sessionStorage` in Chrome Extensions has several major stability limitations:
- It is bound strictly to the tab lifecycle. If the user duplicates, restores, or reload-refreshes the tab mid-filling on a multi-page form, the session state is lost.
- Chrome Extension Service Workers cannot reliably read from tab-bound `sessionStorage` directly since they operate in an isolated background environment.
- Tab crashes or browser restarts completely wipe the session, forcing users to regenerate AI answers (consuming quota).

## Decision
Migrate all transient session structures and AI-generated answer caching to asynchronous `chrome.storage.local` persistent storage. 
Keys are mapped uniquely using the Google Form ID (extracted from the URL path `/forms/d/e/<formId>/viewform`) to prevent collision.

## Alternatives Considered

### chrome.storage.session
- Pros: Automatically cleared when the browser is closed.
- Cons: Wiped if the extension worker restarts or if tabs are closed. Does not survive browser crashes/reloads as reliably as `local`.

### IndexedDB / WebSQL
- Pros: High capacity storage.
- Cons: High implementation overhead and asynchronous complexity. Overkill for simple key-value answer mapping.

## Consequences
- Transient answers now survive reloads, page changes, duplicate tabs, and browser restarts.
- Auto-fill state runs seamlessly across multi-page forms.
- Solved context losses and quota wastage.
- Need to manually clear answer keys after form submission or session consumption to prevent storage bloat.
