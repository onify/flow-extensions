import testHelpers from '../helpers/testHelpers.js';

Feature('Flow process', () => {
  Scenario('Flow with process properties', () => {
    let source, flow;
    Given('a flow with candidate users, roles, and process properties, and a task referencing process info', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <userTask id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="result">\${content.output.message.value}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let stop, state;
    When('started', () => {
      stop = flow.waitFor('stop');
      flow.once('activity.end', async () => {
        flow.stop();
        state = flow.getState();
      });
      flow.run();
    });

    And('task is signaled', () => {
      flow.signal({id: 'task', message: { value: 'resumed' }});
    });

    Then('run is stopped', () => {
      return stop;
    });

    let end;
    When('flow is recovered and resumed from stopped state', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      end = flow.waitFor('end');
      return flow.resume();
    });

    Then('run completes', async () => {
      const ended = await end;
      expect(ended.environment.output).to.have.property('result', 'resumed');
    });
  });
});
