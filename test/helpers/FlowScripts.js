import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { Script } from 'node:vm';

const kSyntaxError = Symbol.for('syntax error');
const kResources = Symbol.for('resources base');

export class FlowScriptError extends Error {
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
    return '[' + this.name + '] ' + this.message + '\n' + this.stack;
  }
}

export class FlowSyntaxError extends Error {
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
    return '[' + this.name + '] ' + this.message + '\n' + this.stack;
  }
}

export class FlowResourceError extends FlowScriptError {
  constructor(fromErr, filename) {
    super(fromErr);
    this.filename = filename;
    this.inner = fromErr;
  }
}

export function FlowScripts(flowName, resourceBase, runContext, timeout = 60000) {
  this.flowName = flowName;
  this.scripts = new Map();
  this.timeout = timeout;
  this.runContext = runContext;
  this[kResources] = resourceBase;
}

FlowScripts.prototype.register = function register({ id, type, behaviour }) {
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

  const flowName = this.flowName;
  const filename = `${flowName}/${type}/${id}`;
  if (scriptBody) {
    this.scripts.set(id, new JavaScript(flowName, scriptBody, this.runContext, { filename, timeout: this.timeout }));
  } else if (resource) {
    this.scripts.set(
      id,
      new JavaScriptResource(flowName, resource, this[kResources], this.runContext, { filename, timeout: this.timeout })
    );
  }
};

FlowScripts.prototype.getScript = function getScript(scriptType, { id }) {
  return this.scripts.get(id);
};

/**
 * Java script
 * @param {string} flowName
 * @param {string|Buffer} scriptBody
 * @param {any} [runContext]
 * @param {import('node:vm').ScriptOptions} options
 */
export function JavaScript(flowName, scriptBody, runContext, options) {
  this.flowName = flowName;
  this.options = options;
  this.runContext = runContext;
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
    await this.script.runInNewContext(
      {
        ...executionContext,
        Date,
        console: {
          log: console.log, // eslint-disable-line no-console
        },
        Buffer: {
          from: Buffer.from,
        },
        contextName: this.flowName,
        ...this.runContext,
        next,
      },
      {
        timeout: this.timeout,
      }
    );
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

export function JavaScriptResource(flowName, resource, resourceBase, runContext, options) {
  this.flowName = flowName;
  this.resource = resource;
  this.runContext = runContext;
  this.options = options;
  this.timeout = options?.timeout;
  this.resourceBase = resourceBase;
}

/**
 * Get javascript resource content
 * @param {string} resourceBase Resource base
 * @param {*} resource Resource name or path
 * @returns {Promise<string|Buffer} Resource content
 */
JavaScriptResource.prototype.getResourceContent = function getResourceContent(resourceBase, resource) {
  return fs.readFile(join(resourceBase, resource));
};

JavaScriptResource.prototype.execute = async function execute(executionContext, callback) {
  let resource;
  try {
    resource = executionContext.resolveExpression(this.resource);
    var scriptBody = await this.getResourceContent(this.resourceBase, resource); // eslint-disable-line no-var
    if (!scriptBody) throw new TypeError(`${this.options.filename}: script resource ${resource || this.resource} is empty`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return callback(err);
    }
    return callback(new FlowResourceError(err, this.options.filename));
  }

  if (!scriptBody) {
    throw new FlowResourceError();
  }

  const script = new JavaScript(this.flowName, scriptBody, this.runContext, {
    ...this.options,
    filename: `${this.options.filename}/${resource}`,
  });
  return script.execute(executionContext, callback);
};
