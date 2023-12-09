import { TimerEventDefinition } from 'bpmn-elements';
import cronParser from 'cron-parser';

export class OnifyTimerEventDefinition extends TimerEventDefinition {
  constructor(activity, def) {
    super(activity, def);
    Object.defineProperty(this, 'supports', {
      value: ['cron'],
    });
  }
  parse(timerType, value) {
    let cron;
    if (timerType === 'timeCycle' && (cron = cronParser.parseString(value))) {
      if (cron.expressions?.length) {
        // cronParser.parseString expressions disregards seconds, so we have to parse again
        const expireAt = cronParser.parseExpression(value).next().toDate();
        return {
          expireAt,
          delay: expireAt - Date.now(),
        };
      }
    }
    return super.parse(timerType, value);
  }
}
