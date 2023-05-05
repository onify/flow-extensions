declare module '@onify/flow-extensions' {
  import { SequenceFlow, ElementBase, Context, IExtension } from 'bpmn-elements';
  import { extendFn as extendFunction } from 'moddle-context-serializer';

  export class OnifySequenceFlow extends SequenceFlow {}
  export function extensions(element: ElementBase, context: Context): IExtension;
  export const extendFn: extendFunction;
}
