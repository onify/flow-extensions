import { SequenceFlow } from 'bpmn-elements';
import { getExtensions } from './getExtensions.js';

export class OnifySequenceFlow extends SequenceFlow {
  constructor(flowDef, context) {
    super(flowDef, context);
    this.extensions = getExtensions(this, context);
    this._activate();
  }
  _activate() {
    if (!this.extensions.listeners?.onTake) return;

    this.broker.subscribeTmp(
      'event',
      'flow.take',
      (_, msg) => {
        this._executeListeners(msg);
      },
      { noAck: true, consumerTag: '_onify-execution-listener' },
    );
  }
  async _executeListeners(message) {
    try {
      await this.extensions.listeners.execute('take', message);
    } catch (err) {
      this.logger.error(`<${this.id}> execution listener error: ${err}`);
    }
  }
  evaluate(fromMessage, callback) {
    const properties = this.extensions.properties;
    if (!properties) return super.evaluate(fromMessage, callback);

    super.evaluate(fromMessage, (err, result) => {
      if (err) return callback(err);

      try {
        let overriddenResult = result ? {} : false;
        if (result) {
          overriddenResult = {
            ...(typeof result === 'object' && result),
            properties: properties.resolve(this.getApi(fromMessage)),
          };
        }
        return callback(err, overriddenResult);
      } catch (formatErr) {
        return callback(formatErr);
      }
    });
  }
}
