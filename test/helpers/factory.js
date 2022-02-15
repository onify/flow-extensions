import fs from 'fs';
import path from 'path';

export default {
  resource,
};

function resource(name) {
  return fs.readFileSync(path.join('./test/resources', name));
}
