import fs from 'fs';
import { EOL } from 'os';
import path from 'path';
import parseArgs from 'minimist';

function run(): void {
    const {
        from = '.',
        to = './dist',
        main = './cjs/index.js',
        module = './esm/index.js',
        typings = './types/index.d.ts',
    } = parseArgs<{ from: string; to: string; main: string; module: string; typings: string }>(process.argv.slice(2));
    console.log({ from, to, main, module, typings });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
        scripts,
        devDependencies,
        husky,
        files,
        'lint-staged': lintStaged,
        directories,
        config,
        ...packageJson
    } = JSON.parse(fs.readFileSync(path.join(process.cwd(), `./${from}/package.json`)).toString());
    delete packageJson.engines.npm;

    packageJson.main = main;
    packageJson.module = module;
    packageJson.typings = typings;
    packageJson.sideEffects = false;

    fs.writeFileSync(`${to}/package.json`, JSON.stringify(packageJson, null, 4) + EOL);

    const copyFiles = ['README.md'];
    for (const file of copyFiles) {
        const fromPath = `${from}/${file}`;
        if (!fs.existsSync(fromPath)) {
            console.warn(`WARN: File "${fromPath}" doesn't exist`);
            continue;
        }

        fs.copyFileSync(fromPath, `${to}/${file}`);
    }
}

run();
