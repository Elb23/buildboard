import {createInterface} from 'node:readline/promises';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {writeFile,access} from 'node:fs/promises';
import {stdin,stdout} from 'node:process';
const destination=new URL('../.env',import.meta.url);
try{await access(destination);console.error('A .env file already exists. Move it aside deliberately before creating a new login.');process.exit(1);}catch(error){if(error.code!=='ENOENT')throw error;}
const rl=createInterface({input:stdin,output:stdout});
const username=(await rl.question('Login: ')).trim();rl.close();
if(!username)throw new Error('A login is required.');
stdout.write('Password (hidden): ');let password='';
if(!stdin.isTTY)throw new Error('Run this command in an interactive terminal.');
stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
await new Promise((resolve,reject)=>{const listener=chunk=>{for(const ch of chunk){if(ch==='\u0003'){stdin.setRawMode(false);process.exit(130);}if(ch==='\r'||ch==='\n'){stdin.off('data',listener);stdin.setRawMode(false);stdin.pause();resolve();return;}if(ch==='\u007f'||ch==='\b')password=password.slice(0,-1);else password+=ch;}};stdin.on('data',listener);});
stdout.write('\n');if(!password)throw new Error('A password is required.');const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
const values=`APP_USERNAME=${JSON.stringify(username)}\nAPP_PASSWORD_HASH=pbkdf2-sha256:100000:${salt}:${hash}\nHOST=127.0.0.1\nPORT=3000\n# PUBLIC_URL=https://your-domain.example\n# COOKIE_SECURE=1\n`;
await writeFile(destination,values,{mode:0o600,flag:'wx'});password='';console.log('Private login configured. Run npm run start:vps.');
