# ADR-002: UI Widgets Encapsulation inside Shadow DOM Host

## Status
Accepted

## Date
2026-06-27

## Context
In early versions of the FormBhar extension, the custom action buttons ("Auto-Fill with AI", "Fill Profile Data", "Use ChatGPT") were injected directly into the main page's light DOM. Because Google Forms uses strict styling and its own dynamic stylesheets, this caused several visual bugs:
- Google Forms styles often overrode extension CSS, causing distorted buttons, incorrect fonts, or misplaced alignments.
- Injecting raw HTML buttons directly into the page ran the risk of style collision with Google Forms CSS selectors.
- Hover states and dynamic transitions had to be managed with heavy JavaScript event listeners (`mouseover`, `mouseleave`) mutating inline `.style.cssText` values, which became verbose and created input latency (INP degradation).

## Decision
Encapsulate all injected floating action overlay widgets inside an isolated Shadow DOM container. 
Attach a `#formbhar-shadow-host` element to the document body, host all custom overlay nodes inside its shadow root, and inject a single, clean static `<style>` stylesheet into the shadow root rather than mutating styles in JavaScript.

## Alternatives Considered

### Light DOM with Specific CSS Classes
- Pros: Simple to implement.
- Cons: Styles remain vulnerable to external Google Forms styles and page scripts. High chance of visual regressions when Google updates Forms UI.

### Iframe Overlay
- Pros: Complete CSS and JavaScript isolation.
- Cons: High layout overhead, difficult to handle transparency/dynamic height, and makes inter-frame message communication complex.

## Consequences
- Complete visual styling encapsulation. Custom CSS is completely shielded from Google Forms styles.
- Allows using vanilla CSS transitions and `:hover` selectors directly inside the shadow root stylesheet, eliminating all verbose JS style mutation code.
- Significantly improves Input Delay (INP) performance by eliminating JS event handlers for cosmetic micro-interactions.
