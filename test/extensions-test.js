import {default as Serializer, TypeResolver} from 'moddle-context-serializer';
import {extendFn} from '../src/index.js';
import * as Elements from 'bpmn-elements';
import factory from './helpers/factory.js';
import testHelpers from './helpers/testHelpers.js';

describe('extensions', () => {
  let moddleExtensions;
  before(async () => {
    moddleExtensions = await testHelpers.getModdleExtensions();
  });

  it('extendFn registers scripts', async () => {
    const source = factory.resource('activedirectory-index-users.bpmn');
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);

    expect(serialized.elements.scripts.length).to.equal(5);

    for (const script of serialized.elements.scripts) {
      expect(script, script.name).to.have.property('script');
      expect(script.script, script.name).to.have.property('type').that.is.ok;
    }
  });

  it('extendFn registers extension scripts with type', async () => {
    const source = `
    <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="execlisteners" isExecutable="true">
        <task id="task">
          <extensionElements>
            <camunda:executionListener event="start">
              <camunda:script scriptFormat="js">next();</camunda:script>
            </camunda:executionListener>
            <camunda:executionListener event="end">
              <camunda:script scriptFormat="js">next();</camunda:script>
            </camunda:executionListener>
          </extensionElements>
        </task>
      </process>
    </definitions>`;
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);

    expect(serialized.elements.scripts.length).to.equal(2);

    for (const script of serialized.elements.scripts) {
      expect(script, script.name).to.have.property('script');
      expect(script.script, script.name).to.have.property('type', 'camunda:ExecutionListener');
    }
  });

  it('extendFn registers io scripts with type', async () => {
    const source = `
    <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="process-1" name="Onify Flow" isExecutable="true">
        <task id="service">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:inputParameter name="method">
                <camunda:script scriptFormat="js">next(null, 'GET');</camunda:script>
              </camunda:inputParameter>
              <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
              <camunda:outputParameter name="result">
                <camunda:script scriptFormat="js">next(null, { id: content.id, statuscode });</camunda:script>
              </camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </task>
      </process>
    </definitions>`;
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);

    const scripts = serialized.elements.scripts;
    expect(scripts.length).to.equal(2);
    expect(scripts[0], scripts[0].name).to.have.property('script');
    expect(scripts[0].script, scripts[0].name).to.have.property('type', 'camunda:InputOutput/camunda:InputParameter');
    expect(scripts[1], scripts[1].name).to.have.property('script');
    expect(scripts[1].script, scripts[1].name).to.have.property('type', 'camunda:InputOutput/camunda:OutputParameter');
  });

  it('extendFn registers connector io scripts with type', async () => {
    const source = `
    <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="process-1" name="Onify Flow" isExecutable="true">
        <serviceTask id="service">
          <extensionElements>
            <camunda:connector>
              <camunda:connectorId>onifyApiRequest</camunda:connectorId>
              <camunda:inputOutput>
                <camunda:inputParameter name="method">
                  <camunda:script scriptFormat="js">next(null, 'GET');</camunda:script>
                </camunda:inputParameter>
                <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                <camunda:outputParameter name="result">
                  <camunda:script scriptFormat="js">next(null, { id: content.id, statuscode });</camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </camunda:connector>
            <camunda:inputOutput>
              <camunda:outputParameter name="result">\${content.output.result.statuscode}</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </serviceTask>
      </process>
    </definitions>`;
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);

    const scripts = serialized.elements.scripts;
    expect(scripts.length).to.equal(2);
    expect(scripts[0], scripts[0].name).to.have.property('script');
    expect(scripts[0].script, scripts[0].name).to.have.property('type', 'camunda:Connector/camunda:InputParameter');
    expect(scripts[1], scripts[1].name).to.have.property('script');
    expect(scripts[1].script, scripts[1].name).to.have.property('type', 'camunda:Connector/camunda:OutputParameter');
  });
});
