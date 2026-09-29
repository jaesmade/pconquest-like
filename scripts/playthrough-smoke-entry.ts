import assert from 'node:assert/strict';
import { validateCatalog } from '../src/content/catalog';
import { MOVES } from '../src/content/moves';
import { EnemyPlanner } from '../src/game/enemyPlanner';
import { active, apGain, canHitAtTarget, canUseMove, commitEnemyAction, completeBattle, createLabBattle, damagePreview, finishTurn, moveUnit, newRun, nextEncounter, passTurn, resolveLevelMove, selectRouteNode, startBattle, useMove } from '../src/game/engine';
import { reachable } from '../src/game/grid';
import { availableRouteNodes, createRoute } from '../src/game/route';
import type { Battle, Unit } from '../src/game/types';

const note = (message: string) => console.log(message);
const distance = (a: Unit, b: Unit) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function choosePlayerAction(battle: Battle): string {
  const actor = active(battle);
  const enemies = battle.units.filter(unit => unit.side === 'enemy' && unit.hp > 0);
  if (!actor.attackedThisTurn) {
    const choices: { moveId: string; x: number; y: number; damage: number }[] = [];
    for (const moveId of actor.moves) {
      const move = MOVES[moveId];
      if (!move?.power || actor.ap < move.apCost) continue;
      for (const enemy of enemies) for (let y = 0; y < battle.map.tiles.length; y++) for (let x = 0; x < battle.map.tiles[y].length; x++) {
        if (!canUseMove(battle, actor, moveId, x, y) || !canHitAtTarget(battle, actor, moveId, x, y, enemy)) continue;
        const damage = damagePreview(battle, actor, enemy, moveId).damage;
        if (damage > 0) choices.push({ moveId, x, y, damage });
      }
    }
    choices.sort((a, b) => b.damage - a.damage);
    if (choices[0]) {
      const choice = choices[0];
      assert.equal(useMove(battle, choice.moveId, choice.x, choice.y), undefined);
      finishTurn(battle);
      return `${actor.name} used ${MOVES[choice.moveId].name}`;
    }
  }
  const currentDistance = Math.min(...enemies.map(enemy => distance(actor, enemy)));
  const destinations = [...reachable(battle, actor)].map(([key, path]) => ({ key, path,
    distance: Math.min(...enemies.map(enemy => {
      const [x, y] = key.split(',').map(Number);
      return Math.abs(x - enemy.x) + Math.abs(y - enemy.y);
    })) })).filter(candidate => candidate.path.points.length && candidate.distance < currentDistance)
    .sort((a, b) => a.distance - b.distance || a.path.cost - b.path.cost);
  if (destinations[0]) {
    const [x, y] = destinations[0].key.split(',').map(Number);
    assert.equal(moveUnit(battle, x, y), undefined);
    finishTurn(battle);
    return `${actor.name} moved to ${x},${y}`;
  }
  passTurn(battle);
  return `${actor.name} passed`;
}

assert.deepEqual(validateCatalog(), [], 'content catalog should load');
let run = newRun(['lapras', 'pikachu', 'geodude']);
run.seed = 20260928;
run.rngState = run.seed;
run.route = createRoute(run.seed);
assert.equal(run.phase, 'route');
assert.equal(run.party.length, 3);
const firstNode = availableRouteNodes(run.route)[0];
assert.equal(firstNode.kind, 'battle');
run = selectRouteNode(run, firstNode.id);
assert.equal(run.phase, 'prepare');
run = startBattle(run);
assert.equal(run.phase, 'battle');
const battle = run.battle!;
const planner = new EnemyPlanner();
const actions: string[] = [];
for (let step = 0; step < 400 && !battle.result; step++) {
  if (active(battle).side === 'player') actions.push(choosePlayerAction(battle));
  else {
    let decision = planner.plan(battle, 32);
    let slices = 0;
    while (decision.pending && slices++ < 1000) decision = planner.plan(battle, 32);
    assert.equal(decision.pending, false, 'enemy planner should settle within bounded slices');
    if (!decision.pending) {
      const actor = active(battle);
      const acted = commitEnemyAction(battle, decision.action);
      planner.afterCommit(decision.action, acted);
      actions.push(`${actor.name} ${decision.action.kind}`);
    }
  }
}
assert.ok(battle.result, 'first battle should reach a result within 400 actions');
note(`Campaign: draft → route → preparation → ${battle.result} in ${actions.length} actions, ${battle.round} rounds.`);
note(`Campaign actions: ${actions.slice(0, 12).join(' | ')}${actions.length > 12 ? ' | …' : ''}`);
run = completeBattle(run);
if (battle.result === 'win') {
  assert.equal(run.phase, 'intermission');
  assert.ok(run.report.some(line => line.includes('XP')));
  while (run.pendingMoves.length) {
    const offer = run.pendingMoves[0];
    run = resolveLevelMove(run, offer.monId, offer.moveId);
  }
  run = nextEncounter(run);
  assert.equal(run.phase, 'route');
  assert.equal(run.route.visited.length, 1);
  note(`Rewards: XP and coins awarded; returned to route column ${run.encounter + 1}.`);
} else {
  assert.equal(run.phase, 'result');
  note('Campaign ended in a loss; reward and next-route flow were not reached.');
}

