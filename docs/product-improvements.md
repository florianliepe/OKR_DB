# Product improvement backlog

## Implemented in the lean cockpit redesign

- Task-oriented navigation with concise labels and collapsed, remembered Manage controls.
- A single attention-first Overview with exposed risks, stale evidence, design gaps, near deadlines, and historical snapshots behind progressive disclosure.
- Context-preserving Objective and Key Result side drawers plus an accessible command palette for navigation and common actions.
- Private personal momentum and a visible normalized team level board based on meaningful OKR behavior.
- Explicit, bounded activity events for actor-specific check-ins, resolved risks, and Deep Dive completion.
- Private Weekly Focus, meaningful streak guidance, automatic team challenges, subtle celebrations, cycle milestones, guided retrospectives, and a team learning feed.
- Per-member in-app notification/summary preferences and privacy-safe aggregate engagement health.
- Objective/KR command search, a unified outcome detail drawer with learning notes, saved task views, consolidated filters, simplified cards, and decision-oriented Overview summaries.
- Deterministic, readable Alignment cards with black text and explicit dependencies.
- Named Objective and Key Result Timeline rows with hover, keyboard focus, dates, and progress.
- Removal of the D3 and Frappe Gantt runtime dependencies.

## Now

- Protect the public n8n endpoint with an application-level token or authenticated proxy and restrict CORS to the production dashboard origin.
- Add Firebase App Check, email verification, password reset, rate limiting, and actionable authentication error messages.
- Add schema validation and HTML escaping at every Firestore/UI boundary; historical data should be migrated through the same validator.
- Upgrade Firebase and the CDN dependencies, pin every version, and add a Content Security Policy.

## Next

- Instrument opt-in usability telemetry before removing further views or controls; current engagement health intentionally uses aggregate outcome activity only.
- Add a cycle setup wizard with OKR quality checks, baselines, target dates, and owner capacity review.
- Add reminder snoozing, confidence explanations, and conflict-safe immutable event persistence.
- Complete formal WCAG 2.2 AA verification with automated contrast checks and assistive-technology testing.
- Add optimistic UI, Firestore offline states, retry controls, and conflict handling for concurrent edits.

## Later

- Add SSO and organization/workspace tenancy with centrally managed roles.
- Add portfolio rollups, cross-project dependencies, alignment scoring, and executive reporting exports.
- Add configurable OKR templates and guided retrospectives based on historical cycle performance.
- Add product analytics and privacy-safe usability telemetry to validate navigation and workflow improvements.
- Migrate the large renderer/controller files to typed components with a tested domain layer when product scope justifies a framework build pipeline.
