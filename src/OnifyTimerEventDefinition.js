import { Cron } from 'croner';
import { TimerEventDefinition } from 'bpmn-elements';

export class OnifyTimerEventDefinition extends TimerEventDefinition {
  /**
   * Supported timeCycle formats
   * @returns {string[]}
   */
  get supports() {
    return ['cron', 'iso8601'];
  }
  /**
   * @param {import('bpmn-elements').TimerType} timerType
   * @param {string} value
   * @returns {import('bpmn-elements').parsedTimer}
   */
  parse(timerType, value) {
    if (timerType === 'timeCycle') {
      try {
        return super.parse(timerType, value);
      } catch (err) {
        var rangeError = err;
      }

      try {
        const expireAt = new Cron(value).nextRun();

        return {
          expireAt,
          delay: expireAt - Date.now(),
        };
      } catch (err) {
        this.logger.error(`<${this.activity?.id}> failed to parse timeCycle: ${rangeError.message}`);
        this.logger.error(`<${this.activity?.id}> failed to parse timeCycle as cron: ${err.message}`);

        throw new RangeError(`Failed to parse timeCycle <${value?.substring(0, 255)}> as ISO 8601 interval or cron`, { cause: err });
      }
    }

    return super.parse(timerType, value);
  }
}
