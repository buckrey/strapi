'use strict';

// Dependencies.
const fs = require('fs-extra');
const path = require('path');
const slash = require('slash');
const _ = require('lodash');
const glob = require('../load/glob');
const findPackagePath = require('../load/package-path');

const MIDDLEWARE_PREFIX = 'strapi-middleware';

const requiredMiddlewares = {
  kcors: 'kcors',
  body: 'koa-body',
  compose: 'koa-compose',
  compress: 'koa-compress',
  convert: 'koa-convert',
  favicon: 'koa-favicon',
  i18n: 'koa-i18n',
  ip: 'koa-ip',
  locale: 'koa-locale',
  lusca: 'koa-lusca',
  routerJoi: 'koa-router-joi',
  session: 'koa-session',
  static: 'koa-static',
};

module.exports = async function() {
  const { installedMiddlewares, installedPlugins, appPath } = this.config;

  this.middleware = {};
  this.koaMiddlewares = {};

  Object.keys(requiredMiddlewares).forEach(key => {
    Object.defineProperty(this.koaMiddlewares, key, {
      configurable: false,
      enumerable: true,
      get: () => require(requiredMiddlewares[key]),
    });
  });

  await Promise.all([
    loadMiddlewareDependencies(installedMiddlewares, this),
    // internal middlewares
    loadMiddlewaresInDir(path.resolve(__dirname, '..', 'middlewares'), this),
    // local middleware
    loadMiddlewaresInDir(path.resolve(appPath, 'middlewares'), this),
    // plugins middlewares
    loadPluginsMiddlewares(installedPlugins, this),
    // local plugin middlewares
    loadLocalPluginsMiddlewares(appPath, this),
  ]);
};

const loadMiddlewaresInDir = async (dir, strapi) => {
  const files = await glob('*/*(index|defaults).*(js|json)', {
    cwd: dir,
  });

  files.forEach(f => {
    const name = slash(f).split('/')[0];
    mountMiddleware(name, [path.resolve(dir, f)], strapi);
  });
};

const loadPluginsMiddlewares = async (plugins, strapi) => {
  for (let pluginName of plugins) {
    const dir = path.resolve(findPackagePath(pluginName), 'middlewares');
    await loadMiddlewaresInDir(dir, strapi);
  }
};

const loadLocalPluginsMiddlewares = async (appPath, strapi) => {
  const pluginsFolder = path.resolve(appPath, 'plugins');
  const pluginsFolders = await fs.readdir(pluginsFolder);

  for (let pluginFolder of pluginsFolders) {
    const dir = path.resolve(pluginsFolder, pluginFolder, 'middlewares');
    await loadMiddlewaresInDir(dir, strapi);
  }
};

const loadMiddlewareDependencies = async (packages, strapi) => {
  for (let packageName of packages) {
    const baseDir = path.dirname(require.resolve(packageName));
    const files = await glob('*(index|defaults).*(js|json)', {
      cwd: baseDir,
      absolute: true,
    });

    const name = packageName.substring(MIDDLEWARE_PREFIX.length + 1);
    mountMiddleware(name, files, strapi);
  }
};

const mountMiddleware = (name, files, strapi) => {
  files.forEach(file => {
    strapi.middleware[name] = strapi.middleware[name] || { loaded: false };

    if (_.endsWith(file, 'index.js') && !strapi.middleware[name].load) {
      return Object.defineProperty(strapi.middleware[name], 'load', {
        configurable: false,
        enumerable: true,
        get: () => require(file)(strapi),
      });
    }

    if (_.endsWith(file, 'defaults.json')) {
      strapi.middleware[name].defaults = require(file);
      return;
    }
  });
};
