import ck from 'chronokinesis';
import testHelpers from '../helpers/testHelpers.js';
import factory from '../helpers/factory.js';
import * as Elements from 'bpmn-elements';
import {default as Serializer, TypeResolver} from 'moddle-context-serializer';
import {extendoFn} from '../..';

Feature('Extend function', () => {
  let blueprintSource;
  before(() => {
    blueprintSource = factory.resource('activedirectory-index-users.bpmn');
  });
  after(ck.reset);

  Scenario('Extract scripts', () => {
    let serialized, moddleContext;
    Given('a bpmn source with IO scripts', async () => {
      moddleContext = await testHelpers.moddleContext(blueprintSource, await testHelpers.getModdleExtensions());
    });

    When('serialized', () => {
      serialized = Serializer(moddleContext, TypeResolver(Elements), extendoFn);
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
  });
});
