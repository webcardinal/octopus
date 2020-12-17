const fs = require('fs');
const path = require('path');
const util = require('util');

class ThemesBuilder {
  constructor(devPath, buildPath) {
    this.devPath = devPath || './dev/cardinal/themes';
    this.buildPath = buildPath || './themes';
  }

  get configuration() {
    const exists = async theme => {
      const themes = await this.configuration.themes();
      return themes.includes(theme);
    }

    return {
      themes: async(themesPath = this.devPath) => {
        const readDirectory = util.promisify(fs.readdir);

        if (!fs.existsSync(themesPath)) {
          return [];
        }

        try {
          return await readDirectory(themesPath);
        } catch (error) {
          console.error(error);
          return [];
        }
      },

      copy: async (theme, isSafe = false) => {
        if (!isSafe && !await exists(theme)) {
          return {};
        }

        let target = path.join(this.buildPath, theme);
        return {
          name: `copy-cardinal-theme-${theme}`,
          actions: [
            {
              type: 'remove',
              target
            },
            {
              type: 'copy',
              src: path.join(this.devPath, theme, 'src'),
              target
            }
          ]
        }
      },

      copyAll: async() => {
        const themes = await this.configuration.themes();
        let configuration = [];
        for (const theme of themes) {
          configuration.push(await this.configuration.copy(theme, true));
        }
        return configuration;
      }
    }
  }

  async copy(theme) {
    if (!theme) {
      return await this.configuration.copyAll();
    } else {
      return [await this.configuration.copy(theme)];
    }
  }
}

module.exports = ThemesBuilder;
