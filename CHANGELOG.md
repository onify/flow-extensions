# Changelog

# unreleased

# v9.1.1 - 2025-11-15

- provenance release

# 9.1.0

- add support for ad-hoc subprocess extensions

# 9.0.0

- replace cron parser `cron-parser` with `croner` as peer dependency

# 8.3.1

- move `@0dep/piso` to peer dependency

# 8.3.0

- fix `FlowScripts` type declaration
- throw `FlowResourceError` if failing to get script resource content

# 8.2.2

- bump [0dep/piso@2](https://www.npmjs.com/package/@0dep/piso)
- fix bug where environment was not passed when registering execution listener script, preventing bpmn-engine built-in scripts to execute

# 8.2.1

- bump [0dep/piso@1](https://www.npmjs.com/package/@0dep/piso)

# 8.2.0

- allow bpmn-elements@>=14 since bpmn-elements has moved beyond 14, and the tests still work

# 8.1.0

- process history time to live negative and zero days both result in time duration `P0D`

# 8.0.3

- add iso8601 to OnifyTimerEventDefinition supports list to avoid confusion
- fix extensions argument context type

# 8.0.2

- rearrange time cycle parsing to rethrow proper cron parsing error

# 8.0.1

- fix FlowScripts export

# 8.0.0

Stop execution if an invalid time duration, cycle, or date is encountered.

## Breaking

- invalid `TimerEventDefinition` timer type value stops execution if using [`bpmn-elements@14`](https://github.com/paed01/bpmn-elements/blob/master/CHANGELOG.md)
- remove `expireAt` formatting from events with TimerEventDefinion(s)
- `OnifySequenceFlow` resolve properties before _and_ after evaluating condition, hence properties can be addressed in condition

# 7.1.0

- add process attribute `historyTimeToLive` to process environment variables when running
- add process attribute `historyTimeToLive` as timer to definition context via `extendFn`, formatted as ISO8601 duration
- use prettier since eslint will deprecate formatting rules in the next major release

# 7.0.0

Attempting to mitigate Boundary Event formatting interrupting normal execution flow. Asynchronous formatting prevents catching events from attached task. Should probably be done in bpmn-elements but the developer is busy.

## Breaking

- No async formatting on boundary events before end
- Boundary event start execution listener will be executed but _without_ formatting capabilities and detached from execution. Occasional error will just be logged
- Boundary event end execution listener is still executed _with_ formatting capabilities

# 6.0.0

- Require peer dependency `bpmn-elements >= 8`
- Support timer event definition cron time cycle by overloading parse function. Requires `bpmn-elements >= 10`

# 5.0.2

- Correct package module file...

# 5.0.1

- Doh! Add neglected package.json file to common js dist folder

# 5.0.0

- Turn into module with exports for node
- Add type declaration

# 4.1.0

- Support sequence flow properties and take execution listener. Requires `bpmn-elements >= 9.2`

# 4.0.0

- make sure sub-process extensions are only triggered once. Sub process activities unintentionally trigger formatting since events bubble
- add script element type to registered scripts
- restructure and split up index.js to separate files
- abide to new lint rules

# 3.0.0

- Support activity script and expression execution listeners
- Remove default behaviour of saving activity output even if output is not declared. Output **was** saved to `environment.output._<Activity ID>` if no result variable or output was declared. The reason was that there was no easy way of getting output from SubProcess or a multi-instance task. Now SubProcess output can be defined and multi-instance output can be solved with execution listener

# 2.0.0

- fix resume extension when recovered mid formatting
- drop node 12 support

# 1.1.0

- allow ISO8601 repeating interval and duration in timeCycle

# 1.0.0

- proper routing keys for end formatting

# 0.1.0

- catch errors when resolving service expression
- test with bpmn-engine@14

# 0.0.2

- allow expressions in timeCycle
- test with bpmn-engine@13
- error message changed in node 16
