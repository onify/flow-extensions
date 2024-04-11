import testHelpers from '../helpers/testHelpers.js';

Feature('Flow errors', () => {
  Scenario('Flows with invalid expression', () => {
    let flow;
    Given('a flow with a faulty expression form field', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" candidateStarterGroups="admin">
          <userTask id="task" camunda:formKey="klaslk" camunda:candidateGroups="admin,managers"  camunda:candidateUsers="user-1">
            <extensionElements>
              <camunda:formData>
                <camunda:formField id="items" label="Ordered items" type="string" defaultValue="\${environment.services.getItems8)}" />
              </camunda:formData>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    And('task is fails', async () => {
      const err = await error;
      expect(err.content.error).to.match(/SyntaxError/);
    });

    Given('a flow with a faulty output expression', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" candidateStarterGroups="admin">
          <task id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="result">\${content.output.result)}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    And('task fails', async () => {
      const err = await error;
      expect(err.content.error).to.match(/SyntaxError/);
    });

    Given('a flow with a output expression succeeded by a faulty task', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" candidateStarterGroups="admin">
          <task id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="foo">bar</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
          <sequenceFlow id="to-fail" sourceRef="task" targetRef="epic-fail" />
          <task id="epic-fail">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="baz">\${content.output.result)}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    And('task fails', async () => {
      const err = await error;
      expect(err.content.error).to.match(/SyntaxError/);
    });

    And('flow has output from non-failing task', async () => {
      expect(await flow.getState())
        .to.have.property('environment')
        .with.property('output')
        .with.property('foo', 'bar');
    });
  });
});
