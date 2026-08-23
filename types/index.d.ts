declare module '@onify/flow-extensions' {
	import type { SequenceFlow, TimerEventDefinition } from 'bpmn-elements';
	/**
	 * Onify flow extensions factory, pass to the engine as `extensions: { onify: extensions }`
	 * */
	export function extensions(element: import("bpmn-elements").ElementBase, context: import("bpmn-elements").ContextInstance): import("bpmn-elements").IExtension;
	/**
	 * Extend function for moddle-context-serializer, registers scripts and timers at serialize time
	 * */
	export function extendFn(behaviour: import("bpmn-moddle").BaseElement & Record<string, any>, context: import("moddle-context-serializer").ExtendContext): void;
	export class OnifySequenceFlow extends SequenceFlow {
		extensions: OnifyExtensions;
		#private;
	}
	export class OnifyTimerEventDefinition extends TimerEventDefinition {
		/**
		 * Supported timeCycle formats
		 * */
		get supports(): string[];
	}
	/**
	 * assembled element extensions
	 */
	type OnifyExtensions = {
		/**
		 * enter/end formatting
		 */
		format?: FormatActivity | FormatProcess | undefined;
		/**
		 * service factory
		 */
		Service?: import("bpmn-elements").IActivityBehaviour | undefined;
		/**
		 * camunda:InputOutput
		 */
		io?: InputOutput | undefined;
		/**
		 * camunda:Properties
		 */
		properties?: {
			resolve(elementApi: import("bpmn-elements").IApi<any>): any;
		} | undefined;
		/**
		 * camunda:FormData
		 */
		form?: {
			resolve(elementApi: import("bpmn-elements").IApi<any>): any;
		} | undefined;
		/**
		 * camunda:ExecutionListener
		 */
		listeners?: {
			onStart?: boolean;
			onEnd?: boolean;
			onTake?: boolean;
			execute(event: string, message: any): Promise<any>;
		} | undefined;
	};
	class FormatActivity {
		
		constructor(activity: import("bpmn-elements").Activity);
		activity: import("bpmn-elements").Activity;
		resultVariable: any;
		timeCycles: never[] | undefined;
		hasFormatting: boolean;
		
		resolve(elementApi: import("bpmn-elements").IApi<import("bpmn-elements").Activity>): any;
	}
	class FormatProcess {
		
		constructor(bp: import("bpmn-elements").Process);
		process: import("bpmn-elements").Process;
		_historyTTL: any;
		
		resolve(elementApi: import("bpmn-elements").IApi<import("bpmn-elements").Process>): any;
	}
	class InputOutput {
		constructor(parentId: any, behaviour: any, context: any);
		parentId: any;
		context: any;
		input: any[];
		output: any[];
		getInput(activity: any, executionMessage: any): Promise<any>;
		getOutput(activity: any, executionMessage: any): Promise<any>;
		_map(parentId: any, list: any, ioType: any, context: any): any[];
	}

	export {};
}

declare module '@onify/flow-extensions/FlowScripts' {
	import type { Script } from 'node:vm';
	/**
	 * Flow scripts provider
	 * @param flowName Flow name
	 * @param resourceBase External resource base
	 * @param runContext Optional script globals
	 * @param timeout Optional execution timeout in milliseconds, default 60000
	 */
	export function FlowScripts(flowName: string, resourceBase: string, runContext?: any, timeout?: number): void;
	export class FlowScripts {
		/**
		 * Flow scripts provider
		 * @param flowName Flow name
		 * @param resourceBase External resource base
		 * @param runContext Optional script globals
		 * @param timeout Optional execution timeout in milliseconds, default 60000
		 */
		constructor(flowName: string, resourceBase: string, runContext?: any, timeout?: number);
		flowName: string;
		
		scripts: Map<string, JavaScript | JavaScriptResource>;
		timeout: number;
		runContext: any;
		/**
		 * Register script element
		 * */
		register({ id, type, behaviour }: import("moddle-context-serializer").SerializableElement): void;
		/**
		 * Get registered script
		 * */
		getScript(scriptType: string, { id }: {
			id: string;
		}): JavaScript | JavaScriptResource | undefined;
		[kResources]: string;
	}
	/**
	 * Java script
	 * 
	 */
	export function JavaScript(flowName: string, scriptBody: string | Buffer, runContext?: any, options?: import("node:vm").ScriptOptions & {
		filename?: string;
		timeout?: number;
	}): void;
	export class JavaScript {
		/**
		 * Java script
		 * 
		 */
		constructor(flowName: string, scriptBody: string | Buffer, runContext?: any, options?: import("node:vm").ScriptOptions & {
			filename?: string;
			timeout?: number;
		});
		flowName: string;
		options: (import("node:vm").ScriptOptions & {
			filename?: string;
			timeout?: number;
		}) | undefined;
		runContext: any;
		timeout: number | undefined;
		script: Script | undefined;
		/**
		 * Execute script
		 * */
		execute(executionContext: import("bpmn-elements").ExecutionScope, callback: CallableFunction): Promise<any>;
		[kSyntaxError]: FlowSyntaxError;
	}
	/**
	 * Java script resource
	 * @param resource Resource name or path
	 * @param resourceBase Resource base
	 * 
	 */
	export function JavaScriptResource(flowName: string, resource: string, resourceBase: string, runContext?: any, options?: import("node:vm").ScriptOptions & {
		filename?: string;
		timeout?: number;
	}): void;
	export class JavaScriptResource {
		/**
		 * Java script resource
		 * @param resource Resource name or path
		 * @param resourceBase Resource base
		 * 
		 */
		constructor(flowName: string, resource: string, resourceBase: string, runContext?: any, options?: import("node:vm").ScriptOptions & {
			filename?: string;
			timeout?: number;
		});
		flowName: string;
		resource: string;
		runContext: any;
		options: (import("node:vm").ScriptOptions & {
			filename?: string;
			timeout?: number;
		}) | undefined;
		timeout: number | undefined;
		resourceBase: string;
		/**
		 * Get javascript resource content
		 * @param resourceBase Resource base
		 * @param resource Resolved resource name or path
		 * @returns Resource content
		 */
		getResourceContent(resourceBase: string, resource: string): Promise<string | Buffer>;
		/**
		 * Execute script resource
		 * */
		execute(executionContext: import("bpmn-elements").ExecutionScope, callback: CallableFunction): Promise<any>;
	}
	export class FlowScriptError extends Error {
		
		constructor(fromErr: Error);
	}
	export class FlowSyntaxError extends Error {
		
		constructor(fromErr: Error);
	}
	export class FlowResourceError extends FlowScriptError {
		
		constructor(fromErr: Error, filename?: string);
		filename: string | undefined;
		inner: Error;
	}
	const kResources: unique symbol;
	const kSyntaxError: unique symbol;

	export {};
}

//# sourceMappingURL=index.d.ts.map