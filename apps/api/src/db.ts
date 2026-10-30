import {Pool} from 'pg';
export const pool=process.env.DATABASE_URL?new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:undefined,
  max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000
}):null;
export async function databaseReady():Promise<boolean>{
  if(!pool)return false;
  try{await pool.query('SELECT 1');return true;}catch{return false;}
}
