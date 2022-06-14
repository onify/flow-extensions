import cronParser from 'cron-parser';
import IOProperties from './src/IOProperties';
import IOForm from './src/IOForm';
import Connector from './src/Connector';
import ServiceExpression from './src/ServiceExpression';
import {InputOutput} from './src/IO';

class FormatError extends Error {
  constructor(elementId, err) {
    super(`<${elementId}> ${err.message}`);
    this.code = 'EFLOW_FORMAT';
    this.output = {statusCode: 500};
  }
}

export {
  extensions,
  extendFn,
};

function extensions(element, context) {
  if (element.type === 'bpmn:Process') return new OnifyProcessExtensions(element, context);
  return new OnifyElementExtensions(element, context);
}

class OnifyProcessExtensions {
  constructor(bp, context) {
    this.process = bp;
    this.context = context;
    this.extensions = getExtensions(bp, context);
    this._activate();
  }
  _activate() {
    const bp = this.process;
    bp.on('process.enter', (elementApi) => {
      try {
        const result = this._onEnter(elementApi);
        const environment = elementApi.environment;
        environment.assignVariables(result);
      } catch (err) {
        elementApi.broker.publish('event', 'process.error', {
          ...elementApi.content,
          error: new FormatError(bp.id, err)
        }, {mandatory: true, type: 'error'});
      }
    }, {consumerTag: '_onify-extension-on-enter'});
  }
  _onEnter(elementApi) {
    const {format, properties} = this.extensions;
    const result = {};

    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);

    if (properties) {
      Object.assign(result, properties.resolve(elementApi));
      Object.assign(elementApi.content, result);
    }

    return result;
  }
}

class OnifyElementExtensions {
  constructor(activity, context) {
    this.activity = activity;
    this.context = context;
    const {Service} = this.extensions = getExtensions(activity, context);
    if (Service) {
      activity.behaviour.Service = Service;
    }
  }
  activate() {
    const activity = this.activity;
    const broker = activity.broker;
    const formatQ = activity.broker.getQueue('format-run-q');

    activity.on('enter', async (elementApi) => {
      formatQ.queueMessage({routingKey: 'run.enter.format'}, {endRoutingKey: 'run.enter.complete'}, {persistent: false});

      try {
        var format = await this._onEnter(elementApi);
      } catch (err) {
        return broker.publish('format', 'run.enter.error', {error: err}, {persistent: false});
      }

      broker.publish('format', 'run.enter.complete', format, {persistent: false});
    }, {consumerTag: '_onify-extension-on-enter'});

    activity.on('activity.execution.completed', async (elementApi) => {
      if (elementApi.fields.redelivered) return;

      formatQ.queueMessage({routingKey: 'run.end.format'}, {endRoutingKey: 'run.end.complete'}, {persistent: false});

      try {
        var format = await this._onExecuted(elementApi);
      } catch (err) {
        return broker.publish('format', 'run.end.error', {error: err}, {persistent: false});
      }

      broker.publish('format', 'run.end.complete', {...format}, {persistent: false});
    }, {consumerTag: '_onify-extension-on-executed'});
  }
  deactivate() {
    const broker = this.activity.broker;
    broker.cancel('_onify-extension-on-enter');
    broker.cancel('_onify-extension-on-executed');
  }
  async _onEnter(elementApi) {
    const {format, properties, io, form} = this.extensions;

    const result = {};
    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);

    if (properties) {
      Object.assign(result, {properties: properties.resolve(elementApi)});
      Object.assign(elementApi.content, result);
    }

    if (io) {
      if (io.input?.length) {
        const input = await io.getInput(this.activity, elementApi);
        Object.assign(result, {input});
        Object.assign(elementApi.content, result);
      }
      if (io.output?.length) {
        result.assignToOutput = true;
      }
    }

    if (form) {
      Object.assign(result, {form: form.resolve(elementApi)});
    }

    return result;
  }
  async _onExecuted(elementApi) {
    const {properties, io} = this.extensions;

    const result = {};
    if (io?.output.length) {
      const output = await io.getOutput(this.activity, elementApi);
      Object.assign(result, {output});
      Object.assign(elementApi.content, {output});
    }

    if (properties) {
      const props = properties.resolve(elementApi);
      Object.assign(result, {properties: props});
      Object.assign(elementApi.content, {properties: props});
    }

    const {output, assignToOutput, resultVariable} = elementApi.content;

    if (output === undefined || output === null) return result;

    if (assignToOutput && typeof output === 'object') {
      Object.assign(this.activity.environment.output, output);
    } else if (resultVariable) {
      elementApi.environment.output[resultVariable] = output;
    }

    return result;
  }
}

function getExtensions(element, context) {
  const result = {
    format: element.type === 'bpmn:Process' ? new FormatProcess(element) : new FormatActivity(element),
  };

  const expression = element.behaviour.expression;
  if (expression) result.Service = ServiceExpression;

  const extensions = element.behaviour.extensionElements?.values;
  if (!extensions) return result;


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
        const {connectorId, inputOutput} = ext;
        const io = inputOutput && new InputOutput(`${element.id}/${ext.$type.toLowerCase()}`, inputOutput, context);
        result.Service = Connector.bind(Connector, connectorId, io);
        break;
      }
    }
  }

  return result;
}

