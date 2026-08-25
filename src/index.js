import { OnifyProcessExtensions } from './OnifyProcessExtensions.js';
import { OnifyElementExtensions } from './OnifyElementExtensions.js';
import { OnifyBoundaryEventExtensions } from './OnifyBoundaryEventExtensions.js';
import { OnifySubProcessExtensions } from './OnifySubProcessExtensions.js';

export { OnifySequenceFlow } from './OnifySequenceFlow.js';
export { OnifyTimerEventDefinition } from './OnifyTimerEventDefinition.js';

/**
 * Onify flow extensions factory, pass to the engine as `extensions: { onify: extensions }`
 * @param {import('bpmn-elements').ElementBase} element
 * @param {import('bpmn-elements').ContextInstance} context
 * @returns {import('bpmn-elements').IExtension}
 */
export function extensions(element, context) {
  switch (element.type) {
    case 'bpmn:Process':
      return new OnifyProcessExtensions(element, context);
    case 'bpmn:AdHocSubProcess':
    case 'bpmn:SubProcess':
    case 'bpmn:Transaction':
      return new OnifySubProcessExtensions(element, context);
    case 'bpmn:BoundaryEvent':
      return new OnifyBoundaryEventExtensions(element, context);
    default:
      return new OnifyElementExtensions(element, context);
  }
}

/**
 * Extend function for moddle-context-serializer, registers scripts and timers at serialize time
 * @param {import('bpmn-moddle').BaseElement & Record<string, any>} behaviour
 * @param {import('moddle-context-serializer').ExtendContext} context
 */
export function extendFn(behaviour, context) {
  switch (behaviour.$type) {
    case 'bpmn:StartEvent': {
      if (!Array.isArray(behaviour.eventDefinitions)) break;

      const timer = behaviour.eventDefinitions.find((ed) => ed?.behaviour && ed.type === 'bpmn:TimerEventDefinition');
      if (timer && timer.behaviour.timeCycle) Object.assign(behaviour, { scheduledStart: timer.behaviour.timeCycle });

      break;
    }
    case 'bpmn:Process': {
      if (!behaviour.isExecutable) break;

      const { historyTimeToLive, isExecutable } = behaviour;

      if (historyTimeToLive && isExecutable) {
        context.addTimer(behaviour.id + ':historyTimeToLive', getHistoryTimeToLiveTimer(behaviour));
      }

      break;
    }
  }

  if (!Array.isArray(behaviour.extensionElements?.values)) return;

  let listener = 0;
  for (const extension of behaviour.extensionElements.values) {
    if (!extension) continue;
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

/**
 * @param {string} parentId
 * @param {import('bpmn-elements').ContextInstance} context
 * @param {string} type
 * @param {{ inputParameters?: any[], outputParameters?: any[], [x:string]: any }} ioBehaviour
 */
function registerIOScripts(parentId, context, type, ioBehaviour) {
  if (!ioBehaviour) return;

  const { inputParameters, outputParameters } = ioBehaviour;
  const parameters = [
    ...(Array.isArray(inputParameters) ? inputParameters : []),
    ...(Array.isArray(outputParameters) ? outputParameters : []),
  ];
  for (const parm of parameters) {
    const definition = parm?.definition;
    if (!definition) continue;
    if (definition.$type !== 'camunda:Script') continue;

    const ioType = `${type}/${parm.$type}`;
    const filename = `${parentId}/${ioType}/${parm.name}`;

    context.addScript(filename, {
      id: filename,
      scriptFormat: definition.scriptFormat,
      type: ioType,
      ...(definition.value && { body: definition.value }),
      ...(definition.resource && { resource: definition.resource }),
    });
  }
}

/**
 * @param {string} parentId script parent id
 * @param {import('bpmn-elements').ContextInstance} context
 * @param {string} type
 * @param {{event:string, script?: {scriptFormat:string, value?:string, resource?:string, [x:string]: any}, [x:string]: any}} listener
 * @param {Number} pos
 */
function registerListenerScript(parentId, context, type, listener, pos) {
  const { event, script } = listener;
  if (!script) return;

  const id = `${parentId}/${type}/${event}/${pos}`;
  context.addScript(id, {
    id,
    scriptFormat: script.scriptFormat,
    type,
    ...(script.value && { body: script.value }),
    ...(script.resource && { resource: script.resource }),
  });
}

/**
 * @param {{id:string, $type:string, historyTimeToLive?:string, [x:string]: any}} behaviour
 */
function getHistoryTimeToLiveTimer(behaviour) {
  const { id, $type: type, historyTimeToLive } = behaviour;

  let value = historyTimeToLive;
  let days;
  if (!isNaN((days = Number(value)))) {
    value = `P${days > 0 ? days : 0}D`;
  }
  return {
    id: `${type}/${id}:historyTimeToLive`,
    type: 'historyTimeToLive',
    timerType: 'timeDuration',
    value,
    parent: { id, type },
  };
}
