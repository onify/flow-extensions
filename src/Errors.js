class NotImplemented extends Error {
  constructor(serviceId) {
    super(`${serviceId} service function not found`);
    this.code = 'EFLOW_NOT_IMPLEMENTED';
    this.output = {statusCode: 501};
  }
}

export {
  NotImplemented,
};
