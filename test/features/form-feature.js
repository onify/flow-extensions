import testHelpers from '../helpers/testHelpers.js';

Feature('Flow form', () => {
  Scenario('Flow with form', () => {
    let flow;
    Given('a flow with user task form', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true" candidateStarterGroups="admin">
          <userTask id="task" camunda:formKey="klaslk" camunda:candidateGroups="admin,managers,"  camunda:candidateUsers="user-1" camunda:assignee="boss">
            <extensionElements>
              <camunda:formData>
                <camunda:formField id="items" label="Ordered items" type="string" defaultValue="\${environment.variables.input.orderItems}" />
                <camunda:formField id="given_name" label="Given name" type="string" />
                <camunda:formField id="surname" type="string">
                  <camunda:properties>
                    <camunda:property id="formprop" value="bar" />
                    <camunda:property id="candidates" value="\${content.candidateUsers}" />
                  </camunda:properties>
                </camunda:formField>
              </camunda:formData>
            </extensionElements>
          </userTask>
        </process>
      </definitions>`;

      flow = await testHelpers.getOnifyFlow(source);
    });

    let wait;
    When('started', () => {
      wait = flow.waitFor('wait');
      flow.run();
    });

    And('task is decorated with form', async () => {
      const taskApi = await wait;

      expect(taskApi.content).to.have.property('form');
      expect(taskApi.content.form).to.have.property('items');
      expect(taskApi.content.form).to.have.property('given_name');
      expect(taskApi.content.form).to.have.property('surname').with.property('properties');
      expect(taskApi.content.form.surname.properties).to.deep.equal({
        formprop: 'bar',
        candidates: ['user-1'],
      });
    });
  });
});
