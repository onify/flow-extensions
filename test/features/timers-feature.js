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

    Then('run is paused at start event', async () => {
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
              <timeCycle xsi:type="tFormalExpression">\${environment.settings.syndays}</timeCycle>
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
