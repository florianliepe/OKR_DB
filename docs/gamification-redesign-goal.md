# Goal-mode instruction — meaningful momentum

## Objective

Make the Eraneos OKR Cockpit easier to understand and rewarding to maintain without turning OKRs into a vanity-points system.

## Product rules

- Keep individual momentum private to the signed-in user.
- Make team momentum visible through a transparent, normalized level board.
- Reward meaningful behavior: current evidence, regular check-ins, focused OKR design, explicit risk follow-through, and contextual Deep Dives.
- Do not reward logins, raw activity volume, permanently green confidence, or target inflation.
- Explain every score and show the next constructive action.
- Use encouraging language; ranking is a prompt for learning, not performance evaluation.

## Experience rules

- Use short, familiar navigation labels and progressive disclosure.
- Put essential actions and current-cycle context first.
- Prefer readable HTML structures over decorative diagrams where labels compete for space.
- Make Alignment text black and legible at every supported viewport.
- Give every Timeline row a persistent Objective or Key Result name, with a coordinated hover state and an accessible description.
- Preserve keyboard navigation, reduced-motion support, and responsive layouts.

## Acceptance criteria

1. A Momentum view shows private progress, earned badges, score composition, next action, and the team level board.
2. The level board compares normalized behavior scores rather than raw counts or outcomes.
3. Alignment is deterministic, readable, and exposes dependencies without relying on hover.
4. Timeline includes named Objective and Key Result rows, date ranges, progress, and hover/focus highlighting.
5. The complete cockpit uses a leaner visual hierarchy and concise navigation.
6. Automated tests, desktop QA, mobile QA, CI, and deployment all pass.
