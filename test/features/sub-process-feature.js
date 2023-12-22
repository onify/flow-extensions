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

  Scenario('Transaction with io', () => {
    let source, flow;
    const events = [];
    Given('a flow with sub process io', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <transaction id="sub">
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
          </transaction>
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

  Scenario('Multi-instance sub process', () => {
    let source;
    /** @type {import('bpmn-elements').Definition} */
    let flow;
    Given('a flow with multi instance sub process including child sub process both looped over a collection', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def-multi" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="testing-sub-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-task" sourceRef="start" targetRef="task" />
          <task id="task" />
          <sequenceFlow id="to-sub" sourceRef="task" targetRef="sub" />
          <subProcess id="sub">
            <multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${environment.variables.input.collection}" camunda:elementVariable="process" />
            <task id="subtask" />
            <sequenceFlow id="to-subsub" sourceRef="subtask" targetRef="subsub" />
            <subProcess id="subsub">
              <multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${environment.variables.input.collection}" camunda:elementVariable="process" />
              <task id="subsubtask" />
            </subProcess>
          </subProcess>
          <sequenceFlow id="to-wait" sourceRef="sub" targetRef="wait" />
          <userTask id="wait" camunda:resultVariable="continue">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="continue">
                  <camunda:script scriptFormat="js">
                    next(null, content.output.message === 'Yes');
                  </camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
          <sequenceFlow id="to-gw" sourceRef="wait" targetRef="gw" />
          <exclusiveGateway id="gw" default="to-end" />
          <sequenceFlow id="backto-task" name="Yes" sourceRef="gw" targetRef="task">
            <conditionExpression xsi:type="tFormalExpression" language="js">next(null, environment.output.continue);</conditionExpression>
          </sequenceFlow>
          <sequenceFlow id="to-end" sourceRef="gw" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;
    });

    let wait;
    let subtaskCount = 0, subsubtaskCount = 0;
    const formatEnd = [];
    When('ran with a collection of 10 items', async () => {
      flow = await testHelpers.getOnifyFlow(source, {
        variables: {
          input: {
            collection: new Array(10).fill(0).map((_, idx) => idx),
          },
        },
        extensions: { forwardFormatting },
      });

      flow.broker.subscribeTmp('event', 'activity.end', (_, msg) => {
        if (msg.content.id === 'subtask') subtaskCount++;
        if (msg.content.id === 'subsubtask') subsubtaskCount++;
      }, { noAck: true });

      flow.broker.subscribeTmp('event', 'format.run.enter.complete', (_, msg) => {
        formatEnd.push(msg.content.id);
      }, { noAck: true });

      wait = flow.waitFor('wait');
      flow.run();
    });

    Then('it waits for succeeding user task', () => {
      return wait;
    });

    And('sub process ran 10 times', () => {
      expect(subtaskCount).to.equal(10);
    });

    And('sub-sub process ran 100 times', () => {
      expect(subsubtaskCount).to.equal(100);
    });

    And('sub process formatting was done once', () => {
      const count = formatEnd.filter((id) => id === 'sub').length;
      expect(count).to.equal(1);
    });

    And('sub-sub process formatting was done 10 times', () => {
      const count = formatEnd.filter((id) => id === 'subsub').length;
      expect(count).to.equal(10);
    });
  });

  Scenario('sub-process is resumed on enter', () => {
    const source = `
    <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="boundaryformatting" isExecutable="true">
        <userTask id="start" />
        <sequenceFlow id="to-sub" sourceRef="start" targetRef="sub" />
        <subProcess id="sub">
          <task id="subtask" />
          <extensionElements>
            <camunda:inputOutput>
              <camunda:outputParameter name="property">\${content.properties.property1}</camunda:outputParameter>
            </camunda:inputOutput>
            <camunda:properties>
              <camunda:property name="property1" value="\${content.state}" />
            </camunda:properties>
          </extensionElements>
        </subProcess>
      </process>
    </definitions>`;

    let flow, stopped;
    When('running flow', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      stopped = flow.waitFor('stop');
      flow.run();
    });

    And('waiting for sub-process enter event', () => {
      const event = flow.getActivityById('sub');
      event.broker.subscribeOnce('event', 'activity.enter', () => flow.execution.stop());
      flow.signal({ id: 'start' });
    });

    let state;
    Then('flow run is stopped and state is saved', async () => {
      await stopped;
      state = flow.getState();
    });

    let end;
    When('flow is recovered and resumed', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      flow.recover(state).resume();

      end = flow.waitFor('end');
    });

    Then('flow run completes', () => {
      return end;
    });

    And('output is as expected', async () => {
      const { output } = (await end).environment;
      expect(output).to.deep.equal({ property: 'start' });
    });
  });
});

/**
 * Format formatting to events
 * @param {import('bpmn-elements').Activity} activity
 */
function forwardFormatting(activity) {
  const broker = activity.broker;

  broker.subscribeTmp('format', 'run.#', (routingKey, msg) => {
    broker.publish('event', 'format.' + routingKey, {id: activity.id, ...msg.content});
  }, { noAck: true });
}
