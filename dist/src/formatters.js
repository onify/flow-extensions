"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FormatProcess = exports.FormatActivity = void 0;
var _cronParser = _interopRequireDefault(require("cron-parser"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const iso8601cycle = /^\s*(R\d+\/)?P\w+/i;
class FormatActivity {
  constructor(activity) {
    this.activity = activity;
    this.resultVariable = activity.behaviour.resultVariable;
    let timeCycles;
    if (activity.eventDefinitions) {
      for (const ed of activity.eventDefinitions.filter(e => e.type === 'bpmn:TimerEventDefinition')) {
        if (!('timeCycle' in ed)) continue;
        timeCycles = timeCycles || [];
        timeCycles.push(ed.timeCycle);
      }
    }
    this.timeCycles = timeCycles;
  }
  resolve(elementApi) {
    var _documentation$, _user, _groups;
    let user, groups, assigneeValue, description;
    const activity = this.activity;
    const {
      documentation,
      candidateUsers,
      candidateGroups,
      scheduledStart,
      assignee
    } = activity.behaviour;
    if (candidateUsers) user = resolveAndSplit(elementApi, candidateUsers);
    if (candidateGroups) groups = resolveAndSplit(elementApi, candidateGroups);
    if (assignee) assigneeValue = elementApi.resolveExpression(assignee);
    if (documentation) description = (_documentation$ = documentation[0]) === null || _documentation$ === void 0 ? void 0 : _documentation$.text;
    let expireAt;
    const timeCycles = this.timeCycles;
    if (timeCycles) {
      for (const cycle of timeCycles) {
        const cron = elementApi.resolveExpression(cycle);
        if (!cron || iso8601cycle.test(cron)) continue;
        const expireAtDt = _cronParser.default.parseExpression(cron).next().toDate();
        if (!expireAt || expireAtDt < expireAt) expireAt = expireAtDt;
      }
    }
    return {
      ...(this.resultVariable && {
        resultVariable: this.resultVariable
      }),
      ...(scheduledStart && activity.parent.type === 'bpmn:Process' && {
        scheduledStart
      }),
      ...(((_user = user) === null || _user === void 0 ? void 0 : _user.length) && {
        candidateUsers: user
      }),
      ...(((_groups = groups) === null || _groups === void 0 ? void 0 : _groups.length) && {
        candidateGroups: groups
      }),
      ...(!elementApi.content.description && description && {
        description: elementApi.resolveExpression(description)
      }),
      ...(expireAt && {
        expireAt
      }),
      ...(assigneeValue && {
        assignee: assigneeValue
      })
    };
  }
}
exports.FormatActivity = FormatActivity;
class FormatProcess {
  constructor(bp) {
    this.process = bp;
  }
  resolve(elementApi) {
    var _documentation$2, _user2, _groups2;
    let user, groups, description;
    const bp = this.process;
    const {
      documentation,
      candidateStarterUsers,
      candidateStarterGroups
    } = bp.behaviour;
    if (candidateStarterUsers) user = resolveAndSplit(elementApi, candidateStarterUsers);
    if (candidateStarterGroups) groups = resolveAndSplit(elementApi, candidateStarterGroups);
    if (documentation) description = (_documentation$2 = documentation[0]) === null || _documentation$2 === void 0 ? void 0 : _documentation$2.text;
    return {
      ...(((_user2 = user) === null || _user2 === void 0 ? void 0 : _user2.length) && {
        candidateStarterUsers: user
      }),
      ...(((_groups2 = groups) === null || _groups2 === void 0 ? void 0 : _groups2.length) && {
        candidateStarterGroups: groups
      }),
      ...(!elementApi.content.description && description && {
        description: elementApi.resolveExpression(description)
      })
    };
  }
}
exports.FormatProcess = FormatProcess;
function resolveAndSplit(elementApi, str) {
  if (Array.isArray(str)) return str.filter(Boolean);
  if (typeof str !== 'string') return;
  const resolved = elementApi.resolveExpression(str);
  if (Array.isArray(resolved)) return resolved.filter(Boolean);
  if (typeof resolved !== 'string') return;
  return resolved.split(',').map(g => g.trim && g.trim().toLowerCase()).filter(Boolean);
}