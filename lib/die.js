
import process from 'node:process';

export function die (msg) {
  console.error(msg);
  process.exit(1);
}
