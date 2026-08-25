import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['js', 'scripts', 'tests'];
const javascriptFiles = roots.flatMap(root => collectFiles(root)).filter(file => ['.js', '.mjs'].includes(extname(file)));

for (const file of javascriptFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.status || 1);
    }
}

const index = readFileSync('index.html', 'utf8');
const login = readFileSync('login.html', 'utf8');
const combinedSource = javascriptFiles.filter(file => file.startsWith('js')).map(file => readFileSync(file, 'utf8')).join('\n');

assert(index.includes('data-bs-theme="light"'), 'index.html must use the light Eraneos theme');
assert(index.toLowerCase().includes('dompurify'), 'index.html must load the Markdown sanitizer');
assert(login.includes('Eraneos OKR Cockpit'), 'login.html must expose the product identity');
assert(!combinedSource.includes('askOkrWizard'), 'legacy Firebase assistant references must be removed');

console.log(`Validated ${javascriptFiles.length} JavaScript files and 2 HTML entry points.`);

function collectFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? collectFiles(path) : [path];
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
