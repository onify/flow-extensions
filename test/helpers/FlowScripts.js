import {join} from 'path';
import {promises as fs} from 'fs';
import {Script} from 'vm';

const kSyntaxError = Symbol.for('syntax error');
const kResources = Symbol.for('resources base');

class FlowScriptError extends Error {
  constructor(fromErr) {
    super(fromErr.message);
    this.name = this.constructor.name;
    this.message = fromErr.message;

    Object.defineProperty(this, 'stack', {
      get() {
        return fromErr.stack && fromErr.stack.split('\n').slice(0, 7).join('\n');
      },
    });
    Object.defineProperty(this, 'code', {
      get() {
        return 'EFLOW_SCRIPT';
      },
    });
  }
  toString() {
    return '[FlowScriptError] ' + this.message + '\n' + this.stack;
  }
}

class FlowSyntaxError extends Error {
  constructor(fromErr) {
    super(fromErr.message);
    this.name = this.constructor.name;
    this.message = fromErr.message;

    Object.defineProperty(this, 'stack', {
      get() {
        return fromErr.stack && fromErr.stack.split('\n').slice(0, 6).join('\n');
      },
    });
    Object.defineProperty(this, 'code', {
      get() {
        return 'EFLOW_SCRIPT';
      },
    });
  }
  toString() {
    return '[FlowSyntaxError] ' + this.message + '\n' + this.stack;
  }
}

export {
  FlowScripts,
  JavaScript,
  JavaScriptResource,
};

function FlowScripts(flowName, resourceBase, runContext, timeout = 60000) {
  this._name = flowName;
  this._scripts = {};
  this._timeout = timeout;
  this._runContext = runContext;
  this[kResources] = resourceBase;
}

FlowScripts.prototype.register = function register({id, type, behaviour}) {
  let language, scriptBody, resource;

  switch (type) {
    case 'bpmn:SequenceFlow': {
      if (!behaviour.conditionExpression) return;
      language = behaviour.conditionExpression.language;
      scriptBody = behaviour.conditionExpression.body;
      resource = behaviour.conditionExpression.resource;
      break;
    }
    default: {
      language = behaviour.scriptFormat;
      scriptBody = behaviour.script;
      resource = behaviour.resource;
    }
  }

  if (!language) return;

  if (!['js', 'javascript'].includes(language.toLowerCase().trim())) return;

  language = 'javascript';

  const name = this._name;
  const filename = `${name}/${type}/${id}`;
  if (scriptBody) {
    this._scripts[id] = new JavaScript(name, scriptBody, this._runContext, {filename, timeout: this._timeout});
  } else if (resource) {
    this._scripts[id] = new JavaScriptResource(name, resource, this[kResources], this._runContext, {filename, timeout: this._timeout});
  }
};

FlowScripts.prototype.getScript = function getScript(scriptType, {id}) {
  return this._scripts[id];
};

function JavaScript(flowName, scriptBody, runContext, options) {
  this.flowName = flowName;
  this._runContext = runContext;
  this.timeout = options?.timeout;

  try {
    this.script = new Script(scriptBody, options);
  } catch (err) {
    this[kSyntaxError] = new FlowSyntaxError(err);
  }
}

JavaScript.prototype.execute = async function execute(executionContext, callback) {
  let callbackCalled;
  const syntaxError = this[kSyntaxError];
  if (syntaxError) return next(syntaxError);
  try {
    await this.script.runInNewContext({
      ...executionContext,
      Date,
      console: {
        log: console.log, // eslint-disable-line no-console
      },
      Buffer: {
        from: Buffer.from,
      },
      contextName: this.flowName,
      ...this._runContext,
      next,
    }, {
      timeout: this.timeout,
    });
  } catch (err) {
    return next(new FlowScriptError(err));
  }

  function next(err, ...args) {
    if (callbackCalled) return;
    callbackCalled = true;
    if (err) return callback(err);
    callback(null, ...args);
  }
};

function JavaScriptResource(flowName, resource, resourceBase, runContext, options) {
  this.flowName = flowName;
  this.resource = resource;
  this.options = options;
  this._runContext = runContext;
  this[kResources] = resourceBase;
}

JavaScriptResource.prototype.execute = async function execute(executionContext, callback) {
  let resource;
  try {
    resource = executionContext.resolveExpression(this.resource);
    var scriptBody = await fs.readFile(join(this[kResources], resource)); // eslint-disable-line no-var
  } catch (err) {
    if (err instanceof SyntaxError) {
      return callback(err);
    }
    const {filename} = this.options;
    return callback(new Error(`${filename}: script resource ${resource || this.resource} not found`));
  }

  const script = new JavaScript(this.flowName, scriptBody, this._runContext, {...this.options, filename: `${this.options.filename}/${resource}`});
  return script.execute(executionContext, callback);
};
