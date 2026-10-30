import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
const username=z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9._]+$/);
test('public TikTok handles are validated',()=>{
  assert.equal(username.safeParse('creator_01').success,true);
  assert.equal(username.safeParse('a').success,false);
  assert.equal(username.safeParse('bad handle').success,false);
  assert.equal(username.safeParse('x'.repeat(25)).success,false);
});
