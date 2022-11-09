import { expect } from 'chai';
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
      flow.once('activity.end', () => {
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
      flow.once('activity.end', () => {
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
    Given('a task with two boundary timeout events, timeout is interrupting, reminder timer is non-interrupting', () => {
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

  Scenario('Recover and resume mid execution', () => {
    let source, flow, options;
    const serviceCalls = [];
    Given('a process with a service task and extensions handling service', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="script-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <serviceTask id="service">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="foo" value="bar"/>
                <camunda:property name="content" value="baz"/>
              </camunda:properties>
              <camunda:inputOutput>
                <camunda:inputParameter name="url">
                  <camunda:script scriptFormat="js">next(null, '/my/items/workspace-1');</camunda:script>
                </camunda:inputParameter>
                <camunda:outputParameter name="result">\${content.output.result.statuscode}</camunda:outputParameter>
              </camunda:inputOutput>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">POST</camunda:inputParameter>
                  <camunda:inputParameter name="url">
                    <camunda:script scriptFormat="js">
                      next(null, content.input.url);
                    </camunda:script>
                  </camunda:inputParameter>
                  <camunda:inputParameter name="json">\${content.properties}</camunda:inputParameter>
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
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      options = {
        services: {
          onifyApiRequest(...args) {
            serviceCalls.push(args);
          },
        },
      };

      flow = await testHelpers.getOnifyFlow(source, options);
    });

    let execution;
    When('started', async () => {
      execution = await flow.run();
    });

    Then('async enter formatting is waiting to complete', () => {
      const [api] = execution.getPostponed();
      expect(api.owner.status).to.equal('executing');
    });

    let state;
    Given('state is saved and run is stopped', () => {
      state = flow.getState();
      flow.stop();
    });

    When('definition recovered and resumed', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state, options);
      execution = await flow.resume();
    });

    let serviceCall;
    Then('service is called', () => {
      expect(serviceCalls).to.have.length(2);
      serviceCall = serviceCalls.pop();
    });

    And('format input is set', () => {
      const [input, msg] = serviceCall;
      expect(input).to.deep.equal({
        method: 'POST',
        url: '/my/items/workspace-1',
        json: { foo: 'bar', content: 'baz' },
      });
      expect(msg.content).to.have.property('input');
      expect(msg.content).to.have.property('properties');
    });

    let end;
    When('service completes', () => {
      end = flow.waitFor('end');
      const callback = serviceCall.pop();
      callback(null, {
        statuscode: 200,
        body: {
          resources: [],
        },
      });
    });

    Then('resumed definition completes', () => {
      return end;
    });

    And('async end formatting is set', () => {
      expect(flow.environment.output).to.have.property('result', 200);
    });
  });

  Scenario('Recover and resume mid formatting', () => {
    let source, flow, options;
    const serviceCalls = [];
    Given('a process with a service task and extensions handling service', async () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="recover-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <serviceTask id="service">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="foo" value="bar"/>
                <camunda:property name="content" value="baz"/>
              </camunda:properties>
              <camunda:inputOutput>
                <camunda:inputParameter name="saveAtStart">
                  <camunda:script scriptFormat="js">
                    environment.services.save('enter', !!fields.redelivered, next);
                  </camunda:script>
                </camunda:inputParameter>
                <camunda:outputParameter name="saveAtEnd">
                  <camunda:script scriptFormat="js">
                    environment.services.save('complete', !!fields.redelivered, next);
                  </camunda:script>
                </camunda:outputParameter>
                <camunda:outputParameter name="result">
                  <camunda:script scriptFormat="js">
                    next(null, content.output.result);
                  </camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
              <camunda:connector>
                <camunda:connectorId>onifyApiRequest</camunda:connectorId>
                <camunda:inputOutput>
                  <camunda:inputParameter name="method">POST</camunda:inputParameter>
                  <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
                  <camunda:inputParameter name="json">\${content.properties}</camunda:inputParameter>
                  <camunda:outputParameter name="result">
                    <camunda:script scriptFormat="js">
                      next(null, {
                        id: content.id,
                        foo: content.properties.foo,
                        statuscode,
                      });
                    </camunda:script>
                  </camunda:outputParameter>
                </camunda:inputOutput>
              </camunda:connector>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      options = {
        services: {
          onifyApiRequest(...args) {
            serviceCalls.push(args);
            args.pop()(null, { statuscode: 200 });
          },
        },
      };

      flow = await testHelpers.getOnifyFlow(source, options);
    });

    let execution, started;
    const states = [];
    When('started', async () => {
      flow.environment.addService('save', async function save(name, isRecovered, next) {
        states.push([name, await flow.getState()]);
        next(null, true);
      });

      started = flow.waitFor('activity.start');
      execution = await flow.run();
    });

    Then('state is saved when enter formatting is pending', async () => {
      await started;
      await execution.stop();
      expect(states).to.have.length.above(0);
      expect(states[0][0]).to.equal('enter');
    });

    let executed;
    When('definition recovered and resumed in enter formatting state', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, states.shift()[1], options);

      flow.environment.addService('save', async function save(name, isRecovered, next) {
        states.push([name, await flow.getState()]);
        next(null, true);
      });

      states.splice(0);
      serviceCalls.splice(0);

      executed = flow.waitFor('activity.execution.completed');

      execution = await flow.resume();
    });

    Then('state is saved when complete formatting is pending', async () => {
      await executed;
      await execution.stop();
      expect(states).to.have.length(2);
      expect(states[0][0]).to.equal('enter');
      expect(states[1][0]).to.equal('complete');
    });

    let serviceCall;
    And('service was called with formatted input', () => {
      expect(serviceCalls).to.have.length(1);
      serviceCall = serviceCalls.pop();

      const [input, msg] = serviceCall;
      expect(input).to.deep.equal({
        method: 'POST',
        url: '/my/items/workspace-1',
        json: { foo: 'bar', content: 'baz' },
      });
      expect(msg.content).to.have.property('input');
      expect(msg.content).to.have.property('properties');
    });

    let end;
    When('definition is recovered and resumed at execution completed formatting state', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, states.pop()[1], options);

      flow.environment.addService('save', function save(name, isRecovered, next) {
        next(null, false);
      });

      serviceCalls.splice(0);

      end = flow.waitFor('end');
      execution = await flow.resume();
    });

    Then('flow completes', () => {
      return end;
    });

    Then('resumed service was not called since it has completed', () => {
      expect(serviceCalls).to.have.length(0);
      serviceCall = serviceCalls.pop();
    });

    And('async end formatting is set', () => {
      expect(flow.environment.output).to.have.property('result').that.deep.equal({ id: 'service', foo: 'bar', statuscode: 200 });
    });
  });
});
