const path = require('path');
const _ = require('lodash');

const requireFile = require('./require-file');
const glob = require('./glob');

const setValue = (obj, rootPath, source) => {
  const propPath = rootPath.split('/').slice(1);
  if (propPath.length === 0) {
    return _.assign(obj, source);
  }
  _.setWith(obj, propPath, source, Object);
};

/**
 * Loads app config from a dir
 * @param {Object} options - Options
 * @param {string} options.dir - config dir to load
 */
module.exports = async dir => {
  let root = {};

  const files = await glob('**/*.+(js|json)', {
    cwd: dir,
  });

  files.forEach(file => {
    const m = requireFile(path.resolve(dir, file));

    if (file === 'application.json' || path.basename(file) === 'custom.json') {
      const rootPath = path.dirname(file);
      setValue(root, rootPath, m);
    } else {
      const rootPath = path.join(
        path.dirname(file),
        path.basename(file, path.extname(file))
      );

      setValue(root, rootPath, m);
    }
  });

  return root;
};
