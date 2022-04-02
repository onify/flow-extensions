"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotImplemented = void 0;

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