import testHelpers from '../helpers/testHelpers.js';
import factory from '../helpers/factory.js';
import * as Elements from 'bpmn-elements';
import { Serializer, TypeResolver } from 'moddle-context-serializer';
import { extendFn } from '../../src/index.js';

Feature('Extend function', () => {
  let blueprintSource;
  before(() => {
    blueprintSource = factory.resource('activedirectory-index-users.bpmn');
  });

  Scenario('Extract scripts', () => {
    let serialized, moddleContext;
    Given('a bpmn source with IO scripts', async () => {
      moddleContext = await testHelpers.moddleContext(blueprintSource, await testHelpers.getModdleExtensions());
    });

    When('serialized', () => {
      serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);
    });

    Then('all scripts are registered', () => {
      expect(serialized.elements.scripts).to.have.length(5);
    });

    And('registered Connector IO script', () => {
      const registered = serialized.elements.scripts[0];
      expect(registered).to.have.property('name', 'prepareUsersFullIndex/camunda:Connector/camunda:InputParameter/payload');
      expect(registered).to.have.property('parent').that.deep.equal({
        id: 'prepareUsersFullIndex',
        type: 'bpmn:ServiceTask',
      });
      expect(registered.script).to.have.property('scriptFormat');
      expect(registered.script).to.have.property('body');
    });

    And('registered script task script', () => {
      const registered = serialized.elements.scripts[1];
      expect(registered).to.have.property('parent').that.deep.equal({
        id: 'transformUsers',
        type: 'bpmn:ScriptTask',
      });
      expect(registered.script).to.have.property('scriptFormat');
      expect(registered.script).to.have.property('body');
    });

    And('registered sequence flow condition script', () => {
      const registered = serialized.elements.scripts[3];
      expect(registered).to.have.property('parent').that.deep.equal({
        id: 'Flow_0jz43uw',
        type: 'bpmn:SequenceFlow',
      });
      expect(registered.script).to.have.property('scriptFormat');
      expect(registered.script).to.have.property('body');
    });

    Given('a source with sequence flow execution listener', async () => {
      const source = factory.resource('sequence-flow-properties.bpmn');
      moddleContext = await testHelpers.moddleContext(source, await testHelpers.getModdleExtensions());
    });

    When('serialized', () => {
      serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);
    });

    Then('all scripts are registered', () => {
      expect(serialized.elements.scripts).to.have.length(4);
    });

    And('registered SequenceFlow execution listener scripts', () => {
      const [listener0, listener1] = serialized.elements.scripts.filter((s) => s.parent.id === 'to-script');
      expect(listener0).to.have.property('name', 'to-script/camunda:ExecutionListener/take/0');
      expect(listener0).to.have.property('parent').that.deep.equal({
        id: 'to-script',
        type: 'bpmn:SequenceFlow',
      });
      expect(listener0.script).to.have.property('scriptFormat');
      expect(listener0.script).to.have.property('body');

      expect(listener1).to.have.property('name', 'to-script/camunda:ExecutionListener/take/1');
      expect(listener1).to.have.property('parent').that.deep.equal({
        id: 'to-script',
        type: 'bpmn:SequenceFlow',
      });
      expect(listener1.script).to.have.property('scriptFormat');
      expect(listener1.script).to.have.property('resource');
    });
  });
});
