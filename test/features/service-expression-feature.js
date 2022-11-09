import testHelpers from '../helpers/testHelpers';

Feature('Service expression', () => {
  Scenario('Addressing service with expression', () => {
    let flow;
    Given('a flow with Onify API requests service expression', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="task" camunda:expression="\${environment.services.onifyApiRequest}">
            <extensionElements>
              <camunda:inputOutput>
                <camunda:inputParameter name="method">GET</camunda:inputParameter>
                <camunda:inputParameter name="url">/my/items/workspace-1</camunda:inputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source, {
        services: {
          onifyApiRequest(...args) {
            args.pop()();
          },
        },
      });
    });

    let end;
    When('started', () => {
      end = flow.waitFor('end');
      flow.run();
    });

    Then('run completes', () => {
      return end;
    });
  });

  Scenario('Addressing a non existing service with expression', () => {
    let flow;
    Given('a flow with service expression', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="task" camunda:expression="\${environment.services.onifyApiReqeust}" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('run fails', async () => {
      const err = await error;
      expect(err.content.error.message).to.match(/expression .*?onifyApiReqeust.*? service function not found/);
    });
  });

  Scenario('A malformatted expression', () => {
    let flow;
    Given('a flow with service expression', async () => {
      const source = `
      <definitions id="Def_0" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="process-1" name="Onify Flow" isExecutable="true">
          <serviceTask id="task" camunda:expression="\${environment.settings[dummy}" />
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let error;
    When('started', () => {
      error = flow.waitFor('error');
      flow.run();
    });

    Then('run fails', async () => {
      const err = await error;
      expect(err.content.error.message).to.match(/Parser Error/);
    });
  });
});
