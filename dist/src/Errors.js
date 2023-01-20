"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotImplemented = exports.FormatError = void 0;
class NotImplemented extends Error {
  constructor(serviceId) {
    super(`${serviceId} service function not found`);
    this.code = 'EFLOW_NOT_IMPLEMENTED';
    this.output = {
      statusCode: 501
    };
  }
}
exports.NotImplemented = NotImplemented;
class FormatError extends Error {
  constructor(elementId, err) {
    super(`<${elementId}> ${err.message}`);
    this.code = 'EFLOW_FORMAT';
    this.output = {
      statusCode: 500
    };
  }
}
exports.FormatError = FormatError;