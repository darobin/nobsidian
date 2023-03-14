
import keytar from "keytar";
const SERVICE = 'com.berjon.nobsidian';
const ACCOUNT = 'notion';

export async function getNotionToken () {
  return keytar.getPassword(SERVICE, ACCOUNT);
}
export async function setNotionToken (tok) {
  return keytar.setPassword(SERVICE, ACCOUNT, tok);
}