class FormatActivity {
  constructor(activity) {
    this.activity = activity;
    this.resultVariable = activity.behaviour.resultVariable || '_' + activity.id;

    let timeCycles;
    if (activity.eventDefinitions) {
      for (const ed of activity.eventDefinitions.filter((e) => e.type === 'bpmn:TimerEventDefinition')) {
        if (!('timeCycle' in ed)) continue;
        timeCycles = timeCycles || [];
        timeCycles.push(ed.timeCycle);
      }
    }
    this.timeCycles = timeCycles;
  }
  resolve(elementApi) {
    let user, groups, assigneeValue, description;
    const activity = this.activity;
    const {
      documentation,
      candidateUsers,
      candidateGroups,
      scheduledStart,
      assignee,
    } = activity.behaviour;

    if (candidateUsers) user = resolveAndSplit(elementApi, candidateUsers);
    if (candidateGroups) groups = resolveAndSplit(elementApi, candidateGroups);
    if (assignee) assigneeValue = elementApi.resolveExpression(assignee);
    if (documentation) description = documentation[0]?.text;

    let expireAt;
    let timeCycles = this.timeCycles;
    if (timeCycles) {
      for (const cycle of timeCycles) {
        const cron = elementApi.resolveExpression(cycle);
        if (!cron) continue;
        const expireAtDt = cronParser.parseExpression(cron).next().toDate();
        if (!expireAt || expireAtDt < expireAt) expireAt = expireAtDt;
      }
    }

    return {
      resultVariable: this.resultVariable,
      ...(scheduledStart && activity.parent.type === 'bpmn:Process' ? {scheduledStart} : undefined),
      ...(user?.length && {candidateUsers: user}),
      ...(groups?.length && {candidateGroups: groups}),
      ...(!elementApi.content.description && description && {description: elementApi.resolveExpression(description)}),
      ...(expireAt && {expireAt}),
      ...(assigneeValue && {assignee: assigneeValue}),
    };
  }
}

class FormatProcess {
  constructor(bp) {
    this.process = bp;
  }
  resolve(elementApi) {
    let user, groups, description;
    const bp = this.process;
    const {
      documentation,
      candidateStarterUsers,
      candidateStarterGroups,
    } = bp.behaviour;


    if (candidateStarterUsers) user = resolveAndSplit(elementApi, candidateStarterUsers);
    if (candidateStarterGroups) groups = resolveAndSplit(elementApi, candidateStarterGroups);
    if (documentation) description = documentation[0]?.text;

    return {
      resultVariable: this.resultVariable,
      ...(user?.length && {candidateStarterUsers: user}),
      ...(groups?.length && {candidateStarterGroups: groups}),
      ...(!elementApi.content.description && description && {description: elementApi.resolveExpression(description)}),
    };
  }
}

function resolveAndSplit(elementApi, str) {
  if (Array.isArray(str)) return str.filter(Boolean);
  if (typeof str !== 'string') return;

  const resolved = elementApi.resolveExpression(str);
  if (Array.isArray(resolved)) return resolved.filter(Boolean);
  if (typeof resolved !== 'string') return;

  return resolved
    .split(',')
    .map((g) => g.trim && g.trim().toLowerCase())
    .filter(Boolean);
}

function extendFn(behaviour, context) {
  if (behaviour.$type === 'bpmn:StartEvent' && behaviour.eventDefinitions) {
    const timer = behaviour.eventDefinitions.find(({type, behaviour: edBehaviour}) => edBehaviour && type === 'bpmn:TimerEventDefinition');
    if (timer && timer.behaviour.timeCycle) Object.assign(behaviour, {scheduledStart: timer.behaviour.timeCycle});
  }

  if (!Array.isArray(behaviour.extensionElements?.values)) return;

  const inputOutput = behaviour.extensionElements.values.find((el) => el.$type === 'camunda:InputOutput');
  const connector = behaviour.extensionElements.values.find((el) => el.$type === 'camunda:Connector');

  if (inputOutput) registerIOScripts(behaviour.id, context, inputOutput.$type, inputOutput);
  if (connector) registerIOScripts(behaviour.id, context, connector.$type, connector.inputOutput);
}

function registerIOScripts(parentId, context, type, ioBehaviour) {
  if (!ioBehaviour) return;

  const {inputParameters = [], outputParameters = []} = ioBehaviour;
  for (const {$type, name, definition} of inputParameters.concat(outputParameters)) {
    if (!definition) continue;
    if (definition.$type !== 'camunda:Script') continue;

    const filename = `${parentId}/${type}/${$type}/${name}`;

    context.addScript(filename, {
      id: filename,
      scriptFormat: definition.scriptFormat,
      ...(definition.value ? {body: definition.value}: undefined),
      ...(definition.resource ? {resource: definition.resource}: undefined),
    });
  }
}
