#!/usr/bin/env node

import process from 'node:process';
import { setNotionToken } from "./lib/tokens.js";
import { die } from './lib/die.js';

const token = process.argv[2];
if (!token) die('No token. Usage: ./set-notion-token.js <token>.');
await setNotionToken(token);
console.log('Ok!');
