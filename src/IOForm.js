import IOProperties from './IOProperties.js';

export default class IOForm {
  constructor(activity, behaviour) {
    this.activity = activity;
    this.behaviour = behaviour;
  }
  resolve(elementApi) {
    const form = {};
    for (const field of this.behaviour.fields) {
      const f = form[field.id] = {
        ...field,
        ...(field.label && {defaultValue: elementApi.resolveExpression(field.label)}),
        ...(field.defaultValue && {defaultValue: elementApi.resolveExpression(field.defaultValue)}),
      };
      if (f.properties) {
        f.properties = new IOProperties(this.activity, f.properties).resolve(elementApi);
      }
    }

    return form;
  }
}
