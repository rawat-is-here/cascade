const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

const source = join(__dirname, '..', 'src', 'db', 'init_db.sql');
const destination = join(__dirname, '..', 'dist', 'server', 'src', 'db', 'init_db.sql');

if (!existsSync(source)) {
  throw new Error(`Canonical database initializer is missing: ${source}`);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
