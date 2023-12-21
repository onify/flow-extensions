import { expect } from 'chai';

process.env.TZ = 'Europe/Stockholm';
process.env.NODE_ENV = 'test';

global.expect = expect;
