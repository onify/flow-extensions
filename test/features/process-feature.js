import testHelpers from '../helpers/testHelpers.js';

Feature('Flow process', () => {
  Scenario('Flow with process properties', () => {
    let source, flow;
    Given('a flow with candidate users, roles, and process properties, and a task referencing process info', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="admins," camunda:candidateStarterUsers="admin">
          <documentation>Leberkäse</documentation>
          <extensionElements>
            <camunda:properties>
              <camunda:property name="foo" value="bar"/>
              <camunda:property name="content" value="baz"/>
            </camunda:properties>
          </extensionElements>
          <userTask id="task">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="user" value="\${environment.variables.candidateStarterUsers}" />
                <camunda:property name="role" value="\${environment.variables.candidateStarterGroups}" />
                <camunda:property name="process_foo" value="\${environment.variables.foo}" />
              </camunda:properties>
              <camunda:inputOutput>
                <camunda:outputParameter name="result">
                  <camunda:list>
                    <camunda:value>\${environment.variables.description}</camunda:value>
                  </camunda:list>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let started, wait;
    When('started', () => {
      started = flow.waitFor('process.start');
      wait = flow.waitFor('wait');
      flow.run();
    });

    Then('process environment is decorated', async () => {
      const bp = await started;
      expect(bp.environment.variables).to.have.property('candidateStarterGroups').that.deep.equal(['admins']);
      expect(bp.environment.variables).to.have.property('candidateStarterUsers').that.deep.equal(['admin']);
      expect(bp.environment.variables).to.have.property('foo', 'bar');
      expect(bp.environment.variables).to.have.property('content').that.have.property('id');
      expect(bp.environment.variables).to.have.property('description', 'Leberkäse');
    });

    And('task is decorated with as expected', async () => {
      const taskApi = await wait;
      expect(taskApi.content).to.have.property('properties').that.deep.equal({
        process_foo: 'bar',
        user: ['admin'],
        role: ['admins'],
      });
    });

    let end, state;
    When('flow is stopped and resumed', async () => {
      await flow.stop();

      state = await flow.getState();

      end = flow.waitFor('end');
      return flow.resume();
    });

    And('task is signaled', () => {
      flow.signal({id: 'task'});
    });

    Then('run completes', async () => {
      const ended = await end;
      expect(ended.environment.output).to.have.property('result').that.deep.equal(['Leberkäse']);
    });

    When('flow is recovered and resumed from stopped state', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      end = flow.waitFor('end');
      return flow.resume();
    });

    And('task is signaled', () => {
      expect(flow.environment.output).to.not.have.property('result');
      flow.signal({id: 'task'});
    });

    Then('run completes', async () => {
      const ended = await end;
      expect(ended.environment.output).to.have.property('result').that.deep.equal(['Leberkäse']);
    });
  });

  Scenario('Flow with malformatted process property', () => {
    let source, flow;
    Given('a flow with candidate users, roles, and process properties, and a task referencing process info', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="admins," camunda:candidateStarterUsers="admin">
          <documentation>Leberkäse</documentation>
          <extensionElements>
            <camunda:properties>
              <camunda:property name="foo" value="bar"/>
              <camunda:property name="bar" value="\${environment.settings[dummy}"/>
            </camunda:properties>
          </extensionElements>
          <userTask id="task" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('run fails', async () => {
      const err = await error;
      expect(err.content.error).to.match(/Parser Error/i);
    });
  });
});
