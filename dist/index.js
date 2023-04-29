"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "OnifySequenceFlow", {
  enumerable: true,
  get: function () {
    return _OnifySequenceFlow.OnifySequenceFlow;
  }
});
exports.extendFn = extendFn;
exports.extensions = extensions;
var _OnifyProcessExtensions = require("./src/OnifyProcessExtensions.js");
var _OnifyElementExtensions = require("./src/OnifyElementExtensions.js");
var _OnifySequenceFlow = require("./src/OnifySequenceFlow.js");
function extensions(element, context) {
  if (element.type === 'bpmn:Process') return new _OnifyProcessExtensions.OnifyProcessExtensions(element, context);
  return new _OnifyElementExtensions.OnifyElementExtensions(element, context);
}
function extendFn(behaviour, context) {
  var _behaviour$extensionE;
  if (behaviour.$type === 'bpmn:StartEvent' && behaviour.eventDefinitions) {
    const timer = behaviour.eventDefinitions.find(({
      type,
      behaviour: edBehaviour
    }) => edBehaviour && type === 'bpmn:TimerEventDefinition');
    if (timer && timer.behaviour.timeCycle) Object.assign(behaviour, {
      scheduledStart: timer.behaviour.timeCycle
    });
  }
  if (!Array.isArray((_behaviour$extensionE = behaviour.extensionElements) === null || _behaviour$extensionE === void 0 ? void 0 : _behaviour$extensionE.values)) return;
  let listener = 0;
  for (const extension of behaviour.extensionElements.values) {
    switch (extension.$type) {
      case 'camunda:InputOutput':
        registerIOScripts(behaviour.id, context, extension.$type, extension);
        break;
      case 'camunda:Connector':
        registerIOScripts(behaviour.id, context, extension.$type, extension.inputOutput);
        break;
      case 'camunda:ExecutionListener':
        registerListenerScript(behaviour.id, context, extension.$type, extension, listener++);
        break;
    }
  }
}
function registerIOScripts(parentId, context, type, ioBehaviour) {
  if (!ioBehaviour) return;
  const {
    inputParameters = [],
    outputParameters = []
  } = ioBehaviour;
  for (const {
    $type,
    name,
    definition
  } of inputParameters.concat(outputParameters)) {
    if (!definition) continue;
    if (definition.$type !== 'camunda:Script') continue;
    const ioType = `${type}/${$type}`;
    const filename = `${parentId}/${ioType}/${name}`;
    context.addScript(filename, {
      id: filename,
      scriptFormat: definition.scriptFormat,
      type: ioType,
      ...(definition.value && {
        body: definition.value
      }),
      ...(definition.resource && {
        resource: definition.resource
      })
    });
  }
}
function registerListenerScript(parentId, context, type, listener, pos) {
  const {
    event,
    script
  } = listener;
  if (!script) return;
  const id = `${parentId}/${type}/${event}/${pos}`;
  context.addScript(id, {
    id,
    scriptFormat: script.scriptFormat,
    type,
    ...(script.value && {
      body: script.value
    }),
    ...(script.resource && {
      resource: script.resource
    })
  });
}