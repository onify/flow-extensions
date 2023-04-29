"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OnifySequenceFlow = void 0;
var _bpmnElements = require("bpmn-elements");
var _getExtensions = require("./getExtensions.js");
class OnifySequenceFlow extends _bpmnElements.SequenceFlow {
  constructor(flowDef, context) {
    super(flowDef, context);
    this.extensions = (0, _getExtensions.getExtensions)(this, context);
    this._activate();
  }
  _activate() {
    var _this$extensions$list;
    if (!((_this$extensions$list = this.extensions.listeners) !== null && _this$extensions$list !== void 0 && _this$extensions$list.onTake)) return;
    this.broker.subscribeTmp('event', 'flow.take', (_, msg) => {
      this._executeListeners(msg);
    }, {
      noAck: true,
      consumerTag: '_onify-execution-listener'
    });
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
            properties: properties.resolve(this.getApi(fromMessage))
          };
        }
        return callback(err, overriddenResult);
      } catch (formatErr) {
        return callback(formatErr);
      }
    });
  }
}
exports.OnifySequenceFlow = OnifySequenceFlow;