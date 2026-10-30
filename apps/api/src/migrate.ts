import 'dotenv/config';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pool} from './db';

async function main():Promise<void>{
  if(!pool)throw new Error('DATABASE_URL is required to run migrations.');
  const migrationDir=path.resolve(process.cwd(),'../../database/migrations');
  const files=(await readdir(migrationDir)).filter((file)=>/^\d+_[a-z0-9_]+\.sql$/i.test(file)).sort();
  const client=await pool.connect();
  try{
    await client.query('SELECT pg_advisory_lock($1)',[74190321]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(120) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for(const file of files){
      const already=await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file]);
      if(already.rowCount)continue;
      const sql=await readFile(path.join(migrationDir,file),'utf8');
      await client.query('BEGIN');
      try{
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);
        await client.query('COMMIT');
        process.stdout.write('Applied migration '+file+'\n');
      }catch(error){
        await client.query('ROLLBACK');
        throw error;
      }
    }
    process.stdout.write('Database migrations are current.\n');
  }finally{
    try{await client.query('SELECT pg_advisory_unlock($1)',[74190321]);}catch{}
    client.release();
    await pool.end();
  }
}
main().catch((error:unknown)=>{
  process.stderr.write((error instanceof Error?error.stack:String(error))+'\n');
  process.exitCode=1;
});
