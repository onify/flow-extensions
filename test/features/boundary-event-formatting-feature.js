import factory from '../helpers/factory.js';
import testHelpers from '../helpers/testHelpers.js';

Feature('Boundary event', () => {
  describe('formatting', () => {
    Scenario('properties and execution listeners', () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="boundaryformatting" isExecutable="true">
          <scriptTask id="script" scriptFormat="js">
            <script>
              next(new Error('foo'));
            </script>
          </scriptTask>
          <boundaryEvent id="bound" attachedToRef="script">
            <errorEventDefinition />
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="start">ignored</camunda:inputParameter>
                <camunda:outputParameter name="result">baz</camunda:outputParameter>
                <camunda:outputParameter name="property">\${content.properties.property1}</camunda:outputParameter>
              </camunda:inputOutput>
              <camunda:executionListener event="start">
                <camunda:script scriptFormat="js">
                  next(null, { startlistener: false });
                </camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="end">
                <camunda:script scriptFormat="js">
                  next(null, { endlistener: true });
                </camunda:script>
              </camunda:executionListener>
              <camunda:properties>
                <camunda:property name="property1" value="1" />
                <camunda:property name="property2" value="2" />
              </camunda:properties>
            </extensionElements>
          </boundaryEvent>
          <sequenceFlow id="to-bound-end" sourceRef="bound" targetRef="bound-end" />
          <endEvent id="bound-end" />
        </process>
      </definitions>`;

      let flow, end;
      When('running flow', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        end = flow.waitFor('end');
        flow.run();
      });

      let ended;
      Then('flow run completes', async () => {
        ended = await end;
      });

      And('end boundary event end formatting was done', () => {
        expect(ended.environment.output).to.deep.equal({ result: 'baz', property: '1' });
      });

      let stop, state;
      When('ran again saving state at script start', () => {
        flow.on('activity.start', (elementApi) => {
          if (elementApi.id === 'script') {
            flow.execution.stop();
          }
        });

        stop = flow.waitFor('stop');

        flow.run();
      });

      Then('flow is stopped and state is saved', async () => {
        await stop;
        state = await flow.getState();
      });

      let recoveredFlow;
      When('flow is recovered and resumed', async () => {
        recoveredFlow = await testHelpers.getOnifyFlow(source);
        recoveredFlow.recover(state);
        end = recoveredFlow.waitFor('end');
        recoveredFlow.resume();
      });

      Then('flow run completes', async () => {
        ended = await end;
      });

      And('end boundary event end formatting was done', () => {
        expect(ended.environment.output).to.deep.equal({ result: 'baz', property: '1' });
      });
    });

    Scenario('boundary event enter formatting fails', () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="boundaryformatting" isExecutable="true">
          <scriptTask id="script" scriptFormat="js">
            <script>
              next(new Error('foo'));
            </script>
          </scriptTask>
          <boundaryEvent id="bound" attachedToRef="script">
            <errorEventDefinition />
            <extensionElements>
              <camunda:properties>
                <camunda:property name="property1" value="\${environment.services.getPrp(}" />
              </camunda:properties>
            </extensionElements>
          </boundaryEvent>
          <sequenceFlow id="to-bound-end" sourceRef="bound" targetRef="bound-end" />
          <endEvent id="bound-end" />
        </process>
      </definitions>`;

      let flow, errored;
      When('running flow', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        errored = flow.waitFor('error');
        flow.run();
      });

      let failedRun;
      Then('flow run fails', async () => {
        failedRun = await errored;
      });

      And('boundary event enter formatting failed', () => {
        expect(failedRun.content.error).to.match(/SyntaxError/);
        expect(failedRun.content.error?.source.content.id).to.equal('bound');
      });
    });

    Scenario('boundary event is resumed on enter', () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="boundaryformatting" isExecutable="true">
          <userTask id="start" />
          <sequenceFlow id="to-task" sourceRef="start" targetRef="task" />
          <userTask id="task" />
          <boundaryEvent id="bound" attachedToRef="task">
            <signalEventDefinition />
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="property">\${content.properties.property1}</camunda:outputParameter>
              </camunda:inputOutput>
              <camunda:properties>
                <camunda:property name="property1" value="\${content.state}" />
              </camunda:properties>
            </extensionElements>
          </boundaryEvent>
          <sequenceFlow id="to-bound-end" sourceRef="bound" targetRef="bound-end" />
          <endEvent id="bound-end" />
        </process>
      </definitions>`;

      let flow, stopped;
      When('running flow with bound signal event', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        stopped = flow.waitFor('stop');
        flow.run();
      });

      And('waiting for boundary event enter event', () => {
        const event = flow.getActivityById('bound');
        event.broker.subscribeOnce('event', 'activity.enter', () => flow.execution.stop());
        flow.signal({ id: 'start' });
      });

      let state;
      Then('flow run is stopped and state is saved', async () => {
        await stopped;
        state = flow.getState();
      });

      let end;
      When('flow is recovered and resumed', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        flow.recover(state).resume();

        end = flow.waitFor('end');
      });

      And('boundary event is signaled', () => {
        flow.signal();
      });

      Then('flow run completes', () => {
        return end;
      });

      And('output is as expected', async () => {
        const { output } = (await end).environment;
        expect(output).to.deep.equal({ property: 'start' });
      });
    });
  });

  describe('execution listeners', () => {
    Scenario('Boundary event start script execution listener throws', () => {
      const source = factory.resource('execution-listener-issue.bpmn');

      let flow, end;
      When('flow with faulty error start boundary event execution listener', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        end = flow.waitFor('end');
        flow.run();
      });

      Then('flow run completes ignoring the error', async () => {
        await end;
      });
    });

    Scenario('Boundary event end script execution listener throws', () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="execlisteners" isExecutable="true">
          <scriptTask id="script">
            <script>
              next(new Error('foo'));
            </script>
          </scriptTask>
          <boundaryEvent id="bound" attachedToRef="script">
            <errorEventDefinition />
            <extensionElements>
              <camunda:executionListener event="end">
                <camunda:script scriptFormat="js">
                  next(null, { endlistener: content.output.data.id });
                </camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </boundaryEvent>
        </process>
      </definitions>`;

      let flow, errored;
      When('flow with faulty error start boundary event execution listener', async () => {
        flow = await testHelpers.getOnifyFlow(source);
        errored = flow.waitFor('error');
        flow.run();
      });

      Then('flow run completes ignoring throwing error', async () => {
        const failure = await errored;
        expect(failure.content.error?.source.content.id).to.equal('bound');
      });
    });
  });
});
