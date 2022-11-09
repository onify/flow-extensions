import testHelpers from '../helpers/testHelpers.js';

Feature('Flow scripts', () => {
  Scenario('Onify script context', () => {
    let flow;
    Given('a flow with a script task with execution error', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="execution-error" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="script">
            <script>
              Buffer.from('a');
              encrypt();
              decrypt();
              jwt.sign();
              jwt.verify();
              next(null, contextName);
              next(null, contextName);
            </script>
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="state">
                  <camunda:map>
                    <camunda:entry key="id" value="script" />
                    <camunda:entry key="name" value="\${content.name}" />
                  </camunda:map>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </scriptTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let end;
    When('executed', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('Script task fails', () => {
    let flow;
    Given('a flow with a script task with execution error', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="execution-error" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="script" name="Volatile script" scriptFormat="js">
            <script>
              next(null, env.undef.undef);
            </script>
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="state">
                  <camunda:map>
                    <camunda:entry key="id" value="script" />
                    <camunda:entry key="name" value="\${content.name}" />
                  </camunda:map>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </scriptTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let errMessage;
    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/env is not defined/);
      expect(err.content.error.inner.toString()).to.contain('execution-error/bpmn:ScriptTask/script:2');
    });
  });

  Scenario('Empty io script', () => {
    let flow;
    Given('a flow with an empty IO script', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <task id="task" camunda:assignee="foo">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="url">
                  <camunda:script scriptFormat="javascript"></camunda:script>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let end;
    When('executed', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('script is ignored', () => {
      return end;
    });
  });

  Scenario('Script syntax error', () => {
    let flow;
    Given('a flow with a faulty IO script input value', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <userTask id="task" camunda:assignee="foo">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="url">
                  <camunda:script scriptFormat="javascript">{_</camunda:script>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let errMessage;
    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating input script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/Unexpected/i);
      expect(err.content.error.inner.toString()).to.contain('command-definition/camunda:InputParameter/task/input/camunda:Script/url:1');
    });
  });

  Scenario('IO script fails', () => {
    let flow;
    Given('a flow with a faulty IO script input value', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <userTask id="task" camunda:assignee="foo">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="url">
                  <camunda:script scriptFormat="javascript">next(null, env.env.myCommandUrl);</camunda:script>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let errMessage;
    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating input script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/env is not defined/);
    });

    Given('a flow with a faulty IO script output value', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <task id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="url">
                  <camunda:script scriptFormat="js">next(null, who.env.myCommandUrl);</camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating output script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/who is not defined/);
    });
  });

  Scenario('IO script is empty', () => {
    let flow;
    Given('a flow with a faulty IO script input value', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <userTask id="task" camunda:assignee="foo">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="url">
                  <camunda:script scriptFormat="javascript">next(null, env.env.myCommandUrl);</camunda:script>
                </camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let errMessage;
    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating input script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/env is not defined/);
    });

    Given('a flow with a faulty IO script input value', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" camunda:candidateStarterGroups="test-user">
          <task id="task">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:outputParameter name="url">
                  <camunda:script scriptFormat="js">next(null, who.env.myCommandUrl);</camunda:script>
                </camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    When('executed', () => {
      errMessage = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating output script failed', async () => {
      const err = await errMessage;
      expect(err.content.error.code).to.equal('EFLOW_SCRIPT');
      expect(err.content.error.message).to.match(/who is not defined/);
    });
  });

  Scenario('Unsupported script language', () => {
    let flow;
    Given('script task with unsupported script format', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="task" scriptFormat="python">
            <script><![CDATA[
              import re
              m = re.search('(?<=abc)def', 'abcdef')
            ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('executed', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating input script failed', async () => {
      const err = await error;
      expect(err.content.error.message).to.equal('Script format python is unsupported or was not registered for <task>');
    });
  });

  Scenario('External resource not found', () => {
    let flow;
    Given('script task with missing resource', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="task" scriptFormat="js" camunda:resource="./io-sripts.js" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('executed', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('an Error is thrown indicating input script failed', async () => {
      const err = await error;
      expect(err.content.error.message).to.equal('command-definition/bpmn:ScriptTask/task: script resource ./io-sripts.js not found');
    });
  });
});
