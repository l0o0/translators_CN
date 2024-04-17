#!/usr/bin/env node

'use strict';

const path = require('path');

process.argv = process.argv.map(arg => arg === '--output-json' ? [ '--format', 'json', '--output-file' ] : arg).flat();

require('../../../node_modules/.bin/eslint')
