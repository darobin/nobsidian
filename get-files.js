#!/usr/bin/env node

import { join } from 'node:path';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { NotionAPI } from 'notion-client';
import axios from 'axios';
import { getNotionToken, getNotionFileToken } from "./lib/tokens.js";
import { die } from './lib/die.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';
import sleep from './lib/sleep.js';

const spaceId = 'fb3fbef6-0b34-462f-b235-627e17f7d72d';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const filesDir = join(dataDir, 'files');
await mkdir(filesDir, { recursive: true });

const uuids = await readdir(filesDir);
const alreadyHave = new Set();
for (const uuid of uuids) {
  const { parent } = await loadJSON(join(filesDir, uuid, 'parent.json'));
  if (Array.isArray(parent)) parent.forEach(p => alreadyHave.add(p));
  else alreadyHave.add(parent);
  alreadyHave.add(uuid);
}

const authToken = await getNotionToken();
if (!authToken) die('No token set. First, you need to run: ./set-notion-token.js <token>.');
const fileToken = await getNotionFileToken();
if (!fileToken) die('No file token set. First, you need to run: ./set-file-token.js <token>.');
const nc = new NotionAPI({ authToken });

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));
const { signed_urls: urls } = bigIndex;
const permRequests = Object.keys(urls)
  .map(id => {
    if (alreadyHave.has(id)) return;
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
// XXX
//  - iterating on blocks, for image we have:
//    - file_ids = the uuid in the URL
//    - id = the parent, key in the signed_urls
Object.values(bigIndex.block)
  .map(v => v.value)
  .filter(b => b.space_id === spaceId)
  .filter(b => b.file_ids)
  .filter(b => !bigIndex.signed_urls[b.id])
  .forEach(b => {
    const id = b.id;
    let url = b.properties?.['WR=k']?.[0]?.[1]?.[0]?.[1]
            || b.format?.page_cover
    ;
    if (!url) return;
    permRequests.push({
      permissionRecord: {
        table: 'block',
        id,
      },
      url,
    });
  })
;

if (!permRequests.length) die('Nothing to download');
const { signedUrls } = await nc.getSignedFileUrls(permRequests);
console.warn(signedUrls);

if (signedUrls.length !== permRequests.length) die(`Wrong number of signed URLs: ${signedUrls.length} vs ${permRequests.length}`);

let cnt = 0;
const parentMap = {};
for (const url of signedUrls) {
  const { id: parent } = permRequests[cnt].permissionRecord;
  cnt++;
  const [uuid, fn] = new URL(url).pathname.replace('/f/s/', '').split('/');
  const dir = join(filesDir, uuid);
  console.warn(`  . ${dir} -> ${fn} (for ${parent})`);
  await mkdir(dir, { recursive: true });
  if (parentMap[uuid]) {
    if (Array.isArray(parentMap[uuid])) parentMap[uuid].push(parent);
    else parentMap[uuid] = [parentMap[uuid], parent];
  }
  else parentMap[uuid] = parent;
  await saveJSON(join(dir, 'parent.json'), { parent: parentMap[uuid] });
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
