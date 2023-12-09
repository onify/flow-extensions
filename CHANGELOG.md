Changelog
=========

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
