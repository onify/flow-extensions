import testHelpers from '../helpers/testHelpers.js';
import { OnifyElementExtensions } from '../../src/OnifyElementExtensions.js';

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

  Scenario('plain elements defer to bpmn-elements assignOutput', () => {
    const source = `
    <definitions id="def_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="assignoutput" isExecutable="true">
        <startEvent id="start" />
        <sequenceFlow id="to-task" sourceRef="start" targetRef="task" />
        <userTask id="task" />
        <sequenceFlow id="to-extask" sourceRef="task" targetRef="extask" />
        <userTask id="extask">
          <extensionElements>
            <camunda:inputOutput>
              <camunda:outputParameter name="foo">\${content.output.bar}</camunda:outputParameter>
            </camunda:inputOutput>
          </extensionElements>
        </userTask>
        <sequenceFlow id="to-end" sourceRef="extask" targetRef="end" />
        <endEvent id="end" />
      </process>
    </definitions>`;

    let flow;
    Given('a flow with a plain user task and a user task with output parameters, and assignOutput auto', async () => {
      flow = await testHelpers.getOnifyFlow(source, { settings: { assignOutput: 'auto' } });
    });

    Then('no onify extension is attached to the plain user task', () => {
      const extensions = flow.getActivityById('task').extensions.extensions;
      expect(extensions.map((e) => e.type)).to.deep.equal(['output']);
    });

    And('onify extension is attached to the user task with output parameters', () => {
      const extensions = flow.getActivityById('extask').extensions.extensions;
      expect(extensions[0]).to.be.instanceof(OnifyElementExtensions);
      expect(extensions.map((e) => e.type)).to.not.include('output');
    });

    let end;
    When('ran and user tasks are signalled', async () => {
      end = flow.waitFor('end');
      flow.run();

      flow.getActivityById('task').getApi().signal({ plain: 1 });
      const extask = await flow.waitFor('wait');
      extask.signal({ bar: 'baz' });
    });

    Then('flow run completes', () => {
      return end;
    });

    And('plain user task signal payload was assigned to output by bpmn-elements', () => {
      expect(flow.environment.output).to.have.property('plain', 1);
    });

    And('user task with output parameters was assigned to output by onify extension', () => {
      expect(flow.environment.output).to.have.property('foo', 'baz');
      expect(flow.environment.output).to.not.have.property('bar');
    });
  });
});
