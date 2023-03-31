#!/usr/bin/env node

import process from 'node:process';
import { setNotionFileToken } from "./lib/tokens.js";
import { die } from './lib/die.js';

const token = process.argv[2];
if (!token) die('No token. Usage: ./set-file-token.js <token>.');
await setNotionFileToken(token);
console.log('Ok!');
