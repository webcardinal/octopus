const fs = require('fs');
const path = require('path');
const util = require('util');

const FLAGS = {
  DEVELOPMENT: '--dev'
}

class ComponentsBuilder {
  constructor(octopusRunner, devPath, buildPath, flags = {}) {
    this.octopusRunner = octopusRunner;
    this.devPath = devPath || './dev/cardinal/components';
    this.buildPath = buildPath || './cardinal/components';
    this.flags = flags;
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

      build: async (component, isSafe = false) => {
        const build = (this.flags[FLAGS.DEVELOPMENT] ? 'dev' : 'build');

        if (!isSafe && !await exists(component)) {
          return {};
        }

        return {
          name: `build-cardinal-components-${component}`,
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

      buildAll: async() => {
        const components = await this.configuration.components();
        if (components.length === 0) {
          throw "No cardinal components found!";
        }

        let configuration = [];
        for (const component of components) {
          configuration.push(await this.configuration.build(component, true));
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
            src: path.join(this.devPath, component, 'build/dist/cardinal'),
            target
          }
        ];

        if (component === 'core') {
          target = path.join(this.buildPath, '../base');
          actions.push(
            {
              type: 'remove',
              target
            },
            {
              type: 'copy',
              src: path.join(this.devPath, 'core/base'),
              target
            }
          )
        }

        return {
          name: `copy-cardinal-component-${component}`,
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

  async run(dependencies = []) {
    const config = {
      workDir: '.',
      dependencies
    }

    return new Promise((resolve, reject) => {
      this.octopusRunner.run(config, (error, result) => {
        if (error) {
          reject(error);
          return
        }
        console.log('[Octopus]', result, '\n');
        resolve(null, result);
      })
    });
  }

  async build(component) {
    let configuration;
    if (!component) {
      configuration = await this.configuration.buildAll();
    } else {
      configuration = [await this.configuration.build(component)];
    }
    return await this.run(configuration);
  }

  async copy(component) {
    let configuration;
    if (!component) {
      configuration = await this.configuration.copyAll();
    } else {
      configuration = [await this.configuration.copy(component)];
    }
    await this.run(configuration);
  }

  async merge() {
    const components = await this.configuration.components(this.buildPath);

    let content = '';
    for (const component of components) {
      content += `import './components/${component}/cardinal.esm.js';\n`
    }

    if (content.length > 0) {
      const writeFile = util.promisify(fs.writeFile);
      return await writeFile(path.join(this.buildPath, '../cardinal.js'), content);
    }
  }
}

module.exports = ComponentsBuilder;