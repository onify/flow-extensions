# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

`@onify/flow-extensions` — Onify's BPMN extensions layer for [`bpmn-engine`](https://github.com/paed01/bpmn-engine) / [`bpmn-elements`](https://github.com/paed01/bpmn-elements). It adds Camunda-flavoured behaviour (connectors, input/output mapping, execution listeners, form data, properties, timers, sequence-flow extensions) on top of the engine.

ESM source in `src/` is the published `import` entry; `dist/` is the Babel-compiled CommonJS `require` entry. The two public APIs are:

- `extensions(element, context)` — runtime extension factory passed to the engine as `extensions: { onify: extensions }`. Dispatches by `element.type` in `src/index.js`.
- `extendFn(behaviour, context)` — extend function for [`moddle-context-serializer`](https://github.com/paed01/moddle-context-serializer); registers scripts and timers at serialize time.

Also exported: `OnifySequenceFlow`, `OnifyTimerEventDefinition`. The `./FlowScripts` subpath exports a `FlowScripts` script provider (source lives at `test/helpers/FlowScripts.js`, compiled to `dist/FlowScripts.js`).

Peer project: [`@0dep/bpmn-extensions`](https://github.com/zerodep/bpmn-extensions) is the `zeebe:*`/FEEL counterpart, modeled on this project's architecture. Its AGENTS.md documents shared mechanisms (format queue, sub-process broker sharing, resume semantics) in more depth.

## Layout

- `src/` — extension source (ESM). `getExtensions.js` is the per-element extension assembler used by the `Onify*Extensions` classes; individual concerns live in `IO.js`, `Connector.js`, `ExecutionListeners.js`, `IOForm.js`, `IOProperties.js`, `ServiceExpression.js`, `formatters.js`, `Errors.js`.
- `test/features/` — BDD feature specs (mocha-cakes-2, `Feature`/`Scenario`/`Given`/`When`/`Then`). This is where most behaviour is tested.
- `test/src/` — unit-style tests for individual modules.
- `test/resources/` — `.bpmn` and `.fjs` fixtures.
- `test/helpers/` — `testHelpers.js` (e.g. `getOnifyFlow(source, options)`), `factory.js`, `setup.js`, `FlowScripts.js`.
- `dist/`, `types/` — generated; do not edit by hand.

## Commands

- `npm test` — run mocha. Has a `posttest` that runs lint + dist + texample, so a bare `npm test` does a lot.
- To iterate fast, run mocha directly: `npx mocha test/features/scripts-feature.js` or `npx mocha --grep "some scenario"`.
- `npm run lint` — `eslint . --cache` + `prettier . --check --cache`. Fix formatting with `npx prettier . --write`.
- `npm run dist` — Babel-compile `src/` and the FlowScripts helper into `dist/`.
- `npm run types` — generate `types/index.d.ts` from source JSDoc with dts-buddy, prettier-formatted (also part of `prepare`). The `.d.ts` is version controlled — regenerate and commit it when the public API changes; only the `.map` is gitignored.
- `npm run cov:html` — coverage report via c8.

## Conventions

- Node 20 (`.nvmrc`). Source is ESM (`"type": "module"`), `.js` files use `import`/`export`.
- Prettier: single quotes, 2-space tabs, `printWidth: 140`, `trailingComma: es5`. ESLint enforces `eqeqeq`, no `console`, `prefer-const`, semicolons, no shadowing — run lint before considering a change done.
- Tests use `chai` with the global `expect` (registered in `test/helpers/setup.js`); timezone is pinned to `Europe/Stockholm` and `NODE_ENV=test` there.
- Feature tests follow the Gherkin-style flow: build a BPMN source string, get a flow via `testHelpers.getOnifyFlow`, run it, assert on `flow.environment.output`.
- Types are generated from JSDoc with dts-buddy (`tsconfig.json` is its config), so the public API surface (`src/index.js` exports, `test/helpers/FlowScripts.js`) must carry JSDoc. JSDoc must reference real exported type names — the bpmn-elements element api is `import('bpmn-elements').IApi<any>` (there is no `ElementApi`). dts-buddy does not honour `@internal`: use `#private` members to keep internals out of the `.d.ts` on exported classes (see `OnifySequenceFlow`); default-exported classes leak as invalid `default` references in the `.d.ts`, so type such members via a typedef instead (see `OnifyExtensions` in `getExtensions.js`). Consumers need `skipLibCheck` — `bpmn-moddle`, reached via `moddle-context-serializer`, has type gaps.

## How it works (the non-obvious bits)

- **Format queue**: async work (enter/end formatting, io, execution listeners) is injected through the activity's `format-run-q` — `queueMessage` with an `endRoutingKey` (`run.enter.complete`/`run.end.complete`) makes the activity run wait until the work publishes that key. See `OnifyElementExtensions`.
- **Sub-processes share their broker with their children**, so child `activity.*` events bubble through them. Subscribing with `activity.on(...)` as a leaf does would fire handlers for every child and stall the sub-process. Hence `OnifySubProcessExtensions._setupListener` subscribes on the broker and filters `activity.id === message.content.id`.
- **Resume**: an activity stopped between start and execute re-activates with a redelivered `run.start` and must re-format — that is the `message.fields.redelivered` branch in the `activate()` methods.

## When changing behaviour

- New runtime extension element handling generally means a new/updated `Onify*Extensions` class and a case in `getExtensions.js`; new serialize-time script/timer registration goes in `extendFn` in `src/index.js`.
- **Forgiving, not validating.** This project executes flows; it does not validate them. Malformed or missing extension input (nullish entries, non-array parameter lists/eventDefinitions) is skipped, never thrown on — missing data just means the behaviour is skipped. Surface problems via the bpmn-elements logger (`activity.logger`/`elementApi.logger`) rather than failing. `test/src/defensive-loading-test.js` guards this.
- Formatting is opt-in per element: `Onify*Extensions` only subscribe to enter/end formatting when the element has formatting extensions (`_formatOnEnter`/`_formatOnEnd`). If you add a new behaviour attribute that should be formatted, also add it to `FormatActivity.hasFormatting` in `src/formatters.js` — otherwise elements with only that attribute silently skip formatting. `test/features/extensions-feature.js` asserts which elements publish on the format queue.
- Resuming from state saved by older major versions must keep working. When changing the run/format lifecycle, add a saved-state fixture (see `test/resources/v9-boundary-event-entered-state.json`) and a resume scenario for it.
- Compatibility matters: dev deps pin multiple engine/elements versions (`bpmn-engine`, `bpmn-engine-25`, `bpmn-engine-14`, `bpmn-elements-17`, `bpmn-elements-8-1`). `test/src/backward-compatibility-test.js` guards this — keep it green.
- After editing `src/`, the compiled `dist/` is regenerated by `npm run dist` (also part of `posttest`/`prepare`). Don't hand-edit `dist/`.
- Don't commit, push, or bump versions unless asked. Releases run through GitHub Actions (`.github/workflows/`).
