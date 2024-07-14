import fs from 'node:fs';
import path from 'node:path';

export default {
  resource,
};

function resource(name) {
  return fs.readFileSync(path.join('./test/resources', name));
}
