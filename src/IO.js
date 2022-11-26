export {
  InputOutput,
  IOBase,
  IOMap,
  IOList,
  IOScript,
};

class InputOutput {
  constructor(parentId, behaviour, context) {
    this.parentId = parentId;
    this.context = context;
    const {inputParameters, outputParameters} = behaviour;
    this.input = this._map(parentId, inputParameters, 'input', context);
    this.output = this._map(parentId, outputParameters, 'output', context);
  }
  async getInput(activity, executionMessage) {
    const input = this.input;
    const values = await Promise.all(input.map((parm) => parm.getValue(activity, executionMessage)));
    return values.reduce((result, parm) => Object.assign(result, parm), {});
  }
  async getOutput(activity, executionMessage) {
    const output = this.output;
    const values = await Promise.all(output.map((parm) => parm.getValue(activity, executionMessage)));
    return values.reduce((result, parm) => Object.assign(result, parm), {});
  }
  _map(parentId, list, ioType, context) {
    const mapped = [];
    if (!list) return mapped;

    for (const parm of list) {
      const definition = parm.definition;
      const type = definition && definition.$type;
      switch (type) {
        case 'camunda:Map': {
          mapped.push(new IOMap(parm));
          break;
        }
        case 'camunda:List': {
          mapped.push(new IOList(parm));
          break;
        }
        case 'camunda:Script': {
          const id = `${parentId}/${ioType}/${type}/${parm.name}`;
          const {scriptFormat, value, resource} = definition;

          if (!value && !resource) break;

          context.environment.scripts.register({
            id,
            type: parm.$type,
            behaviour: {
              scriptFormat,
              ...(value && {script: value}),
              ...(resource && {resource}),
            },
          });

          mapped.push(new IOScript(parm, id));
          break;
        }
        default: {
          mapped.push(new IOBase(parm));
        }
      }
    }

    return mapped;
  }
}

class IOBase {
  constructor(parm) {
    this.name = parm.name;
    this.type = parm.definition && parm.definition.$type || 'string';
    this.behaviour = parm;
  }
  getValue(activity, executionMessage) {
    return {
      [this.name]: activity.environment.resolveExpression(this.behaviour.value, executionMessage),
    };
  }
}

class IOMap extends IOBase {
  constructor(parm) {
    super(parm);
  }
  getValue(activity, executionMessage) {
    const name = this.name;
    const entries = this.behaviour.definition.entries;
    if (!Array.isArray(entries)) return {[name]: {}};

    const environment = activity.environment;

    const result = {};
    for (const {key, value} of entries) {
      if (!key) continue;

      const val = environment.resolveExpression(value, executionMessage);
      if (key in result) {
        if (val === undefined) continue;
        const current = result[key];
        if (Array.isArray(current)) {
          current.push(val);
        } else {
          const items = result[key] = [];
          if (current !== undefined) items.push(current);
          items.push(val);
        }
      } else {
        result[key] = val;
      }
    }

    return {[name]: result};
  }
}

class IOList extends IOBase {
  constructor(parm) {
    super(parm);
  }
  getValue(activity, executionMessage) {
    const name = this.name;
    const items = this.behaviour.definition.items;

    const result = [];
    if (!Array.isArray(items)) return {[name]: result};

    const environment = activity.environment;
    for (const item of items) {
      const val = environment.resolveExpression(item.value, executionMessage);
      if (val !== undefined) result.push(val);
    }

    return {
      [name]: result,
    };
  }
}

class IOScript extends IOBase {
  constructor(parm, scriptId) {
    super(parm);
    this.id = scriptId;
    this.script = true;
  }
  getValue(activity, executionMessage) {
    const definition = this.behaviour.definition;
    const name = this.name;
    const environment = activity.environment;

    const {fields, content, properties, ...rest} = executionMessage;
    const scope = {
      id: this.id,
      type: this.type,
      name,
      fields,
      content,
      properties,
      environment: activity.environment,
      logger: activity.logger,
      resolveExpression,
      ...rest,
    };

    const script = environment.scripts.getScript(definition.scriptFormat, {id: this.id});

    return new Promise((resolve, reject) => {
      return script.execute(scope, (err, result) => {
        if (err) return reject(err);
        resolve({[name]: result});
      });
    });

    function resolveExpression(expression) {
      return environment.resolveExpression(expression, scope);
    }
  }
}
