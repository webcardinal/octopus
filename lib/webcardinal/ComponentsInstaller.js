const fs = require('fs');
const path = require('path');
const util = require('util');

const WrappedRunner = require('./WrappedRunner');

class ComponentsInstaller {
    constructor(runner, devPath, components) {
        this.runner = new WrappedRunner(runner);
        this.devPath = devPath || './.dev/webcardinal/components';
        this.components = components || [];
        this.packages = {};
    }

    get configuration() {
        return {
            clone: component => {
                const { name, src } = component;

                if (!name || !src) {
                    throw "WebCardinal components name or source (src) attributes not found!";
                }

                return {
                    name,
                    src,
                    actions: [
                        {
                            type: 'smartClone',
                            target: this.devPath,
                            collectLog: false
                        }
                    ]
                }
            },

            install: async component => {
                const resolveLocalDependency = (dependency, namespace) => {
                    const packageName = this.packages.components[component.name];
                    const packageJSON = this.packages[packageName];

                    if (packageName.startsWith(namespace)) {
                        if (packageJSON.devDependencies[dependency]) {
                            return `&& npm install --save-dev ../${this.packages[dependency].src}`;
                        }
                        else if (packageJSON.dependencies[dependency]) {
                            return `&& npm install ../${this.packages[dependency].src}`;
                        }
                    }
                    return '';
                }

                const componentPath = path.join(this.devPath, component.name);

                if (!fs.existsSync(componentPath)) {
                    return;
                }

                const dependencies = [
                    resolveLocalDependency('@cardinal/core', '@cardinal/')
                ];

                return {
                    name: `install-webcardinal-component_${component.name}`,
                    actions: [
                        {
                            type: 'execute',
                            cmd: `cd ${componentPath} ${dependencies.join(' ')} && npm install`
                        }
                    ]
                }
            }
        }
    }

    async clone() {
        const tasks = this.components.map(component => this.configuration.clone(component));
        await this.runner.run(tasks);
    }

    async install() {
        this.packages = await this.getLocalPackages();
        const tasks = await Promise.all(this.components.map(component => this.configuration.install(component)));
        await this.runner.run(tasks);
    }

    async getLocalPackages(components = []) {
        if (components.length === 0) {
            components = this.components.map(component => component.name);
        }
        let packages = { components: {} };
        for (const component of components) {
            const componentPath = path.join(this.devPath, component);

            if (!fs.existsSync(componentPath)) {
                continue;
            }

            let packageJSON = {};
            try {
                const readFile = util.promisify(fs.readFile);
                packageJSON = JSON.parse(await readFile(path.join(componentPath, 'package.json'), 'UTF8'));
            } catch (error) {
                console.error(error);
                continue;
            }

            const { name, dependencies, devDependencies } = packageJSON;
            packages.components[component] = name;
            packages[name] = {
                src: component,
                dependencies,
                devDependencies
            };
        }
        return packages;
    }
}

module.exports = ComponentsInstaller;