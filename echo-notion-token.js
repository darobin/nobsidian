#!/usr/bin/env node

import process from 'node:process';
import { getNotionToken } from "./lib/tokens.js";
import { die } from './lib/die.js';

const authToken = await getNotionToken();
if (!authToken) die('No token set. First, you need to run: ./set-notion-token.js <token>.');

process.stdout.write(authToken);
