# Goal-mode instruction — attention-first cockpit

## Objective

Reduce navigation and reporting overhead so users can identify the next useful OKR action, make the change without losing context, and understand why Momentum changed.

## Product rules

- Make Overview the single decision surface; show exceptions before aggregate reporting.
- Keep historical reconstruction available through progressive disclosure instead of a separate destination.
- Preserve the current view while editing Objectives and Key Results in contextual side drawers.
- Provide a keyboard-accessible command palette for destinations and frequent actions.
- Keep administration available but visually secondary, collapsed by default, and remember the user’s explicit preference.
- Attribute activity to the signed-in actor, retain at most 500 events per workspace, and never publish an individual leaderboard.
- Use activity events to improve attribution, not to reward raw volume.

## Experience rules

- Keep text and primary state readable without hover.
- Support keyboard navigation, focus visibility, reduced motion, and mobile layouts.
- Keep current-cycle decisions in the foreground and supporting metrics beneath them.
- Use plain, constructive language for risks, stale evidence, and design gaps.

## Acceptance criteria

1. Overview replaces Insights with an attention feed and a collapsible historical snapshot.
2. Objective and Key Result forms open as responsive side drawers.
3. Ctrl/Cmd+K opens a searchable command palette with keyboard traversal.
4. Manage navigation expands on demand, opens automatically for its active views, and remembers the user preference.
5. Check-ins, resolved risks, and Deep Dive completion persist as bounded actor-specific events and inform Momentum.
6. Automated checks, desktop QA, mobile QA, CI, and production deployment pass.
