import { parseInterval } from '@0dep/piso';
import testHelpers from '../helpers/testHelpers.js';

Feature('Process history ttl', () => {
  Scenario('Flow with process history time to live as number of days', () => {
    let source, flow;
    Given('a source matching scenario', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:historyTimeToLive="180">
          <userTask id="task" />
        </process>
      </definitions>`;
    });

    let serializable;
    When('parsed with extend function', async () => {
      serializable = await testHelpers.parseOnifyFlow(source);
    });

    Then('history ttl timer is registered as duration', () => {
      expect(serializable.elements.timers[0]).to.deep.equal({
        name: 'my-process:historyTimeToLive',
        parent: {
          id: 'my-process',
          type: 'bpmn:Process',
        },
        timer: {
          id: 'bpmn:Process/my-process:historyTimeToLive',
          timerType: 'timeDuration',
          type: 'historyTimeToLive',
          value: 'P180D',
        },
      });
    });

    let started, wait;
    When('started', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      started = flow.waitFor('process.start');
      wait = flow.waitFor('wait');
      flow.run();
    });

    let historyTtl;
    Then('process environment has historyTimeToLive', async () => {
      const bp = await started;
      expect(bp.environment.variables).to.have.property('historyTimeToLive', 'P180D');
      historyTtl = bp.environment.variables.historyTimeToLive;
    });

    And('it is parsable as ISO8601 duration', () => {
      expect(parseInterval(historyTtl).duration.result.D).to.equal(180);
    });

    let processEnd, state;
    When('flow is stopped and resumed', async () => {
      await flow.stop();

      state = await flow.getState();

      processEnd = flow.waitFor('process.end');
      return flow.resume();
    });

    And('task is signaled', async () => {
      await wait;
      flow.signal({ id: 'task' });
    });

    Then('process run completes', async () => {
      const ended = await processEnd;
      expect(ended.environment.variables).to.have.property('historyTimeToLive', historyTtl);
    });

    When('flow is recovered and resumed from stopped state', async () => {
      flow = await testHelpers.recoverOnifyFlow(source, state);
      processEnd = flow.waitFor('process.end');
      return flow.resume();
    });

    And('task is signaled', () => {
      flow.signal({ id: 'task' });
    });

    Then('process run completes', async () => {
      const ended = await processEnd;
      expect(ended.environment.variables).to.have.property('historyTimeToLive', historyTtl);
    });
  });

  Scenario('Flow with process history time to live as negative number of days', () => {
    let source;
    Given('a source matching scenario', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:historyTimeToLive="-1">
          <userTask id="task" />
        </process>
      </definitions>`;
    });

    let serializable;
    When('parsed with extend function', async () => {
      serializable = await testHelpers.parseOnifyFlow(source);
    });

    Then('history ttl timer is registered as 0 days', () => {
      expect(serializable.elements.timers[0]).to.deep.equal({
        name: 'my-process:historyTimeToLive',
        parent: {
          id: 'my-process',
          type: 'bpmn:Process',
        },
        timer: {
          id: 'bpmn:Process/my-process:historyTimeToLive',
          timerType: 'timeDuration',
          type: 'historyTimeToLive',
          value: 'P0D',
        },
      });
    });
  });

  Scenario('Flow with process history time to live as 0', () => {
    let source;
    Given('a source matching scenario', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:historyTimeToLive="0">
          <userTask id="task" />
        </process>
      </definitions>`;
    });

    let serializable;
    When('parsed with extend function', async () => {
      serializable = await testHelpers.parseOnifyFlow(source);
    });

    Then('history ttl timer is registered as 0 days', () => {
      expect(serializable.elements.timers[0]).to.deep.equal({
        name: 'my-process:historyTimeToLive',
        parent: {
          id: 'my-process',
          type: 'bpmn:Process',
        },
        timer: {
          id: 'bpmn:Process/my-process:historyTimeToLive',
          timerType: 'timeDuration',
          type: 'historyTimeToLive',
          value: 'P0D',
        },
      });
    });
  });
});
