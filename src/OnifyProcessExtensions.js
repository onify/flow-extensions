import { FormatError } from './Errors.js';
import { getExtensions } from './getExtensions.js';

export class OnifyProcessExtensions {
  constructor(bp, context) {
    this.process = bp;
    this.context = context;
    this.extensions = getExtensions(bp, context);
    this._activate();
  }
  _activate() {
    const bp = this.process;
    bp.on(
      'process.enter',
      (elementApi) => {
        try {
          const result = this._onEnter(elementApi);
          const environment = elementApi.environment;
          environment.assignVariables(result);
        } catch (err) {
          elementApi.broker.publish(
            'event',
            'process.error',
            {
              ...elementApi.content,
              error: new FormatError(bp.id, err),
            },
            { mandatory: true, type: 'error' },
          );
        }
      },
      { consumerTag: '_onify-extension-on-enter' },
    );
  }
  _onEnter(elementApi) {
    const { format, properties } = this.extensions;
    const result = {};

    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);

    if (properties) {
      Object.assign(result, properties.resolve(elementApi));
      Object.assign(elementApi.content, result);
    }

    return result;
  }
}
