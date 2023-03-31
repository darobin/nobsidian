
import keytar from "keytar";
const SERVICE = 'com.berjon.nobsidian';
const ACCOUNT = 'notion';
const ACCOUNT_FILES = 'notion-files';

export async function getNotionToken () {
  return keytar.getPassword(SERVICE, ACCOUNT);
}
export async function setNotionToken (tok) {
  return keytar.setPassword(SERVICE, ACCOUNT, tok);
}
export async function getNotionFileToken () {
  return keytar.getPassword(SERVICE, ACCOUNT_FILES);
}
export async function setNotionFileToken (tok) {
  return keytar.setPassword(SERVICE, ACCOUNT_FILES, tok);
}
