#!/usr/bin/env node

import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { NotionAPI } from 'notion-client';
import axios from 'axios';
import { getNotionToken, getNotionFileToken } from "./lib/tokens.js";
import { die } from './lib/die.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';
import sleep from './lib/sleep.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const filesDir = join(dataDir, 'files');
await mkdir(filesDir, { recursive: true });

const authToken = await getNotionToken();
if (!authToken) die('No token set. First, you need to run: ./set-notion-token.js <token>.');
const fileToken = await getNotionFileToken();
if (!fileToken) die('No file token set. First, you need to run: ./set-file-token.js <token>.');
const nc = new NotionAPI({ authToken });

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));
const { signed_urls: urls } = bigIndex;
const permRequests = Object.keys(urls)
  .map(id => {
    const url = bigIndex.block[id]?.value?.properties?.source?.[0]?.[0];
    return {
      permissionRecord: {
        table: 'block',
        id,
      },
      url,
    };
  })
  .filter(Boolean)
;
const { signedUrls } = await nc.getSignedFileUrls(permRequests);
console.warn(signedUrls);

if (signedUrls.length !== permRequests.length) die(`Wrong number of signed URLs: ${signedUrls.length} vs ${permRequests.length}`);

let cnt = 0;
for (const url of signedUrls) {
  const { id: parent } = permRequests[cnt].permissionRecord;
  cnt++;
  const [uuid, fn] = new URL(url).pathname.replace('/f/s/', '').split('/');
  const dir = join(filesDir, uuid);
  console.warn(`  . ${dir} -> ${fn} (for ${parent})`);
  await mkdir(dir, { recursive: true });
  await saveJSON(join(dir, 'parent.json'), { parent });
  console.warn(`Downloading ${url}`);
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', headers: { Cookie: `file_token=${fileToken}` } });
    await writeFile(join(dir, fn), res.data, { encoding: null });
  }
  catch (err) {
    die(err.response.data.toString('utf-8'));
  }
  await sleep(1000);
}
