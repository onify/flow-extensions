import cronParser from 'cron-parser';
import { TimerEventDefinition } from 'bpmn-elements';

const invalidCronEntryPattern = /Invalid (characters|range)/i;

export class OnifyTimerEventDefinition extends TimerEventDefinition {
  constructor(activity, def) {
    super(activity, def);
    Object.defineProperty(this, 'supports', {
      value: ['cron'],
    });
  }
  parse(timerType, value) {
    if (timerType === 'timeCycle') {
      try {
        return super.parse(timerType, value);
      } catch (err) {
        var rangeError = err;
      }

      try {
        const expireAt = cronParser.parseExpression(value).next().toDate();

        return {
          expireAt,
          delay: expireAt - Date.now(),
        };
      } catch (err) {
        if (invalidCronEntryPattern.test(err.message)) throw rangeError;
        throw err;
      }
    }

    return super.parse(timerType, value);
  }
}
