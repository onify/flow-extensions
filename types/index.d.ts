declare module '@onify/flow-extensions' {
	import type { SequenceFlow, TimerEventDefinition } from 'bpmn-elements';
	/**
	 * Onify flow extensions factory, pass to the engine as `extensions: { onify: extensions }`
	 * @returns undefined for an element without camunda extension data, letting bpmn-elements skip it (and e.g. attach its built-in `assignOutput` extension)
	 */
	export function extensions(element: import("bpmn-elements").ElementBase, context: import("bpmn-elements").ContextInstance): import("bpmn-elements").IExtension | undefined;
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
		properties?: IOProperties | undefined;
		/**
		 * camunda:FormData
		 */
		form?: IOForm | undefined;
		/**
		 * camunda:ExecutionListener
		 */
		listeners?: ExecutionListeners | undefined;
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
	class IOBase {
		constructor(parm: any);
		
		name: string;
		
		type: string;
		
		behaviour: any;
		
		getValue(activity: import("bpmn-elements").Activity, executionMessage: import("bpmn-elements").ElementBrokerMessage): Promise<{
			name: any;
		}>;
	}
	class InputOutput {
		
		constructor(parentId: string, behaviour: any, context: import("bpmn-elements").ContextInstance);
		parentId: string;
		context: import("bpmn-elements").ContextInstance;
		input: IOBase[];
		output: IOBase[];
		
		getInput(activity: import("bpmn-elements").Activity, executionMessage: import("bpmn-elements").ElementBrokerMessage): Promise<Record<string, any>>;
		
		getOutput(activity: import("bpmn-elements").Activity, executionMessage: import("bpmn-elements").ElementBrokerMessage): Promise<Record<string, any>>;
		/**
		 * @param parentId parent element id
		 * @param list list of IO behaviours
		 * @param ioType type of IO
		 * */
		_map(parentId: string, list: any[], ioType: string, context: import("bpmn-elements").ContextInstance): IOBase[];
	}
	class IOProperties {
		constructor(activity: any, behaviour: any);
		activity: any;
		behaviour: any;
		/**
		 * @param : import('bpmn-elements').IApi<any>} elementApi
		 * */
		resolve(elementApi: any): Record<string, any>;
	}
	class IOForm {
		constructor(activity: any, behaviour: any);
		activity: any;
		behaviour: any;
		
		resolve(elementApi: import("bpmn-elements").IApi<import("bpmn-elements").Activity>): Record<string, any>;
	}
	class ExecutionListeners {
		
		constructor(activity: import("bpmn-elements").Activity | import("bpmn-elements").SequenceFlow, context: import("bpmn-elements").ContextInstance);
		activity: import("bpmn-elements").Activity | import("bpmn-elements").SequenceFlow;
		context: import("bpmn-elements").ContextInstance;
		
		listeners: (ScriptListener | ExpressionListener)[];
		get length(): number;
		get onStart(): boolean;
		get onEnd(): boolean;
		get onTake(): boolean;
		add(extension: any, pos: any): void;
		execute(event: any, message: any): Promise<{}>;
	}
	class ScriptListener extends Listener {
		/**
		 * @param pos execution listener position
		 */
		constructor(activity: import("bpmn-elements").Activity | import("bpmn-elements").SequenceFlow, context: import("bpmn-elements").ContextInstance, extension: {
			script: {
				$type: string;
				[x: string]: any;
			};
			[x: string]: any;
		}, pos: number);
		id: string;
		execute(api: any): Promise<any>;
		_register(context: any, id: any, script: any): void;
	}
	class ExpressionListener extends Listener {
		execute(api: any): Promise<{
			expression: any;
		}>;
	}
	class Listener {
		
		constructor(activity: import("bpmn-elements").Activity | import("bpmn-elements").SequenceFlow, context: import("bpmn-elements").ContextInstance, extension: {
			$type: string;
			event: string;
			[x: string]: any;
		});
		activity: import("bpmn-elements").Activity | import("bpmn-elements").SequenceFlow;
		environment: import("bpmn-elements").Environment;
		context: import("bpmn-elements").ContextInstance;
		extension: {
			[x: string]: any;
			$type: string;
			event: string;
		};
		type: string;
		event: string;
		
		execute(_api: import("bpmn-elements").IApi<any>): Promise<any>;
		
		_getScope(api: import("bpmn-elements").IApi<any>, extend?: Record<string, any>): {
			type: string;
			listener: {
				event: string;
			};
			fields: Required<import("smqp").MessageFields>;
			content: import("bpmn-elements").ElementMessageContent;
			properties: import("smqp").MessageProperties;
			environment: import("bpmn-elements").Environment;
			logger: import("bpmn-elements").ILogger;
		};
		
		_getFields(environment: import("bpmn-elements").Environment, scope: any): Record<string, any>;
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