#!/usr/bin/env node

import { getNotionToken } from "./lib/tokens.js";
import { die } from './lib/die.js';

const token = await getNotionToken();
if (!token) die('No token set. First, you need to run: ./set-notion-token.js <token>.');

// XXX
//  - [ ] get notion token
//  - [ ] load root and save it with a pointer to it
//  - [ ] for every identifier, get the fields below and add them to a needs set
//      - XXX these must list children, comments…
//  - [ ] every second, remove an id from the needs set and fetch it, saving it and adding its id to the needs
//  - [ ] make sure to get attachments as well
//  - [ ] make sure that we're not getting paginated out (I think the children IDs are always complete, but not the actual ones)
