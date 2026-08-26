# Product improvement backlog

## Implemented in the lean cockpit redesign

- Task-oriented navigation with concise labels and collapsed, remembered Manage controls.
- A single attention-first Overview with exposed risks, stale evidence, design gaps, near deadlines, and historical snapshots behind progressive disclosure.
- Context-preserving Objective and Key Result side drawers plus an accessible command palette for navigation and common actions.
- Private personal momentum and a visible normalized team level board based on meaningful OKR behavior.
- Explicit, bounded activity events for actor-specific check-ins, resolved risks, and Deep Dive completion.
- Deterministic, readable Alignment cards with black text and explicit dependencies.
- Named Objective and Key Result Timeline rows with hover, keyboard focus, dates, and progress.
- Removal of the D3 and Frappe Gantt runtime dependencies.

## Now

- Protect the public n8n endpoint with an application-level token or authenticated proxy and restrict CORS to the production dashboard origin.
- Add Firebase App Check, email verification, password reset, rate limiting, and actionable authentication error messages.
- Add schema validation and HTML escaping at every Firestore/UI boundary; historical data should be migrated through the same validator.
- Upgrade Firebase and the CDN dependencies, pin every version, and add a Content Security Policy.

## Next

- Instrument privacy-safe task completion analytics before removing further views or controls.
- Extend command search to individual Objectives and Key Results without exposing private activity.
- Add a cycle setup wizard with OKR quality checks, baselines, target dates, and owner capacity review.
- Add weekly check-ins, comments, reminders, confidence explanations, and an immutable activity trail.
- Turn the dashboard into a decision surface: show deltas, stale updates, leading risks, missing owners, and recommended attention—not only totals.
- Add keyboard navigation, skip links, contrast testing, screen-reader labels for visualizations, and complete WCAG 2.2 AA verification.
- Add role-aware command/search navigation and saved filters.
- Add optimistic UI, Firestore offline states, retry controls, and conflict handling for concurrent edits.

## Later

- Add SSO and organization/workspace tenancy with centrally managed roles.
- Add portfolio rollups, cross-project dependencies, alignment scoring, and executive reporting exports.
- Add configurable OKR templates and guided retrospectives based on historical cycle performance.
- Add product analytics and privacy-safe usability telemetry to validate navigation and workflow improvements.
- Migrate the large renderer/controller files to typed components with a tested domain layer when product scope justifies a framework build pipeline.