function lab(allySpecies: string, enemySpecies: string, allyLevel = 13, enemyLevel = 13, seed = 12345) {
  return createLabBattle({ allySpecies, enemySpecies, allyLevel, enemyLevel, allyItem: 'None', enemyItem: 'None', weather: 'clear', seed });
}
function activateSide(battle: Battle, side: Unit['side']) {
  for (let i = 0; i < 3 && active(battle).side !== side; i++) passTurn(battle);
  assert.equal(active(battle).side, side);
}
function activateSideWithAp(battle: Battle, side: Unit['side'], minimumAp: number) {
  for (let i = 0; i < 300 && (active(battle).side !== side || active(battle).ap < minimumAp); i++) passTurn(battle);
  assert.equal(active(battle).side, side);
  assert.ok(active(battle).ap >= minimumAp);
}

const timeline = lab('bulbasaur', 'meowth');
const firstActor = active(timeline);
const waitingActor = timeline.units.find(unit => unit.id !== firstActor.id)!;
firstActor.stats[5] = 100;
passTurn(timeline);
assert.equal(active(timeline).id, waitingActor.id);
waitingActor.stats[5] = 125;
passTurn(timeline);
assert.equal(timeline.time, 80, '125 Speed should act after 80 AV');
assert.equal(active(timeline).id, waitingActor.id, 'the faster unit should take its next turn first');
firstActor.stats[5] = 200;
finishTurn(timeline);
assert.ok(Math.abs(firstActor.nextAction - 90) < 1e-9, 'doubling a waiting unit\'s Speed should halve its remaining AV');
passTurn(timeline);
assert.equal(timeline.time, 90);
assert.equal(active(timeline).id, firstActor.id);
note('Battle Lab: 100/125/200 SPD timeline intervals and proportional Speed rescheduling passed.');

const movementRules = lab('meowth', 'geodude', 13, 13, 321);
activateSide(movementRules, 'player');
const mover = active(movementRules);
assert.equal(mover.ap, 3, 'a Pokémon should start its turn with 3 AP');
assert.equal(mover.maxAp, 3);
assert.ok(movementRules.units.every(unit => apGain(unit, movementRules) === 3), 'AP gain should be fixed across species');
const multiTile = [...reachable(movementRules, mover)].find(([, path]) => path.points.length > 1);
assert.ok(multiTile, 'the test should find a reachable multi-tile Move');
assert.equal(multiTile[1].cost, 1, 'a multi-tile Move should still cost 1 AP');
const [moveX, moveY] = multiTile[0].split(',').map(Number);
assert.equal(moveUnit(movementRules, moveX, moveY), undefined);
assert.equal(mover.ap, 2, 'movement should spend exactly 1 AP');
assert.equal(mover.movedThisTurn, true);
assert.equal(reachable(movementRules, mover).size, 0, 'movement should not be offered a second time this turn');
assert.match(moveUnit(movementRules, mover.x, mover.y), /already moved/i);
const opponent = movementRules.units.find(unit => unit.side === 'enemy')!;
mover.stats[5] = 1;
opponent.stats[5] = 100;
passTurn(movementRules);
for (let i = 0; i < 300 && active(movementRules).id !== opponent.id; i++) passTurn(movementRules);
assert.equal(active(movementRules).id, opponent.id, 'the opponent should receive a turn before the mover returns');
assert.equal(opponent.maxAp, 3, 'the opposing Pokémon should also gain 3 AP per turn');
assert.ok(opponent.ap >= 3, 'the opposing Pokémon may also have banked AP');
for (let i = 0; i < 300 && active(movementRules).id !== mover.id; i++) passTurn(movementRules);
assert.equal(active(movementRules).id, mover.id);
assert.equal(mover.ap, 5, 'the next turn should add 3 AP to the 2 AP banked');
assert.equal(mover.movedThisTurn, false, 'the one-Move limit should reset on the next turn');
note('Battle Lab: fixed 3 AP, one 1-AP multi-tile Move, blocked repeat Move, and AP banking passed.');

const attackRules = lab('squirtle', 'charmander', 13, 13, 654);
activateSide(attackRules, 'player');
const attacker = active(attackRules);
const attackTarget = attackRules.units.find(unit => unit.side === 'enemy')!;
let attackChoice: { moveId: string; x: number; y: number } | undefined;
for (const moveId of attacker.moves) for (let y = 0; y < attackRules.map.tiles.length && !attackChoice; y++)
  for (let x = 0; x < attackRules.map.tiles[y].length && !attackChoice; x++)
    if (canUseMove(attackRules, attacker, moveId, x, y) && canHitAtTarget(attackRules, attacker, moveId, x, y, attackTarget)) attackChoice = { moveId, x, y };
