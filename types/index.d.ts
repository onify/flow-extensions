declare module '@onify/flow-extensions' {
  import { SequenceFlow, TimerEventDefinition, ElementBase, IExtension, ContextInstance } from 'bpmn-elements';
  import { extendFn as extendFunction } from 'moddle-context-serializer';

  export class OnifySequenceFlow extends SequenceFlow {}
  export class OnifyTimerEventDefinition extends TimerEventDefinition {
    readonly supports: string[];
  }
  export function extensions(element: ElementBase, context: ContextInstance): IExtension;
  export const extendFn: extendFunction;
}

declare module '@onify/flow-extensions/FlowScripts' {
  import { IScripts } from 'bpmn-elements';
  export var FlowScripts: IScripts;
}
