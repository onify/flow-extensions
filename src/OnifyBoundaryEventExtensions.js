import { OnifyElementExtensions } from './OnifyElementExtensions.js';

export class OnifyBoundaryEventExtensions extends OnifyElementExtensions {
  #syncFormatOnEnter;
  constructor(activity, context) {
    super(activity, context);
    this.#syncFormatOnEnter = this._syncFormatOnEnter.bind(this);
  }
  activate(message) {
    const activity = this.activity;
    const formatQ = activity.broker.getQueue('format-run-q');
    const executionListeners = this.extensions.listeners;

    if (this._formatOnEnter) {
      if (message.fields.redelivered && message.fields.routingKey === 'run.start') {
        activity.on('start', this.#syncFormatOnEnter, { consumerTag: '_onify-extension-on-enter' });
      } else {
        activity.on('enter', this.#syncFormatOnEnter, { consumerTag: '_onify-extension-on-enter' });
      }
    }

    if (this._formatOnEnd) {
      activity.on(
        'activity.execution.completed',
        (elementApi) => {
          return this._onExecutionCompleted(elementApi, formatQ);
        },
        { consumerTag: '_onify-extension-on-executed' }
      );
    }

    if (executionListeners?.onStart) {
      activity.on(
        'start',
        async (elementApi) => {
          try {
            await executionListeners.execute('start', elementApi);
          } catch (err) {
            return activity.logger.error(`<${activity.id}> execution listener error`, err);
          }
        },
        { consumerTag: '_onify-extension-on-listenerstart' }
      );
    }
    if (executionListeners?.onEnd) {
      activity.on(
        'end',
        (elementApi) => {
          this._executeExecutionListener('end', elementApi, formatQ);
        },
        { consumerTag: '_onify-extension-on-listenerend' }
      );
    }
  }
  /**
   * @internal
   * @param {import('bpmn-elements').IApi<import('bpmn-elements').Activity>} elementApi
   * @returns {void}
   */
  _syncFormatOnEnter(elementApi) {
    try {
      var format = this._onEnterSync(elementApi);
    } catch (err) {
      return elementApi.broker.publish('format', 'run.enter.error', { error: err }, { persistent: false });
    }

    elementApi.broker.publish('format', 'run.enter.complete', format, { persistent: false });
  }
  /**
   * @internal
   * @param {import('bpmn-elements').IApi<import('bpmn-elements').Activity>} elementApi
   * @returns {void}
   */
  _onEnterSync(elementApi) {
    const { format, properties, io } = this.extensions;

    const result = {};
    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);

    if (properties) {
      Object.assign(result, { properties: properties.resolve(elementApi) });
      Object.assign(elementApi.content, result);
    }

    if (io?.output?.length) {
      result.assignToOutput = true;
    }

    return result;
  }
}
