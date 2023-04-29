"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OnifyElementExtensions = void 0;
var _getExtensions = require("./getExtensions.js");
class OnifyElementExtensions {
  constructor(activity, context) {
    this.activity = activity;
    this.context = context;
    const {
      Service
    } = this.extensions = (0, _getExtensions.getExtensions)(activity, context);
    if (Service) {
      activity.behaviour.Service = Service;
    }
  }
  activate(message) {
    const activity = this.activity;
    const broker = activity.broker;
    const formatQ = activity.broker.getQueue('format-run-q');
    const executionListeners = this.extensions.listeners;
    if (message.fields.redelivered && message.fields.routingKey === 'run.start') {
      activity.on('start', elementApi => {
        this._formatOnEnter(broker, formatQ, elementApi);
      }, {
        consumerTag: '_onify-extension-on-enter'
      });
    } else {
      activity.on('enter', elementApi => {
        this._formatOnEnter(broker, formatQ, elementApi);
      }, {
        consumerTag: '_onify-extension-on-enter'
      });
    }
    activity.on('activity.execution.completed', async elementApi => {
      if (activity.isSubProcess && activity.id !== elementApi.id) return;
      formatQ.queueMessage({
        routingKey: 'run.end.format'
      }, {
        endRoutingKey: 'run.end.complete'
      }, {
        persistent: false
      });
      try {
        var format = await this._onExecuted(elementApi);
      } catch (err) {
        return broker.publish('format', 'run.end.error', {
          error: err
        }, {
          persistent: false
        });
      }
      broker.publish('format', 'run.end.complete', {
        ...format
      }, {
        persistent: false
      });
    }, {
      consumerTag: '_onify-extension-on-executed'
    });
    if (executionListeners !== null && executionListeners !== void 0 && executionListeners.onStart) {
      activity.on('start', async elementApi => {
        if (activity.isSubProcess && activity.id !== elementApi.id) return;
        formatQ.queueMessage({
          routingKey: 'run.listener.start'
        }, {
          endRoutingKey: 'run.listener.start.complete'
        }, {
          persistent: false
        });
        try {
          var format = await executionListeners.execute('start', elementApi);
        } catch (err) {
          return broker.publish('format', 'run.listener.start.error', {
            error: err
          }, {
            persistent: false
          });
        }
        broker.publish('format', 'run.listener.start.complete', {
          ...format
        }, {
          persistent: false
        });
      }, {
        consumerTag: '_onify-extension-on-listenerstart'
      });
    }
    if (executionListeners !== null && executionListeners !== void 0 && executionListeners.onEnd) {
      activity.on('end', async elementApi => {
        if (activity.isSubProcess && activity.id !== elementApi.id) return;
        formatQ.queueMessage({
          routingKey: 'run.listener.end'
        }, {
          endRoutingKey: 'run.listener.end.complete'
        }, {
          persistent: false
        });
        try {
          var format = await executionListeners.execute('end', elementApi);
        } catch (err) {
          return broker.publish('format', 'run.listener.end.error', {
            error: err
          }, {
            persistent: false
          });
        }
        broker.publish('format', 'run.listener.end.complete', {
          ...format
        }, {
          persistent: false
        });
      }, {
        consumerTag: '_onify-extension-on-listenerend'
      });
    }
  }
  deactivate() {
    const broker = this.activity.broker;
    broker.cancel('_onify-extension-on-enter');
    broker.cancel('_onify-extension-on-executed');
    broker.cancel('_onify-extension-on-listenerstart');
    broker.cancel('_onify-extension-on-listenerend');
  }
  async _formatOnEnter(broker, formatQ, elementApi) {
    if (this.activity.isSubProcess && this.activity.id !== elementApi.id) return;
    formatQ.queueMessage({
      routingKey: 'run.enter.format'
    }, {
      endRoutingKey: 'run.enter.complete'
    }, {
      persistent: false
    });
    try {
      var format = await this._onEnter(elementApi);
    } catch (err) {
      return broker.publish('format', 'run.enter.error', {
        error: err
      }, {
        persistent: false
      });
    }
    broker.publish('format', 'run.enter.complete', format, {
      persistent: false
    });
  }
  async _onEnter(elementApi) {
    const {
      format,
      properties,
      io,
      form
    } = this.extensions;
    const result = {};
    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);
    if (properties) {
      Object.assign(result, {
        properties: properties.resolve(elementApi)
      });
      Object.assign(elementApi.content, result);
    }
    if (io) {
      var _io$input, _io$output;
      if ((_io$input = io.input) !== null && _io$input !== void 0 && _io$input.length) {
        const input = await io.getInput(this.activity, elementApi);
        Object.assign(result, {
          input
        });
        Object.assign(elementApi.content, result);
      }
      if ((_io$output = io.output) !== null && _io$output !== void 0 && _io$output.length) {
        result.assignToOutput = true;
      }
    }
    if (form) {
      Object.assign(result, {
        form: form.resolve(elementApi)
      });
    }
    return result;
  }
  async _onExecuted(elementApi) {
    const {
      properties,
      io
    } = this.extensions;
    const result = {};
    if (io !== null && io !== void 0 && io.output.length) {
      const output = await io.getOutput(this.activity, elementApi);
      Object.assign(result, {
        output
      });
      Object.assign(elementApi.content, {
        output
      });
    }
    if (properties) {
      const props = properties.resolve(elementApi);
      Object.assign(result, {
        properties: props
      });
      Object.assign(elementApi.content, {
        properties: props
      });
    }
    const {
      output,
      assignToOutput,
      resultVariable
    } = elementApi.content;
    if (output !== undefined && output !== null) {
      if (assignToOutput && typeof output === 'object') {
        Object.assign(this.activity.environment.output, output);
      } else if (resultVariable) {
        elementApi.environment.output[resultVariable] = output;
      }
    }
    return result;
  }
}
exports.OnifyElementExtensions = OnifyElementExtensions;