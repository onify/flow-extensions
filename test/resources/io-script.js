/* global next,jwt,encrypt,decrypt */

(async () => await getStatus())();

async function getStatus() {
  return new Promise((resolve) => {
    Buffer.from('a');
    encrypt();
    decrypt();
    jwt.sign();
    jwt.verify();

    next(null, {
      error: false,
    });
    resolve();
  });
}
