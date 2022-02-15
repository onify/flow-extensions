import * as Elements from 'bpmn-elements';
import factory from './helpers/factory';
import testHelpers from './helpers/testHelpers';
import {default as Serializer, TypeResolver} from 'moddle-context-serializer';
import {extendoFn} from '../index';

describe('extensions', () => {
  let moddleExtensions, source;
  before(async () => {
    source = factory.resource('activedirectory-index-users.bpmn');
    moddleExtensions = await testHelpers.getModdleExtensions();
  });

  it('loads input parameter scripts', async () => {
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendoFn);

    const script = serialized.elements.scripts.find(({name}) => name === 'prepareUsersFullIndex/camunda:Connector/camunda:InputParameter/payload');

    expect(script).to.be.ok;
  });

  it('can be executed', async () => {
    const moddleContext = await testHelpers.moddleContext(source, moddleExtensions);
    const serialized = Serializer(moddleContext, TypeResolver(Elements), extendoFn);

    const definition = new Elements.Definition(new Elements.Context(serialized), {Logger: testHelpers.Logger});
    definition.run();
  });
});