assert.ok(attackChoice, 'the test should find one valid Attack');
assert.equal(useMove(attackRules, attackChoice.moveId, attackChoice.x, attackChoice.y), undefined);
assert.equal(attacker.attackedThisTurn, true);
assert.equal(canUseMove(attackRules, attacker, attackChoice.moveId, attackChoice.x, attackChoice.y), false);
assert.notEqual(useMove(attackRules, attackChoice.moveId, attackChoice.x, attackChoice.y), undefined, 'a second Attack should be rejected');
note('Battle Lab: the second Attack in one turn was rejected.');

const weather = lab('geodude', 'meowth');
activateSideWithAp(weather, 'player', MOVES.sandstorm.apCost);
const weatherSource = active(weather);
assert.ok(weatherSource.moves.includes('sandstorm'));
assert.equal(useMove(weather, 'sandstorm', weatherSource.x, weatherSource.y), undefined);
assert.equal(weather.weather, 'sandstorm');
note('Battle Lab: Sandstorm cast changed weather.');

const stage = lab('bulbasaur', 'geodude');
activateSide(stage, 'player');
const stageSource = active(stage);
assert.ok(stageSource.moves.includes('harden'));
assert.equal(useMove(stage, 'harden', stageSource.x, stageSource.y), undefined);
assert.equal(stageSource.stages.defense, 1);
note('Battle Lab: Harden raised Defense by one stage.');

const displacement = lab('squirtle', 'charmander', 10, 20);
activateSide(displacement, 'player');
const displacedTarget = displacement.units.find(unit => unit.side === 'enemy')!;
assert.equal(useMove(displacement, 'waterPulse', displacedTarget.x, displacedTarget.y), undefined);
assert.equal(displacedTarget.y, 0);
note('Battle Lab: Water Pulse damaged and pushed the target one tile.');

const tile = lab('geodude', 'meowth', 13, 20);
activateSide(tile, 'player');
const tileTarget = tile.units.find(unit => unit.side === 'enemy')!;
assert.equal(useMove(tile, 'rockThrow', tileTarget.x, tileTarget.y), undefined);
assert.ok((tile.map.tiles[tileTarget.y][tileTarget.x].coverUntil ?? 0) > tile.time);
note('Battle Lab: Rock Throw created timed cover on hit.');

let burned = false;
for (let seed = 1; seed <= 64 && !burned; seed++) {
  const status = lab('charmander', 'bulbasaur', 13, 20, seed);
  activateSide(status, 'player');
  const target = status.units.find(unit => unit.side === 'enemy')!;
  assert.equal(useMove(status, 'ember', target.x, target.y), undefined);
  burned = (target.status.burned ?? 0) > status.time;
}
assert.ok(burned, 'Ember should eventually inflict Burn across seeded casts');
note('Battle Lab: Ember inflicted Burn in a seeded cast.');

let chainAttempted = false;
for (let seed = 1; seed <= 64 && !chainAttempted; seed++) {
  const chain = lab('pikachu', 'squirtle', 13, 20, seed);
  activateSide(chain, 'player');
  const target = chain.units.find(unit => unit.side === 'enemy')!;
  const grounded = { ...structuredClone(target), id: 'ground-chain-target', x: 3, y: 1,
    species: 'geodude', name: 'Geodude', types: ['Ground', 'Rock'], ability: 'Sand Veil' as const };
  chain.units.push(grounded);
  assert.equal(useMove(chain, 'thunderShock', target.x, target.y), undefined);
  chainAttempted = chain.visualEvents.at(-1)?.tiles.some(([x, y]) => x === grounded.x && y === grounded.y) ?? false;
  if (chainAttempted) {
    assert.equal(grounded.hp, grounded.maxHp, 'Ground secondary target must remain immune to Electric chain');
    assert.ok(chain.log.some(line => line.includes('immune to Electric')));
  }
}
assert.ok(chainAttempted, 'Thunder Shock should attempt a chain across seeded casts');
note('Battle Lab: Thunder Shock chained; Ground secondary target stayed immune.');

const statusAI = lab('meowth', 'geodude');
activateSideWithAp(statusAI, 'enemy', MOVES.sandstorm.apCost);
active(statusAI).moves = ['sandstorm'];
const statusPlanner = new EnemyPlanner();
let statusChoice = statusPlanner.plan(statusAI, 32);
while (statusChoice.pending) statusChoice = statusPlanner.plan(statusAI, 32);
assert.deepEqual(statusChoice.action, { kind: 'move-use', moveId: 'sandstorm', x: active(statusAI).x, y: active(statusAI).y });
const statusActed = commitEnemyAction(statusAI, statusChoice.action);
statusPlanner.afterCommit(statusChoice.action, statusActed);
assert.equal(statusAI.weather, 'sandstorm');
let repeatChoice = statusPlanner.plan(statusAI, 32);
while (repeatChoice.pending) repeatChoice = statusPlanner.plan(statusAI, 32);
assert.deepEqual(repeatChoice.action, { kind: 'pass' }, 'AI should not recast active weather');
note('Battle Lab: enemy chose useful weather, then declined to recast it.');

note('PASS: scripted gameplay playthrough and representative effect families.');
