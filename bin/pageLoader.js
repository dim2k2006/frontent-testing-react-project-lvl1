#!/usr/bin/env node

import commander from 'commander';
import loadPage from '../src/index.js';

const { program } = commander;

program
  .version('1.0.0')
  .description('Loads the page and it\'s resources.')
  .arguments('<pageUrl>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action((pageUrl, options) => loadPage(pageUrl, options.output)
    .then((filepath) => console.log(`Page was downloaded into "${filepath}"`))
    .catch((error) => {
      console.error(error.message);

      process.exit(1);
    }));

program.parse(process.argv);
