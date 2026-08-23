export class FormatActivity {
  /**
   * @param {import('bpmn-elements').Activity} activity
   */
  constructor(activity) {
    this.activity = activity;
    this.resultVariable = activity.behaviour.resultVariable;

    let timeCycles;
    if (activity.eventDefinitions) {
      for (const ed of activity.eventDefinitions.filter((e) => e.type === 'bpmn:TimerEventDefinition')) {
        if (!ed.supports?.includes('cron')) continue;
        if (!('timeCycle' in ed)) continue;
        timeCycles = timeCycles || [];
        timeCycles.push(ed.timeCycle);
      }
    }
    this.timeCycles = timeCycles;

    const { documentation, candidateUsers, candidateGroups, scheduledStart, assignee } = activity.behaviour;
    this.hasFormatting = Boolean(
      this.resultVariable ||
      candidateUsers ||
      candidateGroups ||
      assignee ||
      documentation?.[0]?.text ||
      (scheduledStart && activity.parent?.type === 'bpmn:Process')
    );
  }
  /**
   * @param {import('bpmn-elements').IApi<import('bpmn-elements').Activity>} elementApi
   */
  resolve(elementApi) {
    let user, groups, assigneeValue, description;
    const activity = this.activity;
    const { documentation, candidateUsers, candidateGroups, scheduledStart, assignee } = activity.behaviour;

    if (candidateUsers) user = resolveAndSplit(elementApi, candidateUsers);
    if (candidateGroups) groups = resolveAndSplit(elementApi, candidateGroups);
    if (assignee) assigneeValue = elementApi.resolveExpression(assignee);
    if (documentation) description = documentation[0]?.text;

    return {
      ...(this.resultVariable && { resultVariable: this.resultVariable }),
      ...(scheduledStart && activity.parent.type === 'bpmn:Process' && { scheduledStart }),
      ...(user?.length && { candidateUsers: user }),
      ...(groups?.length && { candidateGroups: groups }),
      ...(!elementApi.content.description && description && { description: elementApi.resolveExpression(description) }),
      ...(assigneeValue && { assignee: assigneeValue }),
    };
  }
}

export class FormatProcess {
  /**
   * @param {import('bpmn-elements').Process} bp
   */
  constructor(bp) {
    this.process = bp;
    this._historyTTL = undefined;
    if (bp.behaviour.historyTimeToLive) {
      this._historyTTL = bp.context.definitionContext.getTimersByElementId(bp.id).find((t) => t.timer.type === 'historyTimeToLive');
    }
  }
  /**
   * @param {import('bpmn-elements').IApi<import('bpmn-elements').Process>} elementApi
   */
  resolve(elementApi) {
    let user, groups, description;
    const bp = this.process;
    const { documentation, candidateStarterUsers, candidateStarterGroups } = bp.behaviour;

    if (candidateStarterUsers) user = resolveAndSplit(elementApi, candidateStarterUsers);
    if (candidateStarterGroups) groups = resolveAndSplit(elementApi, candidateStarterGroups);
    if (documentation) description = documentation[0]?.text;

    return {
      ...(user?.length && { candidateStarterUsers: user }),
      ...(groups?.length && { candidateStarterGroups: groups }),
      ...(!elementApi.content.description && description && { description: elementApi.resolveExpression(description) }),
      ...(this._historyTTL && { historyTimeToLive: this._historyTTL.timer.value }),
    };
  }
}

/**
 * @param {import('bpmn-elements').IApi<import('bpmn-elements').Activity>} elementApi
 * @param {string} str
 * @returns {string[] | undefined}
 */
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
