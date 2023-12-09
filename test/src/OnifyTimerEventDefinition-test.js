import {Environment} from 'bpmn-elements';
import * as ck from 'chronokinesis';
import {Engine} from 'bpmn-engine';
import * as bpmnElements from 'bpmn-elements';
import * as bpmnElements8 from 'bpmn-elements-8-1';

import {OnifyTimerEventDefinition} from '../../src/OnifyTimerEventDefinition.js';

class TimerEventDefinition8Overload extends bpmnElements8.TimerEventDefinition {
  parse() {
    throw new Error('Not implemented');
  }
}

describe('OnifyTimerEventDefinition', () => {
  let def;
  before(() => {
    def = new OnifyTimerEventDefinition({
      environment: new Environment(),
    }, {
      type: 'bpmn:TimerEventDefinition',
    });
  });
  afterEach(ck.reset);

  describe('engine', () => {
    const source = `
    <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <process id="process-1" name="Onify Flow" isExecutable="true">
        <startEvent id="startdate">
          <timerEventDefinition>
            <timeCycle xsi:type="tFormalExpression">\${environment.variables.cron}</timeCycle>
          </timerEventDefinition>
        </startEvent>
      </process>
    </definitions>`;

    it('parses cron when using extended TimerEventDefinition', async () => {
      const engine = new Engine({
        source,
        elements: {
          ...bpmnElements,
          TimerEventDefinition: OnifyTimerEventDefinition,
        },
        variables: {
          cron: '* * * * *',
        },
      });

      ck.freeze(Date.UTC(2023, 4, 27));
      const execution = await engine.execute();

      const [activityApi] = execution.getPostponed();
      expect(activityApi.getExecuting()[0].content).to.have.property('timeout', 60000);

      engine.stop();
    });

    it('ignores cron parse if bpmn-elements < 10 is used', async () => {
      const engine = new Engine({
        source,
        elements: {
          ...bpmnElements8,
          TimerEventDefinition: TimerEventDefinition8Overload,
        },
        variables: {
          cron: '* * * * *',
        },
      });

      ck.freeze(Date.UTC(2023, 4, 27));
      const execution = await engine.execute();

      const [activityApi] = execution.getPostponed();
      expect(activityApi.getExecuting()[0].content).to.not.have.property('timeout');

      engine.stop();
    });
  });

  describe('parse overload', () => {
    it('parses standard cron time cycle', () => {
      ck.freeze(Date.UTC(2023, 4, 27));
      expect(def.parse('timeCycle', '* * * * *')).to.deep.equal({delay: 60000, expireAt: new Date('2023-05-27T00:01:00.000Z')});
    });

    it('parses fractional cron time cycle', () => {
      ck.freeze(Date.UTC(2023, 4, 27));
      expect(def.parse('timeCycle', '*/5 * * * * *')).to.deep.equal({delay: 5000, expireAt: new Date('2023-05-27T00:00:05.000Z')});
    });

    it('parses every 5 minutes cron time cycle', () => {
      ck.freeze(Date.UTC(2023, 4, 27));
      expect(def.parse('timeCycle', '*/5 * * * *')).to.deep.equal({delay: 300000, expireAt: new Date('2023-05-27T00:05:00.000Z')});
    });

    it('returns ISO duration if no cron match', () => {
      ck.freeze(Date.UTC(2023, 4, 27));
      expect(def.parse('timeCycle', 'PT10S')).to.deep.contain({delay: 10000, expireAt: new Date('2023-05-27T00:00:10.000Z')});
    });

    it('throws if invalid time cycle', () => {
      ck.freeze(Date.UTC(2023, 4, 27));
      expect(() => {
        def.parse('timeCycle', 'yesterday');
      }).to.throw('invalid');
    });
  });
});
