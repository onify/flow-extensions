import ck from 'chronokinesis';
import testHelpers from '../helpers/testHelpers.js';
import factory from '../helpers/factory.js';

Feature('Flow connector', () => {
  let blueprintSource;
  before(() => {
    blueprintSource = factory.resource('activedirectory-index-users.bpmn');
  });
  after(ck.reset);

  Scenario('Onify API request', () => {
    let flow;
    const apiCalls = [];
    Given('a flow with agent task Onify API requests', async () => {
      flow = await testHelpers.getOnifyFlow(blueprintSource, {
        services: {
          onifyApiRequest(...args) {
            apiCalls.push(args);
          }
        }
      });
    });

    let element;
    When('started', async () => {
      ck.travel(Date.UTC(2022, 1, 14, 12, 0));

      const timer = flow.waitFor('activity.timer');
      flow.run();

      await timer;

      [element] = flow.getPostponed();
      flow.cancelActivity({id: element.id});
    });

    Then('API request is pending', () => {
      [element] = flow.getPostponed();
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
      [element] = flow.getPostponed();
      expect(element.id).to.equal('waitForPrepareTask');
    });

    When('agent task completes', () => {
      const start = flow.waitFor('activity.start');

      flow.signal({
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
      [element] = flow.getPostponed();
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

    Then('flow is waiting for agent task to complete', () => {
      [element] = flow.getPostponed();
      expect(element.id).to.equal('waitForReadTask');
    });

    When('second agent task completes', () => {
      const start = flow.waitFor('activity.start');

      flow.signal({
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
      [element] = flow.getPostponed();
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

  Scenario('Onify API request fails', () => {
    let flow;
    Given('a flow with Onify API requests', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="errorProne">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">GET</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                </camunda:inputOutput>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyApiRequest(...args) {
            args.pop()(new Error('Call failed'));
          }
        }
      });
    });

    let errMessage;
    When('started', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating Onify API request failed', async () => {
      const err = await errMessage;
      expect(err.content.error.message).to.match(/Call failed/);
    });
  });

  Scenario('Onify API request output', () => {
    let flow;
    Given('a flow with Onify API requests with output', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="service">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">GET</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                  <camunda:outputParameter name="result">
                    <camunda:script scriptFormat="js">
                      next(null, {
                        id: content.id,
                        statuscode,
                      });
                    </camunda:script>
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

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyApiRequest(...args) {
            args.pop()(null, {statuscode: 200});
          }
        }
      });
    });

    let end;
    When('started', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('output has expected values', async () => {
      const ended = await end;
      expect(ended.environment.output).to.have.property('result', 200);
    });
  });

  Scenario('Onify API request output fails', () => {
    let flow;
    Given('a flow with Onify API requests', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="errorProne">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">GET</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                  <camunda:outputParameter name="result">
                    <camunda:script scriptFormat="js">
                      next(null, {
                        id: content.id,
                        result: {
                          done: true,
                          statuscode: content.ouptut.result.statuscode,
                          user: content.output.user.key
                        }
                      });
                    </camunda:script>
                  </camunda:outputParameter>
                </camunda:inputOutput>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyApiRequest(...args) {
            args.pop()();
          }
        }
      });
    });

    let errMessage;
    When('started', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating Onify API request failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/Cannot read proper.*? of undefined/i);
    });
  });

  Scenario('Preparing Onify API request fails', () => {
    let flow;
    Given('a flow with Onify API requests', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="errorProne">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">GET</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                </camunda:inputOutput>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyApiRequest() {
            throw new Error('Something went wrong');
          }
        }
      });
    });

    let errMessage;
    When('started', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating Onify API request failed', async () => {
      const err = await errMessage;
      expect(err.content.error.message).to.match(/Something went wrong/);
    });
  });

  Scenario('Misspelled Onify API request', () => {
    let flow;
    Given('a flow with a misspelled connector id', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="misspelledServiceName">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyApiReqeust</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">GET</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                </camunda:inputOutput>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let errMessage;
    When('started', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating service not found', async () => {
      const err = await errMessage;
      expect(err.content.error.message).to.match(/onifyApiReqeust service function not found/);
    });
  });

  Scenario('Connector without io', () => {
    let flow;
    Given('a flow without io', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="parse">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>parseJSON</camunda:connectorId>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          parseJSON(...args) {
            args.pop()();
          }
        }
      });
    });

    let end;
    When('started', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('Elevated Onify API request', () => {
    let flow;
    const apiCalls = [];
    Given('a flow with Onify API requests to start agent task', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" candidateStarterGroups="admin">
          <serviceTask id="async-command" name="Start agent task">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>onifyElevatedApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="url">/admin/agents/task/get-companieslime</camunda:inputParameter>
                  <camunda:inputParameter name="method">post</camunda:inputParameter>
                  <camunda:inputParameter name="query">
                    <camunda:map>
                      <camunda:entry key="async">\${true}</camunda:entry>
                      <camunda:entry key="tag">\${environment.variables.input.agent}</camunda:entry>
                      <camunda:entry key="tag">tag-1</camunda:entry>
                      <camunda:entry key="tag">tag-2</camunda:entry>
                      <camunda:entry key="role">role-1</camunda:entry>
                      <camunda:entry key="role">role-2</camunda:entry>
                      <camunda:entry key="role">\${environment.variables.input.roles}</camunda:entry>
                      <camunda:entry>missing key</camunda:entry>
                    </camunda:map>
                  </camunda:inputParameter>
                  <camunda:inputParameter name="empty">
                    <camunda:map>
                    </camunda:map>
                  </camunda:inputParameter>
                  <camunda:inputParameter name="payload">
                    <camunda:map>
                      <camunda:entry key="id">\${content.executionId}_get-companieslime</camunda:entry>
                      <camunda:entry key="processid">\${environment.settings.processId}</camunda:entry>
                    </camunda:map>
                  </camunda:inputParameter>
                </camunda:inputOutput>
              </camunda:connector>
              <camunda:properties>
                <camunda:property name="alert_stateid" value="async-result" />
              </camunda:properties>
            </extensionElements>
          </serviceTask>
          <sequenceFlow id="to-async-result" sourceRef="async-command" targetRef="async-result" />
          <intermediateCatchEvent id="async-result" name="Wait for agent result">
            <messageEventDefinition id="async-result-message" messageRef="Message_0" />
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="state">
                  <camunda:script scriptFormat="js">next(null, {id: content.id, result: {done: false, error: false}});</camunda:script>
                </camunda:inputParameter>
                <camunda:inputParameter name="status">
                  <camunda:script scriptFormat="js" resource="./io-script.js" />
                </camunda:inputParameter>
                <camunda:outputParameter name="output">\${content.output.result}</camunda:outputParameter>
                <camunda:outputParameter name="state">
                  <camunda:script scriptFormat="js">
                    next(null, {
                      id: content.id,
                      result: {
                        done: true,
                        statuscode: content.output.result.statuscode,
                        user: content.output.user.key
                      }
                    });
                  </camunda:script>
                </camunda:outputParameter>
                <camunda:outputParameter name="tag">
                  <camunda:list>
                    <camunda:value>tag-3</camunda:value>
                    <camunda:value>\${environment.variables.a}</camunda:value>
                  </camunda:list>
                </camunda:outputParameter>
                <camunda:outputParameter name="empty">
                  <camunda:list>
                  </camunda:list>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </intermediateCatchEvent>
        </process>
        <bpmn:message id="Message_0" name="async-command" />
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyElevatedApiRequest(...args) {
            apiCalls.push(args);
          }
        }
      });
    });

    let wait, end;
    When('started', () => {
      wait = flow.waitFor('wait');
      end = flow.waitFor('end');
      flow.run();
    });

    Then('elevated API request is pending', () => {
      expect(apiCalls).to.have.length(1);
    });

    let apiCall;
    And('have expected arguments and properties', () => {
      apiCall = apiCalls.pop();
      const connectorArgument = apiCall[0];
      const message = apiCall[1];

      expect(connectorArgument).to.have.property('method', 'post');
      expect(connectorArgument).to.have.property('query').that.deep.equal({
        async: true,
        tag: ['tag-1', 'tag-2'],
        role: ['role-1', 'role-2'],
      });
      expect(message.content).to.have.property('properties').that.deep.equal({
        alert_stateid: 'async-result',
      });
    });

    When('request completes', () => {
      apiCall[2]();
    });

    And('task completes', async () => {
      await wait;

      flow.signal({
        id: 'Message_0',
        user: {
          key: 'user-1',
        },
        result: {
          statuscode: 201,
        },
      });
    });

    Then('flow completes with expected output', async () => {
      const ended = await end;
      expect(ended.environment.output).to.deep.equal({
        output: { statuscode: 201 },
        state: {
          id: 'async-result',
          result: { done: true, statuscode: 201, user: 'user-1' }
        },
        tag: ['tag-3'],
        empty: [],
      });
    });
  });
});
