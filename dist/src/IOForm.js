"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _IOProperties = _interopRequireDefault(require("./IOProperties.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class IOForm {
  constructor(activity, behaviour) {
    this.activity = activity;
    this.behaviour = behaviour;
  }

  resolve(elementApi) {
    const form = {};

    for (const field of this.behaviour.fields) {
      const f = form[field.id] = { ...field,
        ...(field.label && {
          defaultValue: elementApi.resolveExpression(field.label)
        }),
        ...(field.defaultValue && {
          defaultValue: elementApi.resolveExpression(field.defaultValue)
        })
      };

      if (f.properties) {
        f.properties = new _IOProperties.default(this.activity, f.properties).resolve(elementApi);
      }
    }

    return form;
  }

}

exports.default = IOForm;