import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pool} from './db';
async function main():Promise<void>{
  if(!pool)throw new Error('DATABASE_URL is required to run migrations.');
  const migrationPath=path.resolve(process.cwd(),'../../database/migrations/001_init.sql');
  const sql=await readFile(migrationPath,'utf8');
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query(sql);await client.query('COMMIT');process.stdout.write('Database migration applied successfully.\\n');}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();await pool.end();}
}
main().catch((error:unknown)=>{process.stderr.write((error instanceof Error?error.message:String(error))+'\\n');process.exitCode=1;});
