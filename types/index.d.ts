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
  import { IScripts, Script, ExecutionScope } from 'bpmn-elements';
  import { SerializableElement } from 'moddle-context-serializer';
  import { ScriptOptions } from 'node:vm';

  type registerArgument = SerializableElement | { id: string; type: string; behavior: any };

  export interface FlowScriptOptions extends ScriptOptions {
    timeout?: number;
  }

  export class FlowScripts implements IScripts {
    /**
     * @param flowName Flow name
     * @param resourceBase External resource base
     * @param runContext Optional script globals
     * @param timeout Optional execution timeout in milliseconds, default 60000
     */
    constructor(flowName: string, resourceBase: string, runContext?: any, timeout?: number);
    flowName: string;
    timeout: number;
    /** Registered scripts */
    get scripts(): Map<string, Script | JavaScriptResource>;
    /** Registered scripts */
    register(element: registerArgument): Script | undefined;
    getScript(language: string, identifier: { id: string; [x: string]: any }): Script;
  }

  export class JavaScript implements Script {
    constructor(flowName: string, scriptBody: string | Buffer, runContext: any, options?: FlowScriptOptions);
    get flowName(): string;
    get runContext(): unknown;
    get options(): FlowScriptOptions;
    execute(executionContext: ExecutionScope, callback: CallableFunction): void;
  }

  export class JavaScriptResource extends JavaScript {
    constructor(flowName: string, resource: string, resourceBase: string, runContext?: unknown, options?: FlowScriptOptions);
    /**
     * Get javascript resource content
     * @param resourceBase Resource base
     * @param resource Resolved resource name or path
     */
    getResourceContent(resourceBase: string, resource: string): Promise<string | Buffer>;
  }
}
