Changelog
=========

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
