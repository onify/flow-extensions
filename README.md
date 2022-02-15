Onify Flow Extensions
=====================

[![Built latest](https://github.com/onify/flow-extensions/actions/workflows/build-latest.yaml/badge.svg)](https://github.com/onify/flow-extensions/actions/workflows/build-latest.yaml)

# Examples

Bpmn engine example:

```js
const {Engine} = require('bpmn-engine');
const {extensions, extendoFn} = require('@onify/flow-extensions');
const FlowScripts = require('@onify/flow-extensions/src/FlowScripts');

const source = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="task1" camunda:expression="\${environment.services.serviceFn}" camunda:resultVariable="result" />
  </process>
</definitions>`;

const name = 'onify flow';
const engine = new Engine({
  name,
  source,
  moddleOptions: {
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  },
  services: {
    serviceFn(scope, callback) {
      callback(null, {data: 1});
    }
  },
  extensions: {
    onify: extensions,
  },
  scripts: new FlowScripts(name, './script-resources', {
    myContextFn() {},
  }),
  extendFn: extendoFn,
});

engine.execute((err, instance) => {
  if (err) throw err;
  console.log(instance.name, instance.environment.output);
});
```
