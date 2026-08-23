import { extendFn } from '../../src/index.js';
import { getExtensions } from '../../src/getExtensions.js';
import { InputOutput } from '../../src/IO.js';

describe('defensive loading of extensions', () => {
  describe('extendFn(behaviour, context)', () => {
    let addedScripts, addedTimers, context;
    beforeEach(() => {
      addedScripts = [];
      addedTimers = [];
      context = {
        addScript(id, script) {
          addedScripts.push({ id, script });
        },
        addTimer(id, timer) {
          addedTimers.push({ id, timer });
        },
      };
    });

    it('ignores start event with non-array eventDefinitions', () => {
      const behaviour = { $type: 'bpmn:StartEvent', id: 'start', eventDefinitions: {} };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(behaviour).to.not.have.property('scheduledStart');
    });

    it('ignores nullish entries in start event eventDefinitions', () => {
      const behaviour = {
        $type: 'bpmn:StartEvent',
        id: 'start',
        eventDefinitions: [
          null,
          undefined,
          { type: 'bpmn:TimerEventDefinition' },
          { type: 'bpmn:TimerEventDefinition', behaviour: { timeCycle: '0 1 * * *' } },
        ],
      };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(behaviour).to.have.property('scheduledStart', '0 1 * * *');
    });

    it('ignores nullish entries in extension elements values', () => {
      const behaviour = {
        $type: 'bpmn:ServiceTask',
        id: 'task',
        extensionElements: {
          values: [
            null,
            undefined,
            {
              $type: 'camunda:InputOutput',
              inputParameters: [
                {
                  $type: 'camunda:InputParameter',
                  name: 'in',
                  definition: { $type: 'camunda:Script', scriptFormat: 'js', value: 'next(null, 1);' },
                },
              ],
            },
          ],
        },
      };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(addedScripts).to.have.length(1);
    });

    it('ignores non-array extension elements values', () => {
      const behaviour = {
        $type: 'bpmn:ServiceTask',
        id: 'task',
        extensionElements: { values: {} },
      };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(addedScripts).to.have.length(0);
    });

    it('ignores input output with nullish and non-array parameters', () => {
      const behaviour = {
        $type: 'bpmn:ServiceTask',
        id: 'task',
        extensionElements: {
          values: [
            { $type: 'camunda:InputOutput', inputParameters: null, outputParameters: {} },
            { $type: 'camunda:InputOutput', inputParameters: [null, undefined, { $type: 'camunda:InputParameter', name: 'in' }] },
          ],
        },
      };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(addedScripts).to.have.length(0);
    });

    it('ignores connector without input output', () => {
      const behaviour = {
        $type: 'bpmn:ServiceTask',
        id: 'task',
        extensionElements: { values: [{ $type: 'camunda:Connector', connectorId: 'apiRequest' }] },
      };
      expect(() => extendFn(behaviour, context)).to.not.throw();
      expect(addedScripts).to.have.length(0);
    });
  });

  describe('getExtensions(element, context)', () => {
    function getElement(extensionValues) {
      return {
        id: 'task',
        type: 'bpmn:ServiceTask',
        behaviour: {
          ...(extensionValues !== undefined && { extensionElements: { values: extensionValues } }),
        },
      };
    }

    it('handles element without extension elements', () => {
      const result = getExtensions(getElement(), {});
      expect(result).to.have.property('format');
      expect(result).to.not.have.property('io');
    });

    it('ignores non-array extension elements values', () => {
      expect(() => getExtensions(getElement({}), {})).to.not.throw();
    });

    it('ignores nullish entries in extension elements values', () => {
      const result = getExtensions(getElement([null, undefined, { $type: 'camunda:InputOutput' }]), {});
      expect(result).to.have.property('io');
    });

    it('ignores properties and form data without content', () => {
      const result = getExtensions(getElement([{ $type: 'camunda:Properties' }, { $type: 'camunda:FormData' }]), {});
      expect(result).to.not.have.property('properties');
      expect(result).to.not.have.property('form');
    });
  });

  describe('InputOutput', () => {
    it('handles nullish behaviour', () => {
      const io = new InputOutput('task', null, {});
      expect(io.input).to.deep.equal([]);
      expect(io.output).to.deep.equal([]);
    });

    it('ignores non-array parameters', () => {
      const io = new InputOutput('task', { inputParameters: {}, outputParameters: 'foo' }, {});
      expect(io.input).to.deep.equal([]);
      expect(io.output).to.deep.equal([]);
    });

    it('ignores nullish parameter entries', () => {
      const io = new InputOutput(
        'task',
        { inputParameters: [null, undefined, { $type: 'camunda:InputParameter', name: 'in', value: '${true}' }] },
        {}
      );
      expect(io.input).to.have.length(1);
    });
  });
});
