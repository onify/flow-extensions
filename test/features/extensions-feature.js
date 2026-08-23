import testHelpers from '../helpers/testHelpers.js';

Feature('Extensions', () => {
  Scenario('flow with elements with and without formatting extensions', () => {
    const source = `
    <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="formatqueue" isExecutable="true">
        <startEvent id="start" />
        <sequenceFlow id="to-task" sourceRef="start" targetRef="task" />
        <task id="task" />
        <sequenceFlow id="to-extask" sourceRef="task" targetRef="extask" />
        <task id="extask">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:outputParameter name="foo">bar</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </task>
        <sequenceFlow id="to-end" sourceRef="extask" targetRef="end" />
        <endEvent id="end" />
      </process>
    </definitions>`;

    let flow;
    const formatMessages = {};
    Given('a flow with a plain task and a task with output parameters', async () => {
      flow = await testHelpers.getOnifyFlow(source);

      for (const id of ['start', 'task', 'extask', 'end']) {
        const messages = (formatMessages[id] = []);
        flow.getActivityById(id).broker.subscribeTmp(
          'format',
          '#',
          (routingKey) => {
            if (routingKey.startsWith('run._')) return;
            messages.push(routingKey);
          },
          { noAck: true, consumerTag: `_test-format-${id}` }
        );
      }
    });

    let end;
    When('ran', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('flow run completes', () => {
      return end;
    });

    And('task with output parameters was formatted', () => {
      expect(flow.environment.output).to.deep.equal({ foo: 'bar' });
      expect(formatMessages.extask).to.include('run.enter.complete').and.include('run.end.complete');
    });

    And('nothing was published on format queue for elements without formatting extensions', () => {
      expect(formatMessages.start, 'start').to.deep.equal([]);
      expect(formatMessages.task, 'task').to.deep.equal([]);
      expect(formatMessages.end, 'end').to.deep.equal([]);
    });
  });
});
