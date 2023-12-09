declare module '@onify/flow-extensions' {
  import { SequenceFlow, TimerEventDefinition, ElementBase, Context, IExtension } from 'bpmn-elements';
  import { extendFn as extendFunction } from 'moddle-context-serializer';

  export class OnifySequenceFlow extends SequenceFlow {}
  export class OnifyTimerEventDefinition extends TimerEventDefinition {
    readonly supports: string[];
  }
  export function extensions(element: ElementBase, context: Context): IExtension;
  export const extendFn: extendFunction;
}
