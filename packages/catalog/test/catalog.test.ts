import test from 'node:test';
import assert from 'node:assert/strict';
import {objectives,packages,tiers,followerGoalMilestones,findPackage} from '../src/index';
test('catalog has seven objectives and five package sizes per objective',()=>{
  assert.equal(objectives.length,7);assert.equal(tiers.length,5);assert.equal(packages.length,35);
  assert.equal(new Set(packages.map((item)=>item.id)).size,packages.length);
});
test('follower planning milestones run from 100 to one million',()=>{
  assert.equal(followerGoalMilestones[0],100);assert.equal(followerGoalMilestones.at(-1),1000000);
});
test('all packages have a positive budget and explanatory details',()=>{
  for(const item of packages){assert.ok(item.budgetUsd>0);assert.ok(item.includes.length>0);assert.ok(item.notIncluded.length>0);}
});
test('enterprise follower-growth package is discoverable',()=>{
  assert.equal(findPackage('follower-growth-enterprise')?.budgetUsd,900);
});
