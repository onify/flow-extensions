Onify Flow Extensions
=====================

[![Built latest](https://github.com/onify/flow-extensions/actions/workflows/build-latest.yaml/badge.svg)](https://github.com/onify/flow-extensions/actions/workflows/build-latest.yaml)

# Api

- `extensions`: Flow extensions
- `extendFn`: extend function to pass to [serializer](https://github.com/paed01/moddle-context-serializer/blob/master/API.md)

# Examples

## Bpmn engine example

```js
const {Engine} = require('bpmn-engine');
const {extensions} = require('@onify/flow-extensions');
const FlowScripts = require('@onify/flow-extensions/dist/src/FlowScripts');

const source = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="task1" camunda:expression="\${environment.services.serviceFn}" camunda:resultVariable="result" />
    <sequenceFlow id="to-task2" sourceRef="task1" targetRef="task2" />
    <scriptTask id="task2" camunda:resultVariable="out">
      <script>
        next(null, myContextFn());
      </script>
    </scriptTask>
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
    myContextFn() {
      return 2;
    },
  }),
});

engine.execute((err, instance) => {
  if (err) throw err;
  console.log(instance.name, instance.environment.output);
});
```

## Extract scripts with extend function

```js
const {extendFn} = require('@onify/flow-extensions');

const BpmnModdle = require('bpmn-moddle');
const Elements = require('bpmn-elements');
const {default: Serializer, TypeResolver} = require('moddle-context-serializer');

const source = `
<definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="process-1" name="Onify Flow" isExecutable="true">
    <serviceTask id="task1">
      <extensionElements>
        <camunda:connector>
          <camunda:connectorId>onifyApiRequest</camunda:connectorId>
          <camunda:inputOutput>
            <camunda:inputParameter name="method">GET</camunda:inputParameter>
            <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
            <camunda:outputParameter name="result">
              <camunda:script scriptFormat="js">
                next(null, {
                  id: content.id,
                  statuscode,
                });
              </camunda:script>
            </camunda:outputParameter>
          </camunda:inputOutput>
        </camunda:connector>
        <camunda:inputOutput>
          <camunda:outputParameter name="result">\${content.output.result.statuscode}</camunda:outputParameter>
        </camunda:inputOutput>
      </extensionElements>
    </serviceTask>
    <sequenceFlow id="to-task2" sourceRef="task1" targetRef="task2" />
    <scriptTask id="task2" camunda:resultVariable="out">
      <script>
        next(null, 2);
      </script>
    </scriptTask>
  </process>
</definitions>`;

(async () => {
  const moddle = await getModdleContext(source, {
    camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
  });

  const serialized = Serializer(moddle, TypeResolver(Elements), extendFn);
  console.log(serialized.elements.scripts);
})();

function getModdleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim());
}
```
