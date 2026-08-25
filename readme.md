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

## Architecture

- `js/app.js` — authentication-aware application controller and event coordination
- `js/ui.js` — view rendering and dashboard form preparation
- `js/firestore-store.js` — Firestore persistence and domain calculations
- `js/chat-service.js` — n8n transport, project-context shaping, and response parsing
- `js/chat-controller.js` — accessible chat interaction and rendering
- `js/okr-specification.js` — specification normalization and set-to-objective inheritance
- `css/` — Eraneos design tokens and responsive component styling
- `tests/` — contract tests for the assistant integration

The production site is published from `main` through GitHub Pages.
