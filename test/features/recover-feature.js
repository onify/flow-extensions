import testHelpers from '../helpers/testHelpers.js';

Feature('Recover flow', () => {
  Scenario('A flow is recovered with output parameters', () => {
    let source, flow;
    Given('a flow with output parameter', async () => {
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

  Scenario('A flow is recovered with asynchronous script output', () => {
    let source, flow;
    Given('a flow with output parameter', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <userTask id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="result">
                  <camunda:script scriptFormat="javascript">next(null, 'resumed');</camunda:script>
                </camunda:outputParameter>
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

  Scenario('two bound timer events on task', () => {
    let source;
    Given('a task with two boundary timeout events, timeout is interrupting, reminder timer is non-interrupting', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Double-timer-issue" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="double-timeout-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-task" sourceRef="start" targetRef="timers-task" />
          <userTask id="timers-task" />
          <boundaryEvent id="approvalTimeout" attachedToRef="timers-task">
            <timerEventDefinition id="TimerEventDefinition_0">
              <timeDuration xsi:type="tFormalExpression">P3D</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <boundaryEvent id="approvalReminder" cancelActivity="false" attachedToRef="timers-task">
            <timerEventDefinition id="TimerEventDefinition_1">
              <timeDuration xsi:type="tFormalExpression">PT3M</timeDuration>
            </timerEventDefinition>
          </boundaryEvent>
          <sequenceFlow id="to-reminder-email" sourceRef="approvalReminder" targetRef="reminder-email" />
          <sequenceFlow id="to-update-ticket" sourceRef="timers-task" targetRef="update-ticket" />
          <task id="reminder-email" name="Send reminder mail to manager" />
          <task id="update-ticket" name="Update ticket" />
          <sequenceFlow id="to-end-reminder" sourceRef="reminder-email" targetRef="end-reminder" />
          <sequenceFlow id="to-end-timeout" sourceRef="approvalTimeout" targetRef="end-timeout" />
          <endEvent id="end-timeout" />
          <endEvent id="end-reminder" />
        </process>
      </definitions>`;
    });

    let flow, state;
    When('run', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      flow.waitFor('activity.wait', () => {
        state = flow.getState();
      });
      flow.run();
    });

    let postponed;
    Then('timers and user tasks are in waiting', () => {
      postponed = flow.getPostponed();
      expect(postponed).to.have.length(3);
      expect(postponed[0].id).to.equal('approvalTimeout');
      expect(postponed[1].id).to.equal('approvalReminder');
      expect(postponed[2].id).to.equal('timers-task');
    });

    Given('stopped', () => {
      flow.stop();
    });

    When('recovered and resumed', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      flow.resume();
    });

    Then('timers and user tasks are in waiting again', () => {
      postponed = flow.getPostponed();
      expect(postponed).to.have.length(3);
      expect(postponed[0].id).to.equal('approvalTimeout');
      expect(postponed[1].id).to.equal('approvalReminder');
      expect(postponed[2].id).to.equal('timers-task');
    });

    When('reminder times out', () => {
      const timer = flow.environment.timers.executing.find((t) => t.owner.id === 'approvalReminder');
      timer.callback(...timer.args);
    });

    Then('one timer and user tasks are still in waiting', () => {
      postponed = flow.getPostponed();
      expect(postponed).to.have.length(2);
      expect(postponed[0].id).to.equal('approvalTimeout');
      expect(postponed[1].id).to.equal('timers-task');
    });

    Given('stopped', () => {
      state = flow.getState();
      flow.stop();
    });

    const recoveredTimers = [];
    When('recovered and resumed', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);

      flow.broker.subscribeTmp('event', 'activity.timer', (_, msg) => {
        recoveredTimers.push(msg);
      });

      flow.resume();
    });

    Then('non-interrupting timer is not resumed', () => {
      postponed = flow.getPostponed();
      expect(postponed).to.have.length(2);
      expect(postponed[0].id).to.equal('approvalTimeout');
      expect(postponed[1].id).to.equal('timers-task');
    });

    let end;
    When('interrupting timeout timer is canceled', () => {
      postponed = flow.getPostponed();
      expect(postponed).to.have.length(2);
      expect(postponed[0].id).to.equal('approvalTimeout');
      expect(postponed[1].id).to.equal('timers-task');

      end = flow.waitFor('leave');
      postponed[0].getExecuting()[0].cancel();
    });

    Then('run completes', () => {
      return end;
    });

    Given('ran again', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      flow.waitFor('activity.wait', () => {
        state = flow.getState();
      });
      flow.run();
    });

    And('stopped', () => {
      flow.stop();
    });

    And('recovered and resumed', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      flow.resume();
    });

    And('reminder times out and state is saved', () => {
      const timer = flow.environment.timers.executing.find((t) => t.owner.id === 'approvalReminder');
      timer.callback(...timer.args);
      flow.stop();
      state = flow.getState();
    });

    When('user task is signaled', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      flow.resume();

      end = flow.waitFor('end');
      flow.signal({id: 'timers-task'});
    });

    Then('run completes', () => {
      return end;
    });

    Given('ran again', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      flow.waitFor('activity.wait', () => {
        state = flow.getState();
      });
      flow.run();
    });

    And('stopped', () => {
      flow.stop();
    });

    And('recovered and resumed', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      flow.resume();
    });

    When('user task is signaled', () => {
      end = flow.waitFor('end');
      flow.signal({id: 'timers-task'});
    });

    Then('run completes', () => {
      return end;
    });
  });
});
