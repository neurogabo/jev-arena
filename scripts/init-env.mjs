import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';

try {
  await copyFile(new URL('../.env.example', import.meta.url), new URL('../.env', import.meta.url), constants.COPYFILE_EXCL);
  console.log('Created local .env with an empty API key. Offline play is ready after setup.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
