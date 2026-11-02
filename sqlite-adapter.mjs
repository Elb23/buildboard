import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
export function openDatabase(filename,root){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true,mode:0o700});
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
 db.exec('CREATE TABLE IF NOT EXISTS buildboard_migrations (name TEXT PRIMARY KEY)');
 for(const name of readdirSync(join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM buildboard_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN IMMEDIATE');try{db.exec(readFileSync(join(root,'drizzle',name),'utf8'));db.prepare('INSERT INTO buildboard_migrations(name) VALUES (?)').run(name);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 }
 return {
  close:()=>db.close(),
  prepare(sql){
   const stmt=db.prepare(sql);
   return {
    bind(...values){
     return {
      async first(){return stmt.get(...values)||null;},
      async run(){const result=stmt.run(...values);return {meta:{changes:Number(result.changes)}};}
     };
    }
   };
  }
 };
}
