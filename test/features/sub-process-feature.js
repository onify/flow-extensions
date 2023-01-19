import testHelpers from '../helpers/testHelpers.js';

Feature('Sub process', () => {
  Scenario('Sub process with io', () => {
    let source, flow;
    const events = [];
    Given('a flow with sub process io', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <subProcess id="sub">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="foo" value="\${content.id}"/>
              </camunda:properties>
              <camunda:inputOutput>
                <camunda:inputParameter name="in">
                  <camunda:script scriptFormat="javascript">environment.services.trigger(content.id, 'in'); next(null, 1)</camunda:script>
                </camunda:inputParameter>
                <camunda:outputParameter name="out">
                  <camunda:script scriptFormat="javascript">environment.services.trigger(content.id, 'out'); next(null, 2)</camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
            <task id="task">
              <extensionElements>
                <camunda:inputOutput>
                  <camunda:outputParameter name="result">
                    <camunda:script scriptFormat="javascript">environment.services.trigger(content.id, 'out'); next(null, 3)</camunda:script>
                  </camunda:outputParameter>
                </camunda:inputOutput>
              </extensionElements>
            </task>
          </subProcess>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          trigger(id, value) {
            events.push(id + value);
          },
        },
      });
    });

    let end;
    When('ran', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('sub process formatting were hit once', async () => {
      await end;
      expect(events).to.deep.equal([
        'subin',
        'taskout',
        'subout',
      ]);
    });
  });
});
