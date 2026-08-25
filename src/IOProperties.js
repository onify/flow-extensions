export class IOProperties {
  constructor(activity, behaviour) {
    this.activity = activity;
    this.behaviour = behaviour;
  }
  /**
   * @param {elementApi: import('bpmn-elements').IApi<any>} elementApi
   * @returns {Record<string, any>}
   */
  resolve(elementApi) {
    const properties = {};

    for (const { id, name, value } of this.behaviour.values) {
      properties[id || name] = elementApi.resolveExpression(value);
    }

    return properties;
  }
}
