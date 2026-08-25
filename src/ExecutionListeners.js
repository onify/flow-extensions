class Listener {
  /**
   * @param {import('bpmn-elements').Activity | import('bpmn-elements').SequenceFlow} activity
   * @param {import('bpmn-elements').ContextInstance} context
   * @param {{$type:string, event:string, [x:string]: any}} extension
   */
  constructor(activity, context, extension) {
    this.activity = activity;
    this.environment = this.activity.environment;
    this.context = context;
    this.extension = extension;
    this.type = extension.$type;
    this.event = extension.event;
  }
  /**
   * @param {import('bpmn-elements').IApi<any>} _api
   * @returns {Promise<any>}
   */
  // eslint-disable-next-line no-unused-vars
  execute(_api) {}
  /**
   * @internal
   * @param {import('bpmn-elements').IApi<any>} api
   * @param {Record<string, any>} [extend]
   */
  _getScope(api, extend) {
    const environment = this.environment;

    const { fields, content, properties } = api;
    const scope = {
      ...extend,
      type: this.type,
      listener: {
        event: this.event,
      },
      fields,
      content,
      properties,
      environment,
      logger: this.activity.logger,
    };

    const listenerFields = this._getFields(environment, scope);
    if (listenerFields) scope.listener.fields = listenerFields;

    return scope;
  }
  /**
   * @internal
   * @param {import('bpmn-elements').Environment} environment
   * @param {any} scope
   * @returns {Record<string, any>}
   */
  _getFields(environment, scope) {
    const fields = this.extension.fields;
    if (!fields?.length) return;
    const result = {};
    for (const { name, expression, string } of fields) {
      result['' + name] = expression ? environment.resolveExpression(expression, scope) : string;
    }
    return result;
  }
}

class ScriptListener extends Listener {
  /**
   * @param {import('bpmn-elements').Activity | import('bpmn-elements').SequenceFlow} activity
   * @param {import('bpmn-elements').ContextInstance} context
   * @param {{script: {$type:string, [x:string]: any}, [x:string]: any}} extension
   * @param {Number} pos execution listener position
   */
  constructor(activity, context, extension, pos) {
    super(activity, context, extension);
    const id = (this.id = `${activity.id}/${extension.script.$type}/${this.event}/${pos}`);
    this._register(context, id, extension.script);
  }
  execute(api) {
    const environment = this.environment;
    const scope = this._getScope(api, { id: this.id, resolveExpression });
    const listenerFields = this._getFields(environment, scope);
    if (listenerFields) scope.listener.fields = listenerFields;
    const script = this.environment.scripts.getScript(this.extension.scriptFormat, { id: this.id });

    return new Promise((resolve, reject) => {
      return script.execute(scope, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    function resolveExpression(expression) {
      return environment.resolveExpression(expression, scope);
    }
  }
  _register(context, id, script) {
    const { scriptFormat, value, resource } = script;

    context.environment.scripts.register({
      id,
      type: this.type,
      environment: this.environment,
      behaviour: {
        scriptFormat,
        ...(value && {
          script: value,
        }),
        ...(resource && {
          resource,
        }),
      },
    });
  }
}

class ExpressionListener extends Listener {
  execute(api) {
    const scope = this._getScope(api);
    return Promise.resolve({ expression: this.environment.resolveExpression(this.extension.expression, scope) });
  }
}

export class ExecutionListeners {
  /**
   *
   * @param {import('bpmn-elements').Activity | import('bpmn-elements').SequenceFlow} activity
   * @param {import('bpmn-elements').ContextInstance} context
   */
  constructor(activity, context) {
    this.activity = activity;
    this.context = context;
    /** @type {(ScriptListener | ExpressionListener)[]} */
    this.listeners = [];
  }
  get length() {
    return this.listeners.length;
  }
  get onStart() {
    return this.listeners.some((l) => l.event === 'start');
  }
  get onEnd() {
    return this.listeners.some((l) => l.event === 'end');
  }
  get onTake() {
    return this.listeners.some((l) => l.event === 'take');
  }
  add(extension, pos) {
    const { script, expression } = extension;
    if (!script && !expression) return;

    const list = this.listeners;
    if (script && (script.value || script.resource)) list.push(new ScriptListener(this.activity, this.context, extension, pos));
    else if (expression) list.push(new ExpressionListener(this.activity, this.context, extension));
  }
  async execute(event, message) {
    const found = this.listeners.filter((l) => l.event === event);
    const format = {};
    for (const f of found) {
      const result = await f.execute(message);
      if (result !== null && typeof result === 'object') Object.assign(format, result);
    }
    return format;
  }
}
