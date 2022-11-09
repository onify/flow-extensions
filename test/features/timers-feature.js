import ck from 'chronokinesis';
import testHelpers from '../helpers/testHelpers.js';
import factory from '../helpers/factory.js';

Feature('Flow timers', () => {
  let blueprintSource;
  before(() => {
    blueprintSource = factory.resource('activedirectory-index-users.bpmn');
  });
  after(ck.reset);

  Scenario('Scheduled flow with cron', () => {
    let flow;
    Given('a flow with starting cron event every night at midnight', async () => {
      flow = await testHelpers.getOnifyFlow(blueprintSource);
    });

    When('started', () => {
      ck.freeze(Date.UTC(2022, 1, 14, 12, 0));
      flow.run();
    });

    let element;
    Then('run is paused at start event', () => {
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:StartEvent');
    });

    let timer;
    And('a timer is registered', () => {
      [timer] = flow.environment.timers.executing;
      expect(timer.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 15) - new Date().getTime());
    });

    When('cron start event is cancelled', () => {
      flow.cancelActivity({id: element.id});
    });

    Then('flow continues run', () => {
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:ServiceTask');
    });
  });

  Scenario('Scheduled flow with date', () => {
    let flow;
    Given('a flow with starting date event', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="startdate">
            <timerEventDefinition>
              <timeDate xsi:type="tFormalExpression">2022-02-15T00:00Z</timeDate>
            </timerEventDefinition>
          </startEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('started', () => {
      ck.freeze(Date.UTC(2022, 1, 14, 12, 0));
      flow.run();
    });

    let element;
    Then('run is paused at start event', () => {
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:StartEvent');
    });

    let timer;
    And('a timer is registered', () => {
      [timer] = flow.environment.timers.executing;
      expect(timer.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 15) - new Date().getTime());
    });

    let end;
    When('start event is cancelled', () => {
      end = flow.waitFor('end');
      flow.cancelActivity({id: element.id});
    });

    Then('flow completes', () => {
      return end;
    });
  });

  Scenario('Multiple start timers', () => {
    let flow;
    Given('a flow with starting date and duration event', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="startdate">
            <timerEventDefinition>
              <timeDate xsi:type="tFormalExpression">2022-02-15T00:00Z</timeDate>
            </timerEventDefinition>
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT1H</timeDuration>
            </timerEventDefinition>
          </startEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let wait;
    When('started', () => {
      ck.freeze(Date.UTC(2022, 1, 14, 12, 30));
      wait = flow.waitFor('activity.timer');
      flow.run();
    });

    let element;
    Then('run is paused at start event', async () => {
      await wait;
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:StartEvent');
    });

    let timer1, timer2;
    And('two timers are registered', () => {
      [timer1, timer2] = flow.environment.timers.executing;
      expect(timer1.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 15) - new Date().getTime());
      expect(timer2.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 14, 13, 30) - new Date().getTime());
    });

    let end;
    When('start event is cancelled', () => {
      end = flow.waitFor('end');
      flow.cancelActivity({id: element.id});
    });

    Then('flow completes', () => {
      return end;
    });

    Given('a flow with multiple starting cron event', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="startdate">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">0 1 * * *</timeCycle>
            </timerEventDefinition>
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">* */3 * * *</timeCycle>
            </timerEventDefinition>
            <documentation>Glockenspiel</documentation>
          </startEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('started', () => {
      flow.run();
    });

    Then('run is paused at start event', () => {
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:StartEvent');
      expect(element.content).to.have.property('description', 'Glockenspiel');
    });

    And('expire at is set at nearest occasion', () => {
      expect(element.content).to.have.property('expireAt').that.deep.equal(new Date(Date.UTC(2022, 1, 14, 14)));
    });

    When('start event is cancelled', () => {
      end = flow.waitFor('end');
      flow.cancelActivity({id: element.id});
    });

    Then('flow completes', () => {
      return end;
    });
  });

  Scenario('Time cycle expression', () => {
    let flow;
    Given('a flow with cron expressions', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="start" />
          <intermediateThrowEvent id="timer">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">\${environment.settings.postpone}</timeCycle>
            </timerEventDefinition>
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">\${environment.settings.saturdays}</timeCycle>
            </timerEventDefinition>
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">\${environment.settings.tuesdays}</timeCycle>
            </timerEventDefinition>
          </intermediateThrowEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        settings: {
          postpone: '0 1 * * *',
          tuesdays: '* * * * 2',
          saturdays: '0 0 * * SAT',
        },
      });
    });

    let wait;
    When('started', () => {
      ck.freeze(Date.UTC(2022, 1, 12, 12, 30));
      wait = flow.waitFor('activity.timer');
      flow.run();
    });

    let element;
    Then('run is paused', async () => {
      await wait;
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:IntermediateThrowEvent');
    });

    let timer;
    And('a timer is registered with nearest date', () => {
      [timer] = flow.environment.timers.executing;
      expect(timer.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 13) - new Date().getTime());
    });
  });

  Scenario('Duration and cycle combo', () => {
    let flow;
    Given('a flow with cron and duration', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="start" />
          <intermediateThrowEvent id="timer">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">\${environment.settings.postpone}</timeCycle>
            </timerEventDefinition>
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">PT1H</timeDuration>
            </timerEventDefinition>
          </intermediateThrowEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        settings: {
          postpone: '0 1 * * *',
        },
      });
    });

    let wait;
    When('started', () => {
      ck.freeze(Date.UTC(2022, 1, 12, 12, 30));
      wait = flow.waitFor('activity.timer');
      flow.run();
    });

    let element;
    Then('run is paused', async () => {
      await wait;
      [element] = flow.getPostponed();
      expect(element.type).to.equal('bpmn:IntermediateThrowEvent');
    });

    let timer;
    And('unfortunately a timer is registered with cron expiration (fix in bpmn-elements)', () => {
      [timer] = flow.environment.timers.executing;
      expect(timer.delay).to.be.above(0).and.equal(Date.UTC(2022, 1, 13) - new Date().getTime());
    });
  });

  Scenario('Bound activity non-interrupting timer cycle', () => {
    let flow;
    Given('a task with a bound non-interrupting repeated timer cycle', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        id="Definitions_1l30pnv" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="Process_0cn5rdh" isExecutable="true">
          <startEvent id="start-cycle" />
          <sequenceFlow id="to-task" sourceRef="start-cycle" targetRef="task" />
          <manualTask id="task" />
          <boundaryEvent id="bound-cycle" cancelActivity="false" attachedToRef="task">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">R3/PT1M</timeCycle>
            </timerEventDefinition>
          </boundaryEvent>
          <sequenceFlow id="to-cycle-end" sourceRef="bound-cycle" targetRef="cycle-end" />
          <endEvent id="cycle-end" />
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let timer;
    When('definition is ran', () => {
      timer = flow.waitFor('activity.timer');
      flow.run();
    });

    let activity;
    Then('the bound cycle event is waiting', async () => {
      await timer;
      [activity] = flow.getPostponed();
      expect(activity).to.have.property('id', 'bound-cycle');
    });

    And('time cycle is executing', () => {
      const [execution] = activity.getExecuting();
      expect(execution.content).to.have.property('timeCycle', 'R3/PT1M');
    });

    When('cycle times out', () => {
      flow.environment.timers.executing[0].callback();
    });

    Then('bound outbound flows are taken', () => {
      expect(flow.getActivityById('cycle-end').counters).to.have.property('taken', 1);
    });

    And('time cycle is still executing', () => {
      expect(flow.environment.timers.executing).to.have.length(1);

      [, activity] = flow.getPostponed();
      expect(activity).to.have.property('id', 'bound-cycle');
      const [execution] = activity.getExecuting();
      expect(execution.content).to.have.property('timeCycle', 'R3/PT1M');
      expect(execution.content).to.have.property('repeat', 2);
    });

    When('cycle times out a second time', () => {
      flow.environment.timers.executing[0].callback();
    });

    Then('bound outbound flows are taken', () => {
      expect(flow.getActivityById('cycle-end').counters).to.have.property('taken', 2);
    });

    And('time cycle is still executing', () => {
      expect(flow.environment.timers.executing).to.have.length(1);

      [, activity] = flow.getPostponed();
      expect(activity).to.have.property('id', 'bound-cycle');
      const [execution] = activity.getExecuting();
      expect(execution.content).to.have.property('timeCycle', 'R3/PT1M');
      expect(execution.content).to.have.property('repeat', 1);
    });

    When('cycle times out a third time', () => {
      flow.environment.timers.executing[0].callback();
    });

    Then('bound outbound flows are taken', () => {
      expect(flow.getActivityById('cycle-end').counters).to.have.property('taken', 3);
    });

    And('time cycle has completed', () => {
      expect(flow.environment.timers.executing).to.have.length(0);

      const postponed = flow.getPostponed();
      expect(postponed.length).to.equal(1);
      expect(postponed[0]).to.have.property('id', 'task');
    });

    let end;
    When('task is signaled', () => {
      end = flow.waitFor('leave');
      flow.signal({id: 'task'});
    });

    Then('run completes', () => {
      return end;
    });

    When('flow is ran again', () => {
      flow.run();
    });

    Then('the bound cycle event is waiting', () => {
      [activity] = flow.getPostponed();
      expect(activity).to.have.property('id', 'bound-cycle');
    });

    And('time cycle is executing', () => {
      const [execution] = activity.getExecuting();
      expect(execution.content).to.have.property('timeCycle', 'R3/PT1M');
    });

    When('cycle times out', () => {
      flow.environment.timers.executing[0].callback();
      flow.cancelActivity({id: 'start-cycle'});
    });

    When('task is signaled', () => {
      end = flow.waitFor('leave');
      flow.signal({id: 'task'});
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('Time cycle with ISO8601 duration', () => {
    let flow;
    Given('a task with a bound non-interrupting timer cycle with duration', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        id="Definitions_1l30pnv" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="Process_0cn5rdh" isExecutable="true">
          <startEvent id="start-cycle" />
          <sequenceFlow id="to-task" sourceRef="start-cycle" targetRef="task" />
          <manualTask id="task" />
          <boundaryEvent id="bound-cycle" cancelActivity="false" attachedToRef="task">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">PT1M</timeCycle>
            </timerEventDefinition>
          </boundaryEvent>
          <sequenceFlow id="to-cycle-end" sourceRef="bound-cycle" targetRef="cycle-end" />
          <endEvent id="cycle-end" />
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let timer, end;
    When('definition is ran', () => {
      timer = flow.waitFor('activity.timer');
      end = flow.waitFor('leave');
      flow.run();
    });

    let activity;
    Then('the bound cycle event is waiting', async () => {
      await timer;
      [activity] = flow.getPostponed();
      expect(activity).to.have.property('id', 'bound-cycle');
    });

    And('time cycle is executing', () => {
      const [execution] = activity.getExecuting();
      expect(execution.content).to.have.property('timeCycle', 'PT1M');
    });

    When('cycle times out', () => {
      flow.environment.timers.executing[0].callback();
    });

    And('task is signaled', () => {
      flow.signal({id: 'task'});
    });

    Then('flow completes', () => {
      return end;
    });
  });

  Scenario('Invalid cron', () => {
    let flow;
    Given('a flow with an invalid starting cron', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="start">
            <timerEventDefinition>
              <timeCycle xsi:type="tFormalExpression">how?</timeCycle>
            </timerEventDefinition>
          </startEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('an error is thrown', async () => {
      const err = await error;
      expect(err.content.error).to.match(/Validation error/);
    });
  });

  Scenario('Invalid duration expression', () => {
    let flow;
    Given('a flow with an invalid time duration expression', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <startEvent id="start">
            <timerEventDefinition>
              <timeDuration xsi:type="tFormalExpression">\${content.dur) + 'S'}</timeDuration>
            </timerEventDefinition>
          </startEvent>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('an error is thrown', async () => {
      const err = await error;
      expect(err.content.error).to.match(/SyntaxError/);
    });
  });
});
