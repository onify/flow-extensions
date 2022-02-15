"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class IOProperties {
  constructor(activity, behaviour) {
    this.activity = activity;
    this.behaviour = behaviour;
  }

  resolve(elementApi) {
    const properties = {};

    for (const {
      id,
      name,
      value
    } of this.behaviour.values) {
      properties[id || name] = elementApi.resolveExpression(value);
    }

    return properties;
  }

}

exports.default = IOProperties;