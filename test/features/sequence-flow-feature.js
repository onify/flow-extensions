import testHelpers from '../helpers/testHelpers.js';
import factory from '../helpers/factory.js';
import { OnifySequenceFlow } from '../../src/index.js';

class Logger {
  constructor() {
    this.errors = [];
  }
  debug() {}
  error(msg) {
    this.errors.push(msg);
  }
  warn() {}
}

Feature('Sequence flow', () => {
  let flowSource;
  before(() => {
    flowSource = factory.resource('sequence-flow-properties.bpmn');
  });

  Scenario('Forward caught error by flow property', () => {
    let engine;
    Given('a flow with catch error boundary event', async () => {
      engine = await testHelpers.getEngine('test', flowSource, {
        elements: {
          SequenceFlow: OnifySequenceFlow,
        },
      });
    });

    let end;
    const leaveMessages = [];
    When('ran with required input', async () => {
      engine.broker.subscribeTmp(
        'event',
        'activity.leave',
        (_, message) => {
          leaveMessages.push(message);
        },
        { noAck: true }
      );

      end = engine.waitFor('end');
      await engine.execute({
        variables: {
          required: {
            input: 1,
          },
        },
      });
    });

    Then('flow run completes', () => {
      return end;
    });

    And('sequence flow properties has been passed to source in message', () => {
      const message = leaveMessages.find((msg) => msg.content.id === 'end');
      expect(message.content.inbound).to.have.length(1);
      const [inbound] = message.content.inbound;
      expect(inbound).to.have.property('properties').that.deep.equal({ foo: 'bar' });
    });

    And('sequence flow execution listener has executed', () => {
      expect(engine.environment.output).to.have.property('fields').that.deep.equal({
        bar: 'baz',
        taken: true,
      });
    });

    When('ran without required input', async () => {
      leaveMessages.splice(0);
      engine = await testHelpers.getEngine('test', flowSource, {
        elements: {
          SequenceFlow: OnifySequenceFlow,
        },
      });

      engine.broker.subscribeTmp(
        'event',
        'activity.leave',
        (_, message) => {
          leaveMessages.push(message);
        },
        { noAck: true }
      );

      end = engine.waitFor('end');
      await engine.execute();
    });

    Then('flow run completes', () => {
      return end;
    });

    And('sequence flow properties has been passed to source in message', () => {
      const message = leaveMessages.find((msg) => msg.content.id === 'end-err');
      expect(message.content.inbound).to.have.length(1);
      const [inbound] = message.content.inbound;
      expect(inbound, 'inbound property error').to.have.property('properties').that.have.property('error').that.is.ok;
    });

    And('sequence flow execution listener has executed', () => {
      expect(engine.environment.output).to.have.property('failedBy');
      expect(engine.environment.output.failedBy).to.match(/FlowScriptError/);
    });
  });

  Scenario('Sequence flow with properties', () => {
    /** @type {import('bpmn-elements').Definition} */
    let flow;
    const messages = [];
    Given('a flow with one conditional sequence flows with properties', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <task id="start" default="to-end-default" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <conditionExpression xsi:type="bpmn:tFormalExpression" language="js">next(null, environment.variables.take)</conditionExpression>
            <extensionElements>
              <camunda:properties>
                <camunda:property name="foo" value="\${true}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <sequenceFlow id="to-end-default" sourceRef="start" targetRef="end-default">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="from" value="\${content.id}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
          <endEvent id="end-default" />
        </process>
       </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      });
    });

    let end;
    When('ran', async () => {
      flow.broker.subscribeTmp(
        'event',
        'activity.enter',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );
      flow.broker.subscribeTmp(
        'event',
        'activity.discard',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow run completes', () => {
      return end;
    });

    And('taken sequence flow was taken with properties', () => {
      const message = messages.find((msg) => msg.content.id === 'end-default' && msg.fields.routingKey === 'activity.enter');
      expect(message.content.inbound[0].properties).to.deep.equal({ from: 'start' });
    });

    And('not taken flow was not discarded and its target was never reached', () => {
      const message = messages.find((msg) => msg.content.id === 'end');
      expect(message, 'no message for end').to.be.undefined;
    });

    When('ran again with options to take conditional flow', async () => {
      messages.splice(0);
      flow.broker.subscribeTmp(
        'event',
        'activity.enter',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );
      flow.broker.subscribeTmp(
        'event',
        'activity.discard',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      end = flow.waitFor('end');
      flow.environment.variables.take = { bar: 'baz' };

      await flow.run();
    });

    Then('flow run completes', () => {
      return end;
    });

    And('conditional taken sequence flow was taken with properties and condition result', () => {
      const message = messages.find((msg) => msg.content.id === 'end' && msg.fields.routingKey === 'activity.enter');
      expect(message.content.inbound[0].properties).to.deep.equal({
        foo: true,
      });
      expect(message.content.inbound[0]).to.have.property('bar', 'baz');
    });

    And('not taken flow was not discarded and its target was never reached', () => {
      const message = messages.find((msg) => msg.content.id === 'end-default');
      expect(message, 'no message for end-default').to.be.undefined;
    });

    Given('flow with condition that address properties', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" default="to-join2">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="\${false}" />
              </camunda:properties>
            </extensionElements>
          </startEvent>
          <sequenceFlow id="to-join1" sourceRef="start" targetRef="join">
            <conditionExpression xsi:type="tFormalExpression" language="js">
              next(null, content.properties.prop1);
            </conditionExpression>
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="\${true}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <sequenceFlow id="to-join2" sourceRef="start" targetRef="join" />
          <parallelGateway id="join" />
          <sequenceFlow id="to-task" sourceRef="join" targetRef="task" />
          <task id="task" default="to-end2" />
          <sequenceFlow id="to-end1" sourceRef="task" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression" language="js">
              next(null, content.inbound[0].result);
            </conditionExpression>
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop2" value="\${true}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <sequenceFlow id="to-end2" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
       </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      });
    });

    let sourceActivity;
    let sourceEnd;
    When('ran', async () => {
      sourceActivity = flow.getActivityById('start');

      sourceEnd = sourceActivity.waitFor('end');

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('expected sequence flow was taken', async () => {
      await end;
      expect(sourceActivity.outbound[0].counters).to.have.property('take', 1);
    });

    And('sequence flow source end message kept property values', async () => {
      const source = await sourceEnd;
      expect(source.content.properties).to.have.property('prop1', false);
    });

    And('second sequence flow that address first sequence flow result was taken', () => {
      expect(flow.getActivityById('join').outbound[0].counters).to.have.property('take', 1);
    });

    Given('a flow with malformatted sequence flow property expression', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="\${(content.id == environment.output.foo.bar}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
       </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      });
    });

    When('ran', async () => {
      end = flow.waitFor('end').catch((err) => err);
      await flow.run();
    });

    Then('flow run fails due to invalid expression', async () => {
      const error = await end;
      expect(error).to.match(/Parser Error/);
    });

    Given('a flow with malformatted sequence flow condition', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <conditionExpression xsi:type="tFormalExpression">\${(content.id == environment.output.foo.bar}</conditionExpression>
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="\${content.id}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
       </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      });
    });

    When('ran', async () => {
      end = flow.waitFor('end').catch((err) => err);
      await flow.run();
    });

    Then('flow run fails due to invalid condition', async () => {
      const error = await end;
      expect(error).to.match(/Parser Error/);
    });
  });

  Scenario('a flow with sequence flow property expression function', () => {
    let source;
    let options;
    let flow;
    Given('a flow matching scenario', () => {
      source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="\${environment.services.propfn(environment.variables)}" />
              </camunda:properties>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
       </definitions>`;

      options = {
        services: {
          propfn(variables) {
            const count = ++variables.count;
            if (count > 2) throw new Error('Testing');
            return true;
          },
        },
        variables: {
          count: 0,
        },
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      };
    });

    let end;
    When('ran', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow completes', () => {
      return end;
    });

    When('ran again and expression property function fails when resolving properties', async () => {
      flow = await testHelpers.getOnifyFlow(source, options);

      flow.environment.variables.count = 2;

      end = flow.waitFor('end').catch((err) => err);

      await flow.run();
    });

    Then('flow run fails due to expression throwing error', async () => {
      const error = await end;
      expect(error).to.match(/Testing/);
    });

    When('ran again and expression property function fails when resolving result', async () => {
      flow = await testHelpers.getOnifyFlow(source, options);

      flow.environment.variables.count = 1;

      end = flow.waitFor('end').catch((err) => err);

      await flow.run();
    });

    Then('flow run fails due to expression throwing error', async () => {
      const error = await end;
      expect(error).to.match(/Testing/);
    });
  });

  Scenario('Sequence flow with execution listeners', () => {
    let flow;
    const calls = [];
    Given('a sequence flow with two take listeners', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="1" />
              </camunda:properties>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">environment.services.call(next)</camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">environment.services.call(content.properties, next)</camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
       </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
      });

      flow.environment.addService('call', function call(...args) {
        const next = args.pop();
        calls.push(args);
        flow.broker.publish('event', 'listener.taken');
        next();
        return Promise.resolve();
      });
    });

    let end, listenersCalled;
    When('ran', async () => {
      listenersCalled = new Promise((resolve) => {
        flow.broker.subscribeTmp(
          'event',
          'listener.taken',
          () => {
            if (calls.length === 2) resolve(calls);
          },
          { noAck: true }
        );
      });

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow run completes', () => {
      return end;
    });

    And('sequence flow listeners were executed', async () => {
      const result = await listenersCalled;
      expect(result.length).to.equal(2);
      expect(result[1][0]).to.have.property('prop1', '1');
    });

    let logger;
    Given('a fast flow with malformatted sequence flow listener', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-end" sourceRef="start" targetRef="end">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="1" />
              </camunda:properties>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">next()</camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">next(null, listener.fields</camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </sequenceFlow>
          <endEvent id="end" />
        </process>
       </definitions>`;

      logger = new Logger();
      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
        Logger() {
          return logger;
        },
      });
    });

    const messages = [];
    When('ran', async () => {
      messages.splice(0);
      flow.broker.subscribeTmp(
        'event',
        'flow.#',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow run completes without catching error due to the async nature of scripts', () => {
      return end;
    });

    And('sequence flow was taken', () => {
      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'flow.take');
    });

    And('error was logged', () => {
      expect(logger.errors[0]).to.match(/SyntaxError/);
    });

    Given('a asynchronous flow with malformatted sequence flow listener', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-task" sourceRef="start" targetRef="task">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="1" />
              </camunda:properties>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">next()</camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">next(null, listener.fields</camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </sequenceFlow>
          <userTask id="task" />
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
       </definitions>`;

      logger = new Logger();
      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
        Logger() {
          return logger;
        },
      });
    });

    let wait;
    When('ran', async () => {
      messages.splice(0);

      wait = flow.waitFor('wait');

      flow.broker.subscribeTmp(
        'event',
        'flow.#',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow is waiting for task', () => {
      return wait;
    });

    And('sequence flow was taken', () => {
      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'flow.take');
    });

    And('error was logged', () => {
      expect(logger.errors[0]).to.match(/SyntaxError/);
    });

    When('task is signalled', () => {
      flow.signal({ id: 'task' });
    });

    Then('flow run completes', () => {
      return end;
    });

    Given('a asynchronous flow with sequence flow listener that returns error in next', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-task" sourceRef="start" targetRef="task">
            <extensionElements>
              <camunda:properties>
                <camunda:property name="prop1" value="1" />
              </camunda:properties>
              <camunda:executionListener event="take">
                <camunda:script scriptFormat="js">next(new Error('failed'));</camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </sequenceFlow>
          <userTask id="task" />
          <sequenceFlow id="to-end" sourceRef="task" targetRef="end" />
          <endEvent id="end" />
        </process>
       </definitions>`;

      logger = new Logger();
      flow = await testHelpers.getOnifyFlow(source, {
        types: {
          SequenceFlow: OnifySequenceFlow,
        },
        Logger() {
          return logger;
        },
      });
    });

    When('ran', async () => {
      messages.splice(0);

      wait = flow.waitFor('wait');

      flow.broker.subscribeTmp(
        'event',
        'flow.#',
        (_, msg) => {
          messages.push(msg);
        },
        { noAck: true }
      );

      end = flow.waitFor('end');
      await flow.run();
    });

    Then('flow is waiting for task', () => {
      return wait;
    });

    And('sequence flow was taken', () => {
      expect(messages.length).to.equal(1);
      expect(messages[0].fields).to.have.property('routingKey', 'flow.take');
    });

    And('error was logged', () => {
      expect(logger.errors[0]).to.match(/failed/);
    });

    When('task is signalled', () => {
      flow.signal({ id: 'task' });
    });

    Then('flow run completes', () => {
      return end;
    });
  });
});
