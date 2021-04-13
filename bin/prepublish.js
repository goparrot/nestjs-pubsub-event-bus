const fs = require('fs');

const { scripts, dependencies, devDependencies, husky, files, 'lint-staged': lintStaged, directories, config, ...packageJson } = require('../package.json');
packageJson.main = './index.js';
packageJson.types = './index.d.ts';
packageJson.private = false;

fs.writeFileSync('./dist/package.json', JSON.stringify(packageJson, null, '  '));

const copyFiles = ['README.md'];
for (const file of copyFiles) {
    fs.copyFileSync(`./${file}`, `./dist/${file}`);
}
