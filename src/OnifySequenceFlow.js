import { SequenceFlow } from 'bpmn-elements';
import { getExtensions } from './getExtensions.js';

export class OnifySequenceFlow extends SequenceFlow {
  /**
   * @param {import('bpmn-elements').SequenceFlowDefinition} flowDef
   * @param {import('bpmn-elements').ContextInstance} context
   */
  constructor(flowDef, context) {
    super(flowDef, context);
    this.extensions = getExtensions(this, context);
    this.#activate();
  }
  #activate() {
    if (!this.extensions.listeners?.onTake) return;

    this.broker.subscribeTmp(
      'event',
      'flow.take',
      (_, msg) => {
        this.#executeListeners(msg);
      },
      { noAck: true, consumerTag: '_onify-execution-listener' }
    );
  }
  async #executeListeners(message) {
    try {
      await this.extensions.listeners.execute('take', message);
    } catch (err) {
      this.logger.error(`<${this.id}> execution listener error: ${err}`);
    }
  }
  /**
   * @param {import('bpmn-elements').ElementBrokerMessage} fromMessage
   * @param {(err: Error | null, result?: boolean | unknown) => void} callback
   */
  evaluate(fromMessage, callback) {
    const properties = this.extensions.properties;
    if (!properties) return super.evaluate(fromMessage, callback);

    try {
      const preProperties = properties.resolve(this.getApi(fromMessage));
      var evaluateMessage = fromMessage;
      evaluateMessage.content.properties = {
        ...fromMessage.content.properties,
        ...preProperties,
      };
    } catch (err) {
      return callback(err);
    }

    super.evaluate(evaluateMessage, (err, result) => {
      if (err) return callback(err);

      try {
        let overriddenResult = result ? {} : false;
        if (result) {
          overriddenResult = {
            ...(typeof result === 'object' && result),
            properties: properties.resolve(this.getApi(evaluateMessage)),
          };
        }
        return callback(err, overriddenResult);
      } catch (formatErr) {
        return callback(formatErr);
      }
    });
  }
}
