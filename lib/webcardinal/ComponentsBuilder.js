const fs = require('fs');
const path = require('path');
const util = require('util');

const WrappedRunner = require('./WrappedRunner');
const ComponentsInstaller = require('./ComponentsInstaller');

const FLAGS = {
  DEVELOPMENT: 'dev'
}

class ComponentsBuilder {
  constructor(runner, devPath, buildPath, options = {}) {
    this.runner = new WrappedRunner(runner);
    this.installer = new ComponentsInstaller(runner, this.devPath);
    this.devPath = devPath || './.dev/webcardinal/components';
    this.buildPath = buildPath || './webcardinal/components';
    this.options = options;
    this.core = undefined; // @webcardinal/core or @cardinal/core source folder

    for (const key of Object.keys(options)) {
      if (key.toLowerCase() === FLAGS.DEVELOPMENT) {
        this.options[FLAGS.DEVELOPMENT] = this.options[key];
        delete this.options[key];
      }
    }
  }

  get configuration() {
    const exists = async component => {
      const components = await this.configuration.components();
      return components.includes(component);
    }

    return {
      components: async(componentsPath = this.devPath) => {
        const readDirectory = util.promisify(fs.readdir);

        if (!fs.existsSync(componentsPath)) {
          return [];
        }

        try {
          return await readDirectory(componentsPath);
        } catch (error) {
          console.error(error);
          return [];
        }
      },

      build: async (component, isSafe = false, forceProd = false) => {
        const build = (this.options[FLAGS.DEVELOPMENT] && !forceProd ? 'dev' : 'build');

        if (!isSafe && !await exists(component)) {
          return {};
        }

        return {
          name: `build-webcardinal-component_${component}`,
          actions: [
            {
              type: 'remove',
              target: path.join(this.buildPath, component)
            },
            {
              type: 'execute',
              cmd: `cd ${path.join(this.devPath, component)} && npm run ${build}`
            }
          ]
        }
      },

      /**
       * The build process is always in the following order
       * PROD MODE:
       * 1. @webcardinal/core
       * 2. @cardinal/core
       * 3. file system order (alphabetical order) for the remaining components
       *
       * DEV MODE:             MODE:
       * 1. @webcardinal/core  (DEV)
       * 2. @cardinal/core     (PROD)
       * 3. file system order  (DEV)
       * 4. @cardinal/core     (DEV)
       */
      buildAll: async () => {
        let components = await this.configuration.components();
        if (components.length === 0) {
          throw "No WebCardinal components found!";
        }

        let packages = await this.installer.getLocalPackages(components);
        this.core = packages['@webcardinal/core'] || packages['@cardinal/core'];
        if (!this.core) {
          throw "No WebCardinal core components found! (@webcardinal/core or @cardinal/core) #build";
        }

        let configuration = [];
        if (packages.components[this.core.src] === '@webcardinal/core') {
          configuration.push(
            await this.configuration.build(this.core.src, true),
            await this.configuration.build(packages['@cardinal/core'].src, false, true)
          );
          components = components.filter(component => ![this.core.src, packages['@cardinal/core'].src].includes(component));
          for (const component of components) {
            configuration.push(await this.configuration.build(component, true));
          }
        } else {
          configuration = [await this.configuration.build(this.core.src, true, true)];
          components = components.filter(component => this.core.src !== component);
          for (const component of components) {
            configuration.push(await this.configuration.build(component, true));
          }
        }
        if (this.options[FLAGS.DEVELOPMENT]) {
          configuration.push(await this.configuration.build(packages['@cardinal/core'].src, false));
        }

        return configuration;
      },

      copy: async (component, isSafe = false) => {
        if (!isSafe && !await exists(component)) {
          return {};
        }

        let target = path.join(this.buildPath, component);
        let actions = [
          {
            type: 'remove',
            target
          },
          {
            type: 'copy',
            src: path.join(this.devPath, component, 'build/dist/webcardinal'),
            target
          }
        ];

        if (this.core && component === this.core.src) {
          target = path.join(this.buildPath, '../base');
          actions.push(
            {
              type: 'remove',
              target
            },
            {
              type: 'copy',
              src: path.join(this.devPath, `${component}/base`),
              target
            }
          )
        }

        let src = path.join(this.devPath, component, 'extended');
        target = path.join(this.buildPath, '../extended', component);
        if (fs.existsSync(src)) {
          actions.push(
              {
                type: 'remove',
                target
              },
              {
                type: 'copy',
                src,
                target
              }
          )
        }

        return {
          name: `copy-webcardinal-component_${component}`,
          actions
        }
      },

      copyAll: async() => {
        const components = await this.configuration.components();
        let configuration = [];
        for (const component of components) {
          configuration.push(await this.configuration.copy(component, true));
        }
        return configuration;
      }
    }
  }

  async build(components) {
    let tasks = [];
    if (!components || !Array.isArray(components)) {
      tasks = await this.configuration.buildAll();
    } else {
      for (let component of components) {
        tasks.push(await this.configuration.build(component));
      }
    }
    return this.runner.run(tasks);
  }

  async copy(components) {
    let tasks = [];
    if (!components || !Array.isArray(components)) {
      tasks = await this.configuration.copyAll();
    } else {
      for (let component of components) {
        tasks.push(await this.configuration.copy(component));
      }
    }
    return this.runner.run(tasks);
  }

  async merge() {
    let components = await this.configuration.components(this.buildPath);
    if (!components.includes(this.core.src)) {
      throw "No WebCardinal core components found! (@webcardinal/core or @cardinal/core) #merge"
    }
    components = components.filter(component => component !== this.core.src);

    let directory = path.join(this.buildPath).split(path.sep).pop();
    let module = `./${directory}/${this.core.src}`;
    let content = {
      js: `import '${module}/webcardinal.esm.js';\n`,
      css: `@import "${module}/webcardinal.css";\n`
    }

    for (const component of components) {
      module = `./${directory}/${component}`;

      content.js += `import '${module}/webcardinal.esm.js';\n`
      if (fs.existsSync(path.join(this.buildPath, component, 'webcardinal.css'))) {
        content.css += `@import "${module}/webcardinal.css";\n`;
      }
    }

    const writeFile = util.promisify(fs.writeFile);
    await writeFile(path.join(this.buildPath, '../webcardinal.js'), content.js);
    await writeFile(path.join(this.buildPath, '../webcardinal.css'), content.css);
  }
}

module.exports = ComponentsBuilder;