import ServiceExpression from '../../src/ServiceExpression.js';

describe('ServiceExpression', () => {
  it('can be instantiated without new', () => {
    ServiceExpression({
      type: 'bpmn:ServiceTask',
      behaviour: {
        expression: '${expr}',
      },
    });
  });
});
