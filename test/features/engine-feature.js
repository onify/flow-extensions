import ck from 'chronokinesis';
import factory from '../helpers/factory.js';
import testHelpers from '../helpers/testHelpers.js';
import {EventEmitter} from 'events';

Feature('BPMN Engine', () => {
  let blueprintSource;
  before(() => {
    blueprintSource = factory.resource('activedirectory-index-users.bpmn');
  });
  after(ck.reset);

  Scenario('Onify API request', () => {
    let engine;
    const apiCalls = [];
    Given('a source with agent task Onify API requests', async () => {
      engine = await testHelpers.getEngine('onify blueprint', blueprintSource, {
        services: {
          onifyApiRequest(...args) {
            apiCalls.push(args);
          },
        },
      });
    });

    let execution, listener, element;
    When('started', async () => {
      ck.travel(Date.UTC(2022, 1, 14, 12, 0));

      listener = new EventEmitter();
      const timer = new Promise((resolve) => listener.once('activity.timer', resolve));
      execution = await engine.execute({listener});

      await timer;

      [element] = execution.getPostponed();
      execution.cancelActivity({id: element.id});
    });

    Then('API request is pending', () => {
      [element] = execution.getPostponed();
      expect(element.type).to.equal('bpmn:ServiceTask');
    });

    let apiCall;
    And('expected arguments have been passed', () => {
      expect(apiCalls).to.have.length(1);
      apiCall = apiCalls.pop();

      expect(apiCall[0]).to.deep.equal({
        method: 'post',
        query: { tag: 'agent', async: true },
        payload: { vars: [ '-arrSearchConfig user', '-useTemplate' ] },
        url: '/admin/agents/task/prepareOnifyIndexAD'
      });
    });

    When('API responds', () => {
      apiCall[2]();
    });

    Then('flow is waiting for agent task to complete', () => {
      [element] = execution.getPostponed();
      expect(element.id).to.equal('waitForPrepareTask');
    });

    When('agent task completes', () => {
      const start = new Promise((resolve) => listener.once('activity.start', resolve));

      execution.signal({
        result: {
          response: JSON.stringify({
            searchConfig: [{
              user: {
                filePath: '/user.json'
              }
            }]
          }),
        }
      });

      return start;
    });

    Then('next API request is pending', () => {
      [element] = execution.getPostponed();
      expect(element.type).to.equal('bpmn:ServiceTask');
    });

    And('expected arguments have been passed', () => {
      expect(apiCalls).to.have.length(1);
      apiCall = apiCalls.pop();

      expect(apiCall[0]).to.deep.equal({
        method: 'post',
        query: { tag: 'agent', async: true },
        payload: { vars: [ '/user.json', '0', '1000' ] },
        url: '/admin/agents/task/readDataFromJsonFile'
      });
    });

    When('API responds to second API request', () => {
      apiCall[2]();
    });

    Then('engine is waiting for agent task to complete', () => {
      [element] = execution.getPostponed();
      expect(element.id).to.equal('waitForReadTask');
    });

    When('second agent task completes', () => {
      const start = new Promise((resolve) => listener.once('activity.start', resolve));

      execution.signal({
        result: {
          response: JSON.stringify({
            records: [{
              key: 'user-1',
            }]
          }),
        }
      });

      return start;
    });

    Then('a third API request is pending', () => {
      [element] = execution.getPostponed();
      expect(element.type).to.equal('bpmn:ServiceTask');
    });

    And('expected arguments have been passed', () => {
      expect(apiCalls).to.have.length(1);
      apiCall = apiCalls.pop();

      expect(apiCall[0]).to.deep.equal({
        method: 'POST',
        payload: [{ key: 'user-1' }],
        url: '/admin/bulk/items'
      });
    });
  });

  Scenario('Service expression', () => {
    let engine;
    const serviceCalls = [];
    Given('a source with a service expression', async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="task1" camunda:expression="\${environment.services.parseJSON}" camunda:resultVariable="result" />
        </process>
      </definitions>`;

      engine = await testHelpers.getEngine('service expression', source, {
        services: {
          parseJSON(...args) {
            serviceCalls.push(args);
          },
        },
      });
    });

    When('engine runs', () => {
      return engine.execute();
    });

    Then('service expression function is expecting to complete', () => {
      expect(serviceCalls).to.have.length(1);
    });

    let end;
    When('service call completes', () => {
      engine.waitFor('end');
      serviceCalls.pop().pop()();
    });

    Then('engine completes run', () => {
      return end;
    });
  });
});
