import { OnifyElementExtensions } from './OnifyElementExtensions.js';

export class OnifySubProcessExtensions extends OnifyElementExtensions {
  constructor(activity, context) {
    super(activity, context);
  }
  activate(runMessage) {
    const activity = this.activity;
    const broker = activity.broker;
    const executionListeners = this.extensions.listeners;

    if (runMessage.fields.redelivered && runMessage.fields.routingKey === 'run.start') {
      this._setupListener(
        broker,
        'activity.start',
        (elementApi) => {
          return this._asyncFormatOnEnter(elementApi);
        },
        '_onify-extension-on-enter',
      );
    } else {
      this._setupListener(
        broker,
        'activity.enter',
        (elementApi) => {
          return this._asyncFormatOnEnter(elementApi);
        },
        '_onify-extension-on-enter',
      );
    }

    this._setupListener(
      broker,
      'activity.execution.completed',
      (elementApi) => {
        return this._onExecutionCompleted(elementApi);
      },
      '_onify-extension-on-executed',
    );

    if (executionListeners?.onStart) {
      this._setupListener(
        broker,
        'activity.start',
        (elementApi) => {
          this._executeExecutionListener('start', elementApi);
        },
        '_onify-extension-on-listenerstart',
      );
    }

    if (executionListeners?.onEnd) {
      this._setupListener(
        broker,
        'activity.end',
        (elementApi) => {
          this._executeExecutionListener('end', elementApi);
        },
        '_onify-extension-on-listenerend',
      );
    }
  }
  _setupListener(broker, routingKey, callback, consumerTag) {
    const activity = this.activity;
    broker.subscribeTmp(
      'event',
      routingKey,
      (_, message) => {
        if (activity.id !== message.content.id) return;

        return callback(activity.getApi(message));
      },
      { noAck: true, consumerTag },
    );
  }
}
