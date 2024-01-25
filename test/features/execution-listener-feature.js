import { Serializer, TypeResolver } from 'moddle-context-serializer';
import { extendFn } from '../../src/index.js';
import * as Elements from 'bpmn-elements';
import factory from '../helpers/factory.js';
import testHelpers from '../helpers/testHelpers.js';

const listenerSource = factory.resource('execution-listener.bpmn');

Feature('execution listeners', () => {
  Scenario('Task with start and end execution listener', () => {
    let end, flow;
    When('executed', async () => {
      flow = await testHelpers.getOnifyFlow(listenerSource);
      end = flow.waitFor('end');
      flow.run();
    });

    Then('execution listeners has executed', async () => {
      const execution = await end;
      expect(execution.environment.output).to.deep.equal({
        taskend: true,
        aftertaskend: true,
        output: { task: '1', success: true },
      });
    });

    let serialized, moddleContext;
    Given('a bpmn source with execution listeners', async () => {
      moddleContext = await testHelpers.moddleContext(listenerSource, await testHelpers.getModdleExtensions());
    });

    When('serialized', () => {
      serialized = Serializer(moddleContext, TypeResolver(Elements), extendFn);
    });

    Then('all scripts are registered', () => {
      expect(serialized.elements.scripts).to.have.length(6);
    });

    And('registered script end event execution listener script', () => {
      const registered = serialized.elements.scripts.filter((s) => s.parent.id === 'end');
      expect(registered).to.have.length(2);

      expect(registered[0]).to.have.property('name', 'end/camunda:ExecutionListener/start/0');
      expect(registered[0]).to.have.property('parent').that.deep.equal({
        id: 'end',
        type: 'bpmn:EndEvent',
      });
      expect(registered[0].script).to.have.property('scriptFormat', 'js');
      expect(registered[0].script).to.have.property('body').that.is.ok;

      expect(registered[1]).to.have.property('name', 'end/camunda:ExecutionListener/end/2');
      expect(registered[1]).to.have.property('parent').that.deep.equal({
        id: 'end',
        type: 'bpmn:EndEvent',
      });
      expect(registered[1].script).to.have.property('scriptFormat', 'js');
      expect(registered[1].script).to.have.property('resource', './listener-script.fjs');
    });

    And('registered task execution listener scripts', () => {
      const registered = serialized.elements.scripts.filter((s) => s.parent.id === 'task');
      expect(registered).to.have.length(2);

      expect(registered[0]).to.have.property('name', 'task/camunda:ExecutionListener/start/0');
      expect(registered[0]).to.have.property('parent').that.deep.equal({
        id: 'task',
        type: 'bpmn:Task',
      });
      expect(registered[0].script).to.have.property('scriptFormat');
      expect(registered[0].script).to.have.property('body');

      expect(registered[1]).to.have.property('name', 'task/camunda:ExecutionListener/end/1');
      expect(registered[1]).to.have.property('parent').that.deep.equal({
        id: 'task',
        type: 'bpmn:Task',
      });
      expect(registered[1].script).to.have.property('scriptFormat');
      expect(registered[1].script).to.have.property('body');
    });

    And('registered process execution listener script (not used)', () => {
      const registered = serialized.elements.scripts.filter((s) => s.parent.id === 'execlisteners');
      expect(registered).to.have.length(2);

      expect(registered[0]).to.have.property('name', 'execlisteners/camunda:ExecutionListener/start/0');
      expect(registered[0]).to.have.property('parent').that.deep.equal({
        id: 'execlisteners',
        type: 'bpmn:Process',
      });
      expect(registered[0].script).to.have.property('scriptFormat', 'js');
      expect(registered[0].script).to.have.property('body').that.is.ok;

      expect(registered[1]).to.have.property('name', 'execlisteners/camunda:ExecutionListener/end/1');
      expect(registered[1]).to.have.property('parent').that.deep.equal({
        id: 'execlisteners',
        type: 'bpmn:Process',
      });
      expect(registered[1].script).to.have.property('scriptFormat', 'js');
      expect(registered[1].script).to.have.property('body').that.is.ok;
    });
  });

  Scenario('Sub process execution listener script', () => {
    let flow, end;
    const events = [];
    When('sub process runs with execution listeners', async () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="execlisteners" isExecutable="true">
          <subProcess id="sub">
            <task id="task">
              <extensionElements>
                <camunda:executionListener event="start">
                  <camunda:script scriptFormat="js">
                    environment.services.trigger(content.id, 'start');
                    next();
                  </camunda:script>
                </camunda:executionListener>
                <camunda:executionListener event="end">
                  <camunda:script scriptFormat="js">
                    environment.services.trigger(content.id, 'end');
                    next();
                  </camunda:script>
                </camunda:executionListener>
              </extensionElements>
            </task>
            <extensionElements>
              <camunda:executionListener event="start">
                <camunda:script scriptFormat="js">
                  environment.services.trigger(content.id, 'start');
                  next();
                </camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="end">
                <camunda:script scriptFormat="js">
                  environment.services.trigger(content.id, 'end');
                  next();
                </camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </subProcess>
        </process>
      </definitions>`;
      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          trigger(id, event) {
            events.push(id + event);
          },
        },
      });
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes triggering sub process execution listeners once', async () => {
      await end;
      expect(events).to.deep.equal(['substart', 'taskstart', 'taskend', 'subend']);
    });

    When('multi-instance sub process runs with execution listeners', async () => {
      const source = `
      <definitions id="def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="execlisteners" isExecutable="true">
          <subProcess id="sub">
            <bpmn:multiInstanceLoopCharacteristics isSequential="true" camunda:collection="\${environment.variables.list}" />
            <task id="task">
              <extensionElements>
                <camunda:executionListener event="start">
                  <camunda:script scriptFormat="js">
                    environment.services.trigger(content.id, 'start');
                    next();
                  </camunda:script>
                </camunda:executionListener>
                <camunda:executionListener event="end">
                  <camunda:script scriptFormat="js">
                    environment.services.trigger(content.id, 'end');
                    next();
                  </camunda:script>
                </camunda:executionListener>
              </extensionElements>
            </task>
            <extensionElements>
              <camunda:executionListener event="start">
                <camunda:script scriptFormat="js">
                  environment.services.trigger(content.id, 'start');
                  next();
                </camunda:script>
              </camunda:executionListener>
              <camunda:executionListener event="end">
                <camunda:script scriptFormat="js">
                  environment.services.trigger(content.id, 'end');
                  next();
                </camunda:script>
              </camunda:executionListener>
            </extensionElements>
          </subProcess>
        </process>
      </definitions>`;

      events.splice(0);

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          trigger(id, event) {
            events.push(id + event);
          },
        },
        variables: {
          list: [1, 2],
        },
      });
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes triggering sub process execution listeners once', async () => {
      await end;
      expect(events).to.deep.equal(['substart', 'taskstart', 'taskend', 'taskstart', 'taskend', 'subend']);
    });
  });

  Scenario('Script execution listener throws', () => {
    const source = `
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Def_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="execlisteners" isExecutable="true">
        <bpmn:task id="task">
          <bpmn:extensionElements>
            <camunda:executionListener event="end">
              <camunda:script scriptFormat="js">
                environment.output.success = listener.fields.success;
                next();
              </camunda:script>
            </camunda:executionListener>
          </bpmn:extensionElements>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
    `;

    let flow, error;
    When('flow addressing non existing sub property in execution listener', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      error = flow.waitFor('error');
      flow.run();
    });

    Then('execution listeners throws', async () => {
      const err = (await error).content.error;
      expect(err.inner.toString()).to.contain('Def_1/camunda:ExecutionListener/task/camunda:Script/end/0');
    });
  });

  Scenario('Script resource execution listener throws', () => {
    const source = `
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Def_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="execlisteners" isExecutable="true">
        <bpmn:task id="task">
          <bpmn:extensionElements>
            <camunda:executionListener event="start">
              <camunda:script scriptFormat="js" resource="./listener-script.fjs" />
            </camunda:executionListener>
          </bpmn:extensionElements>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
    `;

    let flow, error;
    When('flow addressing non existing sub property in execution listener resource', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      error = flow.waitFor('error');
      flow.run();
    });

    Then('execution listeners throws', async () => {
      const err = (await error).content.error;
      expect(err.inner.toString()).to.contain('Def_1/camunda:ExecutionListener/task/camunda:Script/start/0/./listener-script.fjs');
    });
  });

  Scenario('Expression execution listener throws', () => {
    const source = `
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Def_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="execlisteners" isExecutable="true">
        <bpmn:task id="task">
          <bpmn:extensionElements>
            <camunda:executionListener expression="\${fields.foo['bar]}" event="start">
              <camunda:field name="foo">
                <camunda:string>bar</camunda:string>
              </camunda:field>
            </camunda:executionListener>
          </bpmn:extensionElements>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
    `;

    let flow, error;
    When('flow with faulty expression execution listener', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      error = flow.waitFor('error');
      flow.run();
    });

    Then('execution listeners throws', async () => {
      const err = (await error).content.error;
      expect(err.inner.toString()).to.contain('SyntaxError: Parser Error');
    });
  });

  Scenario('Empty execution listener ', () => {
    const source = `
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Def_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="execlisteners" isExecutable="true">
        <bpmn:task id="task">
          <bpmn:extensionElements>
            <camunda:executionListener />
          </bpmn:extensionElements>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
    `;

    let flow, end;
    When('flow with empty execution listener', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      end = flow.waitFor('end');
      flow.run();
    });

    Then('execution listeners is ignored', () => {
      return end;
    });
  });

  Scenario('Empty script execution listener ', () => {
    const source = `
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Def_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="execlisteners" isExecutable="true">
        <bpmn:task id="task">
          <bpmn:extensionElements>
            <camunda:script scriptFormat="js" />
          </bpmn:extensionElements>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>
    `;

    let flow, end;
    When('flow with empty script execution listener', async () => {
      flow = await testHelpers.getOnifyFlow(source);
      end = flow.waitFor('end');
      flow.run();
    });

    Then('execution listeners is ignored', () => {
      return end;
    });
  });
});
