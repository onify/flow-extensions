import { OnifyElementExtensions } from './OnifyElementExtensions.js';

export class OnifyBoundaryEventExtensions extends OnifyElementExtensions {
  constructor(activity, context) {
    super(activity, context);
  }
  activate() {
    const activity = this.activity;
    const broker = activity.broker;
    const formatQ = activity.broker.getQueue('format-run-q');
    const executionListeners = this.extensions.listeners;

    activity.on('activity.execution.completed', async (elementApi) => {
      if (activity.isSubProcess && activity.id !== elementApi.id) return;

      formatQ.queueMessage({routingKey: 'run.end.format'}, {endRoutingKey: 'run.end.complete'}, {persistent: false});

      try {
        var format = await this._onExecuted(elementApi);
      } catch (err) {
        return broker.publish('format', 'run.end.error', {error: err}, {persistent: false});
      }

      broker.publish('format', 'run.end.complete', {...format}, {persistent: false});
    }, {consumerTag: '_onify-extension-on-executed'});

    if (executionListeners?.onStart) {
      activity.on('start', async (elementApi) => {
        try {
          await executionListeners.execute('start', elementApi);
        } catch (err) {
          return activity.logger.error(`<${activity.id}> execution listener error`, err);
        }
      }, {consumerTag: '_onify-extension-on-listenerstart'});
    }
    if (executionListeners?.onEnd) {
      activity.on('end', async (elementApi) => {
        if (activity.isSubProcess && activity.id !== elementApi.id) return;

        formatQ.queueMessage({routingKey: 'run.listener.end'}, {endRoutingKey: 'run.listener.end.complete'}, {persistent: false});

        try {
          var format = await executionListeners.execute('end', elementApi);
        } catch (err) {
          return broker.publish('format', 'run.listener.end.error', {error: err}, {persistent: false});
        }

        broker.publish('format', 'run.listener.end.complete', {...format}, {persistent: false});
      }, {consumerTag: '_onify-extension-on-listenerend'});
    }
  }
  deactivate() {
    const broker = this.activity.broker;
    broker.cancel('_onify-extension-on-executed');
    broker.cancel('_onify-extension-on-listenerstart');
    broker.cancel('_onify-extension-on-listenerend');
  }
}
