# ADR-005: Adaptive Dual-Layer Memory Engine (Claude Code & OpenClaw Inspired)

## Status
Accepted

## Date
2026-09-08

## Context
FormBhar auto-fills complex web forms (such as Google Forms) by mapping user profiles and previously answered questions to form fields. However, single-tier profile auto-fill frequently struggles with:
1. **User Corrections**: When users manually edit filled inputs on forms, those edits were discarded once the page closed.
2. **One-Off Noise vs. Persistent Memory**: Immediately writing every user keystroke to persistent storage leads to noise polluting durable memory.
3. **Multi-Member/Team Disambiguation**: Forms asking for `Student 1 Name`, `Student 2 Name`, etc., often cause static profile match collisions.

To solve this, we looked at self-improvement patterns in modern agent architectures:
- **Claude Code Auto Memory / CLAUDE.md**: Dynamic auto-learning combined with explicit, user-editable project memory contracts.
- **OpenClaw**: Dual-layered memory with ephemeral daily logs, a "Dreaming Pass" pattern consolidation step, and heuristic confidence gates.

## Decision
We have designed and implemented an **Adaptive Dual-Layer Memory & Telemetry Engine** (`LearningEngine`) for FormBhar:

1. **Layer 1: Ephemeral Session Capture (`recordEphemeralCorrection`)**:
   - Listens to real-time DOM input `change` events on target forms.
   - Logs user edits to `ephemeral_session_log` without immediately altering durable storage.
2. **Layer 2: Pattern Consolidation / Dreaming Pass (`consolidateMemories`)**:
   - Groups ephemeral occurrences and calculates a confidence score ($1.0$ for explicit user edits, $0.8$ for 2+ identical occurrences).
   - Promotes entries meeting the confidence threshold ($\ge 0.8$) into `learned_mappings` (Durable Curated Memory).
3. **Interactive Editable Memory UI**:
   - FormBhar Popup Settings drawer renders all learned question-answer mappings.
   - Users can inline-edit question labels and values, delete outdated mappings, or manually add custom key-value pairs.
4. **AI Telemetry & Dynamic Fallback (`getHealthyProviderOrder`)**:
   - Measures end-to-end latency and success/failure counts for each configured AI provider (OpenAI, Gemini, Claude, Groq).
   - Dynamically reorders provider execution so healthy, fast endpoints are selected first during auto-fill.

## Consequences
- **User Trust**: Users maintain 100% control over learned memories via the Popup UI drawer.
- **Accuracy**: Ephemeral buffer prevents noise from polluting persistent storage while learning from genuine repeated usage or explicit corrections.
- **Resilience**: Dynamic provider health tracking ensures form completion even if a specific LLM API experiences downtime or high latency.
