// Read PE import names only; never starts a database or modifies the system.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const bin=path.resolve('.officebites-local/native-runtime/node_modules/@embedded-postgres/windows-x64/native/bin');
const exe=path.join(bin,'postgres.exe');
if(!fs.existsSync(exe))throw new Error('Pinned local PostgreSQL binary not installed');
const r=spawnSync(exe,['--version'],{windowsHide:true});
console.log(JSON.stringify({status:r.status,error:r.error?.message,stdout:String(r.stdout),stderr:String(r.stderr)}));
const b=fs.readFileSync(exe),pe=b.readUInt32LE(60),sections=b.readUInt16LE(pe+6),optional=b.readUInt16LE(pe+20),start=pe+24;
const table=start+optional;
const offset=rva=>{for(let i=0;i<sections;i++){const s=table+i*40,addr=b.readUInt32LE(s+12),size=Math.max(b.readUInt32LE(s+8),b.readUInt32LE(s+16));if(rva>=addr&&rva<addr+size)return b.readUInt32LE(s+20)+rva-addr;}return 0;};
let imports=offset(b.readUInt32LE(start+(b.readUInt16LE(start)===0x20b?120:104)));
while(imports&&b.readUInt32LE(imports+12)){
 const nameOffset=offset(b.readUInt32LE(imports+12)),name=b.toString('ascii',nameOffset,b.indexOf(0,nameOffset));
 console.log(name,fs.existsSync(path.join(bin,name))||fs.existsSync(path.join('C:/Windows/System32',name))?'found':'not found in binary directory/System32');imports+=20;
}
