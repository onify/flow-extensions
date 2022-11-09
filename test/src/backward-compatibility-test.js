import {Engine} from 'bpmn-engine';
import {Engine as Engine14} from 'bpmn-engine-14';
import testHelpers from '../helpers/testHelpers';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="Definitions_1" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_0" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="to-get-ticket-status" sourceRef="start" targetRef="get-ticket-status" />
    <boundaryEvent id="err-ticket-status" attachedToRef="get-ticket-status">
      <errorEventDefinition id="ErrorEventDefinition_1" />
    </boundaryEvent>
    <serviceTask id="get-ticket-status" name="Get ticket status">
      <extensionElements>
        <camunda:connector>
          <camunda:inputOutput>
            <camunda:inputParameter name="throwHttpErrors">\${false}</camunda:inputParameter>
            <camunda:inputParameter name="responseType">json</camunda:inputParameter>
            <camunda:inputParameter name="method">GET</camunda:inputParameter>
            <camunda:inputParameter name="url">https://service.now/status</camunda:inputParameter>
          </camunda:inputOutput>
          <camunda:connectorId>httpRequest</camunda:connectorId>
        </camunda:connector>
        <camunda:inputOutput>
          <camunda:outputParameter name="ticketStatus">\${content.output.body.status}</camunda:outputParameter>
        </camunda:inputOutput>
      </extensionElements>
    </serviceTask>
    <sequenceFlow id="from-err-ticket-status" sourceRef="err-ticket-status" targetRef="repeat-1h" />
    <sequenceFlow id="to-ticket-resolved" sourceRef="get-ticket-status" targetRef="ticket-resolved" />
    <exclusiveGateway id="ticket-resolved" name="Ticket resolved?" default="to-repeat-1h" />
    <sequenceFlow id="to-repeat-1h" sourceRef="ticket-resolved" targetRef="repeat-1h" />
    <sequenceFlow id="to-end" sourceRef="ticket-resolved" targetRef="end">
      <conditionExpression xsi:type="tFormalExpression" language="js">next(null,(environment.output.ticketStatus == 7));</conditionExpression>
    </sequenceFlow>
    <intermediateCatchEvent id="repeat-1h" name="Check every hour">
      <timerEventDefinition id="TimerEventDefinition_1">
        <timeDuration xsi:type="tFormalExpression">PT1H</timeDuration>
      </timerEventDefinition>
    </intermediateCatchEvent>
    <sequenceFlow id="from-repeat-1h" sourceRef="repeat-1h" targetRef="get-ticket-status" />
    <endEvent id="end" />
  </process>
</definitions>`;

describe('backward compatibility', () => {
  it('resume state from bpmn-engine@14', async () => {
    const httpRequests = new HttpRequests();

    const extensions = testHelpers.getModdleExtensions();
    const engine14 = new Engine14({
      name: 'engine-14',
      source,
      moddleOptions: await testHelpers.getModdleExtensions(),
      extensions: {onify: extensions},
      ...testHelpers.getFlowOptions('engine-14', {
        services: {
          httpRequest(...args) {
            httpRequests.push(args);
          },
        },
      }),
    });

    const pendingCall14 = httpRequests.waitFor();

    const timer14 = new Promise((resolve) => engine14.broker.subscribeOnce('event', 'activity.timer', (_, msg) => resolve(msg)));
    engine14.execute();

    const call14 = await pendingCall14;
    call14.pop()(null, {
      body: {
        ticketStatus: 0,
      },
    });

    await timer14;

    const state = await engine14.getState();
    await engine14.stop();

    const engine = new Engine({
      name: 'engine-last',
      extensions: {onify: extensions},
      ...testHelpers.getFlowOptions('engine-last', {
        services: {
          httpRequest(...args) {
            httpRequests.push(args);
          },
        },
      }),
    });

    const pendingCall = httpRequests.waitFor();

    const timer = new Promise((resolve) => engine.broker.subscribeOnce('event', 'activity.timer', (_, msg) => resolve(msg)));
    await engine.recover(state).resume();
    await timer;

    expect(engine.environment.timers.executing).to.have.length(1);

    engine.environment.timers.executing[0].callback();

    const callArgs = await pendingCall;
    expect(callArgs[0]).to.deep.equal({
      throwHttpErrors: false,
      responseType: 'json',
      method: 'GET',
      url: 'https://service.now/status',
    });

    await engine.stop();
  });
});

function HttpRequests() {
  this.calls = [];
  this.pending = null;
}

HttpRequests.prototype.push = function push(args) {
  const l = this.calls.push(args);
  let pending;
  if (!(pending = this.pending)) return l;
  this.pending = null;
  this.calls.length = 0;
  pending(args);
  return l;
};

HttpRequests.prototype.waitFor = function waitFor() {
  return new Promise((resolve) => this.pending = resolve);
};
