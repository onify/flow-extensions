import {getExtensions} from './getExtensions.js';

export class OnifyElementExtensions {
  constructor(activity, context) {
    this.activity = activity;
    this.context = context;
    this.formatQ = activity.broker.getQueue('format-run-q');
    this._asyncFormatOnEnter = this._asyncFormatOnEnter.bind(this);

    const { Service } = this.extensions = getExtensions(activity, context);
    if (Service) {
      activity.behaviour.Service = Service;
    }
  }
  activate(message) {
    const activity = this.activity;
    const executionListeners = this.extensions.listeners;

    if (message.fields.redelivered && message.fields.routingKey === 'run.start') {
      activity.on('start', this._asyncFormatOnEnter, {consumerTag: '_onify-extension-on-enter'});
    } else {
      activity.on('enter', this._asyncFormatOnEnter, {consumerTag: '_onify-extension-on-enter'});
    }

    activity.on('activity.execution.completed', (elementApi) => {
      return this._onExecutionCompleted(elementApi);
    }, {consumerTag: '_onify-extension-on-executed'});

    if (executionListeners?.onStart) {
      activity.on('start', (elementApi) => {
        this._executeExecutionListener('start', elementApi);
      }, {consumerTag: '_onify-extension-on-listenerstart'});
    }

    if (executionListeners?.onEnd) {
      activity.on('end', (elementApi) => {
        this._executeExecutionListener('end', elementApi);
      }, {consumerTag: '_onify-extension-on-listenerend'});
    }
  }
  deactivate() {
    const broker = this.activity.broker;
    broker.cancel('_onify-extension-on-enter');
    broker.cancel('_onify-extension-on-executed');
    broker.cancel('_onify-extension-on-listenerstart');
    broker.cancel('_onify-extension-on-listenerend');
  }
  async _asyncFormatOnEnter(elementApi) {
    this.formatQ.queueMessage({routingKey: 'run.enter.format'}, {endRoutingKey: 'run.enter.complete'}, {persistent: false});

    try {
      var format = await this._onEnterAsync(elementApi);
    } catch (err) {
      return elementApi.broker.publish('format', 'run.enter.error', {error: err}, {persistent: false});
    }

    elementApi.broker.publish('format', 'run.enter.complete', format, {persistent: false});
  }
  async _onExecutionCompleted(elementApi) {
    this.formatQ.queueMessage({routingKey: 'run.end.format'}, { endRoutingKey: 'run.end.complete' }, { persistent: false });

    try {
      var format = await this._onExecuted(elementApi);
    } catch (err) {
      return elementApi.broker.publish('format', 'run.end.error', { error: err }, {persistent: false});
    }

    elementApi.broker.publish('format', 'run.end.complete', { ...format }, {persistent: false});
  }
  async _onEnterAsync(elementApi) {
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

    if (output !== undefined && output !== null) {
      if (assignToOutput && typeof output === 'object') {
        Object.assign(this.activity.environment.output, output);
      } else if (resultVariable) {
        elementApi.environment.output[resultVariable] = output;
      }
    }

    return result;
  }
  async _executeExecutionListener(eventName, elementApi) {
    const routingKey = 'run.listener.' + eventName;
    const endRoutingKey = routingKey + '.complete';

    this.formatQ.queueMessage({ routingKey }, { endRoutingKey }, { persistent: false });

    try {
      var format = await this.extensions.listeners.execute(eventName, elementApi);
    } catch (err) {
      return elementApi.broker.publish('format', routingKey + '.error', { error: err }, { persistent: false });
    }

    elementApi.broker.publish('format', endRoutingKey, { ...format }, { persistent: false });
  }
}
