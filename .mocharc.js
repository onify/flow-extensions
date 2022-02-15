'use strict';

process.env.NODE_ENV = 'test';

global.expect = require('chai').expect;

module.exports = {
  exit: true,
  recursive: true,
  reporter: 'spec',
  timeout: 1000,
  ui: 'mocha-cakes-2',
  require: ['@babel/register'],
};

