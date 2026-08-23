import fs from 'node:fs/promises';
import BpmnModdle from 'bpmn-moddle';
import Debug from 'debug';
import { Engine } from 'bpmn-engine';
import { Serializer, TypeResolver } from 'moddle-context-serializer';
import * as Elements from 'bpmn-elements';
import * as expressions from '@aircall/expression-parser';

import { extensions, extendFn, OnifyTimerEventDefinition as TimerEventDefinition } from '@onify/flow-extensions';
import { FlowScripts } from '@onify/flow-extensions/FlowScripts';

let exts;

export default {
  moddleContext,
  getFlowOptions,
  getModdleExtensions,
  getOnifyFlow,
  Logger,
  recoverOnifyFlow,
  getEngine,
  parseOnifyFlow,
};

function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim());
}

/**
 * Get Definition as Onify flow with extensions
 * @param {string | Buffer} source BPMN source
 * @param {import('bpmn-elements').EnvironmentOptions} options Definition options
 */
async function getOnifyFlow(source, options = {}) {
  const { types, ...environmentOptions } = options;
  const serialized = await parseOnifyFlow(source, { types });

  return new Elements.Definition(new Elements.Context(serialized), getFlowOptions(serialized.name || serialized.id, environmentOptions));
}

/**
 * Parse source Onify flow with extensions
 * @param {string | Buffer} source BPMN source
 * @param {import('bpmn-elements').EnvironmentOptions} options Definition options
 */
async function parseOnifyFlow(source, options = {}) {
  const moddle = await moddleContext(source, await getModdleExtensions());
  if (moddle.warnings?.length) {
    const logger = Logger('bpmn-moddle');
    for (const w of moddle.warnings) logger.warn(w);
  }

  return Serializer(moddle, TypeResolver({ ...Elements, TimerEventDefinition, ...options.types }), extendFn);
}

/**
 * Get Engine as Onify flow with extensions
 * @param {string} name engine name
 * @param {string | Buffer} source BPMN source
 * @param {import('bpmn-engine').BpmnEngineOptions} options engine options
 * @returns {Promise<import('bpmn-engine').BpmnEngine>}
 */
async function getEngine(name, source, options) {
  return new Engine({
    name,
    source,
    moddleOptions: await getModdleExtensions(),
    ...getFlowOptions(name, options),
    elements: { ...Elements, TimerEventDefinition, ...options?.elements },
  });
}

async function recoverOnifyFlow(source, state, options) {
  const moddle = await moddleContext(source, await getModdleExtensions());
  const serialized = Serializer(moddle, TypeResolver(Elements), extendFn);
  return new Elements.Definition(new Elements.Context(serialized), getFlowOptions(state.name || state.id, options)).recover(state);
}

function getFlowOptions(name, options = {}) {
  const { extensions: extensionsOption, services, ...rest } = options;
  return {
    Logger,
    extensions: { ...extensionsOption, onify: extensions },
    services: {
      httpRequest() {},
      onifyApiRequest() {},
      onifyElevatedApiRequest() {},
      parseJSON() {},
      ...services,
    },
    scripts: new FlowScripts(name, './test/resources', {
      encrypt() {},
      decrypt() {},
      jwt: {
        sign() {},
        verify() {},
      },
    }),
    expressions,
    ...rest,
  };
}

async function getModdleExtensions() {
  if (exts) return { ...exts };
  const camunda = await fs.readFile('./node_modules/camunda-bpmn-moddle/resources/camunda.json');
  exts = {
    camunda: JSON.parse(camunda),
  };

  return { ...exts };
}

export function Logger(scope) {
  return {
    debug: Debug('bpmn:' + scope),
    error: Debug('bpmn:error:' + scope),
    warn: Debug('bpmn:warn:' + scope),
  };
}
