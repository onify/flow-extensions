import testHelpers from '../helpers/testHelpers.js';

Feature('Flow element properties', () => {
  Scenario('Flow with multi instance activity with properties', () => {
    let source, flow;
    Given('a flow looped subProcess', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <subProcess id="sub">
            <standardLoopCharacteristics loopMaximum="4" />
            <task id="task">
              <extensionElements>
                <camunda:properties>
                  <camunda:property name="parentLoopCounter" value="\${environment.variables.content.index + 1}" />
                </camunda:properties>
                <camunda:inputOutput>
                  <camunda:inputParameter name="url">/admin/agents/task/get-companieslime</camunda:inputParameter>
                  <camunda:outputParameter name="iteration">\${content.properties.parentLoopCounter}</camunda:outputParameter>
                </camunda:inputOutput>
              </extensionElements>
            </task>
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="result">\${content.output}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </subProcess>
          <sequenceFlow id="to-end" sourceRef="sub" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let end;
    When('started', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes', async () => {
      const ended = await end;
      expect(ended.environment.output)
        .to.have.property('result')
        .that.deep.equal([{ iteration: 1 }, { iteration: 2 }, { iteration: 3 }, { iteration: 4 }]);
    });
  });
});
