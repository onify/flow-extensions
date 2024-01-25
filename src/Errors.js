export class NotImplemented extends Error {
  constructor(serviceId) {
    super(`${serviceId} service function not found`);
    this.code = 'EFLOW_NOT_IMPLEMENTED';
    this.output = { statusCode: 501 };
  }
}

export class FormatError extends Error {
  constructor(elementId, err) {
    super(`<${elementId}> ${err.message}`);
    this.code = 'EFLOW_FORMAT';
    this.output = { statusCode: 500 };
  }
}
