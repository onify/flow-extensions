import cronParser from 'cron-parser';

const iso8601cycle = /^\s*(R\d+\/)?P\w+/i;

export class FormatActivity {
  constructor(activity) {
    this.activity = activity;
    this.resultVariable = activity.behaviour.resultVariable;

    let timeCycles;
    if (activity.eventDefinitions) {
      for (const ed of activity.eventDefinitions.filter((e) => e.type === 'bpmn:TimerEventDefinition')) {
        if (ed.supports?.includes('cron')) continue;
        if (!('timeCycle' in ed)) continue;
        timeCycles = timeCycles || [];
        timeCycles.push(ed.timeCycle);
      }
    }
    this.timeCycles = timeCycles;
  }
  resolve(elementApi) {
    let user, groups, assigneeValue, description;
    const activity = this.activity;
    const {
      documentation,
      candidateUsers,
      candidateGroups,
      scheduledStart,
      assignee,
    } = activity.behaviour;

    if (candidateUsers) user = resolveAndSplit(elementApi, candidateUsers);
    if (candidateGroups) groups = resolveAndSplit(elementApi, candidateGroups);
    if (assignee) assigneeValue = elementApi.resolveExpression(assignee);
    if (documentation) description = documentation[0]?.text;

    let expireAt;
    const timeCycles = this.timeCycles;
    if (timeCycles) {
      for (const cycle of timeCycles) {
        const cron = elementApi.resolveExpression(cycle);
        if (!cron || iso8601cycle.test(cron)) continue;

        const expireAtDt = cronParser.parseExpression(cron).next().toDate();
        if (!expireAt || expireAtDt < expireAt) expireAt = expireAtDt;
      }
    }

    return {
      ...(this.resultVariable && {resultVariable: this.resultVariable}),
      ...(scheduledStart && activity.parent.type === 'bpmn:Process' && {scheduledStart}),
      ...(user?.length && {candidateUsers: user}),
      ...(groups?.length && {candidateGroups: groups}),
      ...(!elementApi.content.description && description && {description: elementApi.resolveExpression(description)}),
      ...(expireAt && {expireAt}),
      ...(assigneeValue && {assignee: assigneeValue}),
    };
  }
}

export class FormatProcess {
  constructor(bp) {
    this.process = bp;
  }
  resolve(elementApi) {
    let user, groups, description;
    const bp = this.process;
    const {
      documentation,
      candidateStarterUsers,
      candidateStarterGroups,
    } = bp.behaviour;

    if (candidateStarterUsers) user = resolveAndSplit(elementApi, candidateStarterUsers);
    if (candidateStarterGroups) groups = resolveAndSplit(elementApi, candidateStarterGroups);
    if (documentation) description = documentation[0]?.text;

    return {
      ...(user?.length && {candidateStarterUsers: user}),
      ...(groups?.length && {candidateStarterGroups: groups}),
      ...(!elementApi.content.description && description && {description: elementApi.resolveExpression(description)}),
    };
  }
}

function resolveAndSplit(elementApi, str) {
  if (Array.isArray(str)) return str.filter(Boolean);
  if (typeof str !== 'string') return;

  const resolved = elementApi.resolveExpression(str);
  if (Array.isArray(resolved)) return resolved.filter(Boolean);
  if (typeof resolved !== 'string') return;

  return resolved
    .split(',')
    .map((g) => g.trim && g.trim().toLowerCase())
    .filter(Boolean);
}
