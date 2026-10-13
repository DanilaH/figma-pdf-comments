import {readFile,writeFile} from 'node:fs/promises';
const id=process.argv[2];if(!id||!/^\d+$/.test(id))throw Error('Usage: node configure.mjs <plugin ID assigned to you by Figma>');
const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.id=id;await writeFile('manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Set your Figma-assigned plugin ID. No publication performed.');
