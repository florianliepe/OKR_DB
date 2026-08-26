# Eraneos OKR Cockpit

A Firebase-backed dashboard for creating, aligning, tracking, and reviewing Objectives and Key Results. The interface follows the Eraneos design language and includes a context-aware OKR Coach powered by an n8n Chat Trigger.

## Run locally

The frontend is a static ES-module application and must be served over HTTP:

```bash
npx serve .
```

Open `http://localhost:3000`. Authentication and application data use the Firebase project configured in `js/firebase-config.js`.

## Quality checks

```bash
npm ci
npm run check
npm test
```

## Chat integration

The webhook URL and request timeout live in `js/config.js`. The frontend sends the n8n Chat Trigger fields `action`, `sessionId`, and `chatInput`, plus a bounded project context in `metadata.projectContext`.

Use [the OKR Coach system instruction](docs/okr-chatbot-system-instruction.md) in the n8n AI Agent. Ordinary Markdown responses render in the chat. Valid `okr_action` blocks become review buttons that prefill existing dashboard forms; they never save automatically.

The coach can run a skippable, 5–7 question circular interview and propose an OKR set specification for review. Accepted specifications appear in the **Deep Dive** view with operating context, systemic perspectives, assumptions, tensions, success signals, and inherited category/level/commitment classifications. Objective-level classifications can override the set defaults.

## Momentum and simplified views

The **Momentum** view derives a private personal level and a normalized team level board from meaningful behavior: evidence freshness, evidence depth, focused OKR design, risk follow-through, and Deep Dive context. It intentionally does not reward logins, raw activity volume, or permanently green confidence.

The cockpit uses concise task-oriented navigation. **Alignment** presents strategy, owners, Objectives, and dependencies as readable cards. **Timeline** presents persistently named Objective and Key Result rows with date ranges, progress, and coordinated hover/focus states.

**Overview** is the attention-first decision surface for risks, stale evidence, design gaps, and near deadlines; historical snapshots are available inline. Objective and Key Result editing stays in contextual side drawers, while Ctrl/Cmd+K opens the command palette. Momentum uses a bounded workspace activity trail to attribute check-ins, resolved risks, and Deep Dive completion more precisely without exposing individual competition.

**Weekly Focus** turns that activity into a private next-action queue, automatic team practice challenges, a Define → Align → Execute → Review → Learn cycle path, and a team learning feed. In-app notifications and summaries can be configured per member; no email is sent. Guided retrospectives earn private learning recognition, while owners see only aggregate engagement health. Objective and Key Result search opens a unified detail drawer with evidence, activity, and learning notes. Saved Objective views and consolidated filters keep the full hierarchy available without making it the default working surface.

## Architecture

- `js/app.js` — authentication-aware application controller and event coordination
- `js/ui.js` — view rendering and dashboard form preparation
- `js/firestore-store.js` — Firestore persistence and domain calculations
- `js/chat-service.js` — n8n transport, project-context shaping, and response parsing
- `js/chat-controller.js` — accessible chat interaction and rendering
- `js/okr-specification.js` — specification normalization and set-to-objective inheritance
- `js/gamification.js` — normalized private and team momentum calculations
- `js/engagement.js` — weekly focus, challenges, milestones, notifications, learning, and privacy-safe aggregate analytics
- `css/` — Eraneos design tokens and responsive component styling
- `tests/` — contract tests for the assistant integration

The production site is published from `main` through GitHub Pages.
