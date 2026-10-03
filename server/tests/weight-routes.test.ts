import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { WeightEntry } from '../src/models/weight-entry.model';
import { UserProfile } from '../src/models/user-profile.model';
import type { Server } from 'node:http';

let server: Server;
let base: string;
const entries: {userId:string;date:string;weightKg:number}[] = [];
const profiles = new Map<string, any>();
before(async () => {
  process.env.MONGO_URI = 'mongodb://localhost/not-used';
  // Isolated in-memory persistence: no database or Firebase connection is opened.
  (WeightEntry as any).find = ({userId}:any) => ({sort:()=>({select:()=>({lean:async()=>entries.filter(e=>e.userId===userId).sort((a,b)=>a.date.localeCompare(b.date)).map(({date,weightKg})=>({date,weightKg}))})})});
  (WeightEntry as any).findOneAndUpdate = async (filter:any, update:any) => {
    const entry=entries.find(e=>e.userId===filter.userId && e.date===filter.date);
    if(entry) Object.assign(entry,update.$set); else entries.push({...filter,...update.$set});
  };
  (WeightEntry as any).deleteOne = async ({userId,date}:any) => { const i=entries.findIndex(e=>e.userId===userId && e.date===date); if(i>=0) entries.splice(i,1); };
  (UserProfile as any).findOneAndUpdate = ({uid}:any,update:any) => ({select:async()=>{const profile={uid,...profiles.get(uid),...update.$set};profiles.set(uid,profile);return profile;}});
  (UserProfile as any).findOne = ({uid}:any) => ({select:async()=>profiles.get(uid)});
  const {default:router} = await import('../src/routes/me.routes');
  const app = express(); app.use(express.json());
  app.use((req:any,_res,next)=>{req.user={uid:req.header('x-test-user') ?? 'alice'};next();});
  app.use('/me',router); app.use((err:any,_req:any,res:any,_next:any)=>res.status(400).json({error:err.name}));
  server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${(server.address() as any).port}/me/weight-entries`;
});
after(()=>server?.close());
async function put(date:string,weightKg:number,user='alice') {return fetch(`${base}/${date}`,{method:'PUT',headers:{'Content-Type':'application/json','x-test-user':user},body:JSON.stringify({weightKg})});}
test('one entry per day, latest weight wins, and users remain isolated',async()=>{
  assert.equal((await put('2026-01-02',75)).status,200);
  assert.equal((await put('2026-01-02',74.5)).status,200);
  const earlier=await (await put('2026-01-01',76)).json() as any;
  assert.equal(earlier.entries.length,2); assert.equal(earlier.profile.weightKg,74.5);
  await put('2026-01-02',90,'bob');
  await fetch(`${base}/2026-01-02`,{method:'DELETE',headers:{'x-test-user':'bob'}});
  const alice=await (await fetch(base)).json() as any;
  assert.equal(alice.entries.length,2); assert.equal(alice.entries[1].weightKg,74.5);
  const removed=await (await fetch(`${base}/2026-01-02`,{method:'DELETE'})).json() as any;
  assert.equal(removed.profile.weightKg,76);
});
test('rejects impossible dates, future dates, and invalid weights',async()=>{
  for(const [date,weight] of [['2026-02-30',75],['2999-01-01',75],['2026-01-01',0],['2026-01-01',501]] as [string,number][]) assert.equal((await put(date,weight)).status,400);
});
