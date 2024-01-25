import { FormatActivity, FormatProcess } from './formatters.js';
import { InputOutput } from './IO.js';
import Connector from './Connector.js';
import ExecutionListeners from './ExecutionListeners.js';
import IOForm from './IOForm.js';
import IOProperties from './IOProperties.js';
import ServiceExpression from './ServiceExpression.js';

export function getExtensions(element, context) {
  const result = {};

  switch (element.type) {
    case 'bpmn:SequenceFlow':
      break;
    case 'bpmn:Process':
      result.format = new FormatProcess(element);
      break;
    default:
      result.format = new FormatActivity(element);
  }

  let listenerPosition = 0;
  const listeners = new ExecutionListeners(element, context);

  const expression = element.behaviour.expression;
  if (expression) result.Service = ServiceExpression;

  const extensions = element.behaviour.extensionElements?.values;
  if (extensions) {
    for (const ext of extensions) {
      switch (ext.$type) {
        case 'camunda:Properties':
          if (ext.values?.length) result.properties = new IOProperties(element, ext);
          break;
        case 'camunda:InputOutput':
          result.io = new InputOutput(element.id, ext, context);
          break;
        case 'camunda:FormData':
          if (ext.fields?.length) result.form = new IOForm(element, ext);
          break;
        case 'camunda:Connector': {
          const { connectorId, inputOutput } = ext;
          const io = inputOutput && new InputOutput(`${element.id}/${ext.$type.toLowerCase()}`, inputOutput, context);
          result.Service = Connector.bind(Connector, connectorId, io);
          break;
        }
        case 'camunda:ExecutionListener':
          listeners.add(ext, listenerPosition++);
          break;
      }
    }
  }

  if (listeners.length) result.listeners = listeners;

  return result;
}
