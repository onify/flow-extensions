import ServiceExpression from '../../src/ServiceExpression';

describe('ServiceExpression', () => {
  it('can be instantiated without new', () => {
    ServiceExpression({
      type: 'bpmn:ServiceTask',
      behaviour: {
        expression: '${expr}'
      }
    });
  });
});
