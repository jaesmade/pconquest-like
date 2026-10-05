import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/content/encounters';
import { ELITE_MAP_ID, MAPS, NORMAL_MAP_IDS } from '../src/content/maps';
import { SPECIES } from '../src/content/species';
import { validateCatalog } from '../src/content/catalog';
import { active, apGain, cancelPreparation, completeBattle, createLabBattle, defaultLoadoutAtLevel, effectiveSpeed, encounterDefinition, evolve, newRun, nextEncounter, offerRecruits, passTurn, recruit, resolveLevelMove, resolveSpecial, selectRouteNode, startBattle, statsAtLevel, teachTm, useEvolutionItem, useSpecial, xpForLevel } from '../src/game/engine';
import { enemyCounts, ENEMY_RANKS, resolveEnemyEncounter } from '../src/game/enemyRanks';
import { latestMovesAtLevel } from '../src/game/movesets';
import { canDeploy } from '../src/game/deployment';
import { createRoute } from '../src/game/route';
import { actionInterval, timelineSpeed } from '../src/game/actionValue';
import { changeStage, expireStages } from '../src/game/stages';
import { restoreRun, snapshotRun } from '../src/persistence/save';
import type { BattleCategory, EnemyRank, Run } from '../src/game/types';

function routeRun(column: number, category: 'battle' | 'elite' | 'boss'): Run {
  const run = newRun(['pikachu', 'squirtle', 'charmander']);
  run.seed = run.rngState = 13579;
  run.route = createRoute(run.seed);
  const target = run.route.nodes.find(node => node.column === column && node.kind === category)!;
  assert.ok(target);
  const path = [target.id];
  while (run.route.nodes.find(node => node.id === path[0])!.column > 1) path.unshift(run.route.links.find(link => link.to === path[0])!.from);
  run.route.visited = path;
  run.currentNodeId = target.id;
  run.encounter = column - 1;
  run.encounterId = category === 'boss' ? ENCOUNTERS.at(-1)!.id : ENCOUNTERS[(column - 1) % 3].id;
  run.phase = 'prepare';
  return run;
}

const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function verifyRankedEncounters() {
  const examples: [BattleCategory, number, number, number, number][] = [
    ['normal', 1, 3, 0, 0], ['normal', 9, 3, 0, 0], ['normal', 15, 5, 0, 0], ['normal', 19, 7, 0, 0], ['normal', 21, 8, 0, 0],
    ['elite', 12, 3, 1, 0], ['elite', 15, 4, 2, 0], ['elite', 21, 5, 3, 0],
    ['boss', 9, 2, 0, 1], ['boss', 15, 3, 1, 1], ['boss', 21, 5, 2, 1],
  ];
  for (const [category, level, normal, elite, boss] of examples) assert.deepEqual(enemyCounts(category, level), { normal, elite, boss });
  for (const category of ENEMY_RANKS) {
    let previous = { normal: 0, elite: 0, boss: 0 };
    for (let level = 1; level <= 100; level++) {
      const counts = enemyCounts(category, level), total = counts.normal + counts.elite + counts.boss;
      assert.ok(total >= 3 && total <= 8);
      for (const rank of ENEMY_RANKS) assert.ok(counts[rank] >= previous[rank], 'counts must grow monotonically');
      if (category === 'normal') assert.ok(counts.normal >= 3 && counts.normal <= 8 && counts.elite === 0 && counts.boss === 0);
      if (category === 'elite') assert.ok(counts.normal >= 3 && counts.normal <= 5 && counts.elite >= 1 && counts.elite <= 3 && counts.boss === 0);
      if (category === 'boss') assert.ok(counts.normal >= 2 && counts.normal <= 5 && counts.elite <= 2 && counts.boss === 1);
      previous = counts;
    }
  }

  for (const template of ENCOUNTERS) for (const category of template.kind === 'boss' ? ['boss'] as const : ['normal', 'elite'] as const) {
    const maps = category === 'boss' ? [template.mapId] : category === 'elite' ? [ELITE_MAP_ID] : NORMAL_MAP_IDS;
    for (const mapId of maps) for (let seed = 1; seed <= 8; seed++) {
      const encounter = resolveEnemyEncounter(template, category, 21, seed, 'capacity');
      assert.equal(encounter.enemies.length, 8);
      // Exercise actual seeded spawning and fallback beyond the six authored starts.
      const oldLevel = template.enemyLevel, oldMap = template.mapId, oldKind = template.kind;
      try {
        template.enemyLevel = 21; template.mapId = mapId; template.kind = category;
        const run = newRun(['lapras']); run.seed = run.rngState = seed; run.encounterId = template.id;
        const started = startBattle(run).battle!, enemies = started.units.filter(unit => unit.side === 'enemy');
        assert.equal(enemies.length, 8);
        assert.equal(new Set(enemies.map(unit => `${unit.x},${unit.y}`)).size, 8);
        for (const enemy of enemies) {
          assert.ok(canDeploy(MAPS[mapId], enemy.species, [enemy.x, enemy.y], 'enemy'));
          assert.deepEqual(enemy.moves, defaultLoadoutAtLevel(enemy.species, 21));
          assert.equal(enemy.hp, enemy.maxHp);
        }
      } finally { template.enemyLevel = oldLevel; template.mapId = oldMap; template.kind = oldKind; }
    }
  }

  const previewRun = routeRun(3, 'elite'), before = jsonCopy(previewRun);
  const preview = encounterDefinition(previewRun);
  for (let index = 0; index < 10; index++) assert.deepEqual(encounterDefinition(previewRun), preview);
  assert.deepEqual(previewRun, before, 'preview must not mutate run or RNG');
  const canceled = cancelPreparation(previewRun), selected = selectRouteNode(canceled, before.currentNodeId!);
  assert.deepEqual(encounterDefinition(selected), preview, 'reentering preparation must keep the roster');
  const restoredPrepare = restoreRun(jsonCopy(snapshotRun(previewRun)))!;
  assert.equal(restoredPrepare.phase, 'prepare');
  assert.deepEqual(encounterDefinition(restoredPrepare), preview);
  const bossRun = startBattle(routeRun(10, 'boss'));
  assert.deepEqual(bossRun.battle!.units.filter(unit => unit.side === 'enemy').map(unit => ({ species: unit.species, rank: unit.rank })), encounterDefinition(bossRun).enemies);
  assert.equal(bossRun.battle!.units.filter(unit => unit.rank === 'boss').length, 1);
  assert.equal(bossRun.battle!.objective, 'defeat-and-capture');
  bossRun.battle!.units.find(unit => unit.rank === 'boss')!.hp -= 7;
  const restoredBoss = restoreRun(jsonCopy(snapshotRun(bossRun)))!;
  assert.equal(restoredBoss.phase, 'battle');
  assert.deepEqual(restoredBoss.battle!.units, jsonCopy(bossRun.battle!.units), 'ranked battle must round-trip HP, stats, moves and scheduling');
  assert.equal(restoredBoss.battle!.rngState, bossRun.battle!.rngState);
  const invalidRank = jsonCopy(snapshotRun(bossRun)); invalidRank.run.battle!.units.find(unit => unit.side === 'enemy')!.rank = 'invalid' as EnemyRank;
  assert.equal(restoreRun(invalidRank)!.phase, 'prepare');
  for (let index = 0; index < 7; index++) {
    const invalidStats = jsonCopy(snapshotRun(bossRun));
    invalidStats.run.battle!.units.find(unit => unit.rank === 'boss')!.stats[index]++;
    assert.equal(restoreRun(invalidStats)!.phase, 'prepare', `saved ranked stat ${index} must match the current definition`);
  }
  const invalidLevel = jsonCopy(snapshotRun(bossRun)); invalidLevel.run.battle!.units.find(unit => unit.rank === 'boss')!.level = 101;
  assert.equal(restoreRun(invalidLevel)!.phase, 'prepare');

  for (const rank of ENEMY_RANKS) {
    const battle = createLabBattle({ allySpecies: 'squirtle', enemySpecies: 'charmander', allyLevel: 15, enemyLevel: 15,
      allyItem: 'None', enemyItem: 'Charizardite X', enemyRank: rank, weather: 'clear', seed: 999 });
    const enemy = battle.units.find(unit => unit.side === 'enemy')!, originalMoves = [...enemy.moves], normal = statsAtLevel(enemy.species, 15);
    const multiplier = rank === 'normal' ? 1 : rank === 'elite' ? 2 : 3;
    normal.forEach((value, index) => assert.equal(enemy.stats[index], index === 6 ? value : value * multiplier));
    assert.equal(apGain(enemy, battle), 3);
    assert.equal(actionInterval(effectiveSpeed(enemy, battle)), actionInterval(normal[5]) / multiplier);
    changeStage(enemy, 'speed', -2, battle.time + 1000);
    assert.equal(effectiveSpeed(enemy, battle), normal[5] * multiplier / 2);
    enemy.status.paralyzed = battle.time + 1000;
    assert.equal(effectiveSpeed(enemy, battle), normal[5] * multiplier / 4);
    assert.equal(timelineSpeed(effectiveSpeed(enemy, battle), true), 4225 / (normal[5] * multiplier / 4));
    expireStages(enemy, battle.time + 1000); enemy.status.paralyzed = 0;
    assert.equal(effectiveSpeed(enemy, battle), normal[5] * multiplier);
    for (let index = 0; index < 10 && active(battle).id !== enemy.id; index++) passTurn(battle);
    assert.equal(active(battle).id, enemy.id); enemy.ap = 10;
    assert.equal(useSpecial(battle), undefined);
    assert.equal(enemy.rank, rank);
    assert.deepEqual(enemy.moves, originalMoves);
    statsAtLevel('charizard-mega-x', 15).forEach((value, index) => assert.equal(enemy.stats[index], index === 6 ? value : value * multiplier));
  }

  assert.deepEqual(defaultLoadoutAtLevel('pikachu', 10), ['thunderShock', 'tackle', 'quickAttack', 'tailWhip']);
  assert.deepEqual(defaultLoadoutAtLevel('pikachu', 11), ['tackle', 'quickAttack', 'tailWhip', 'thunderbolt']);
  assert.deepEqual(defaultLoadoutAtLevel('geodude', 13), ['tackle', 'harden', 'stealthRock', 'sandstorm']);
  assert.deepEqual(defaultLoadoutAtLevel('geodude', 15), defaultLoadoutAtLevel('geodude', 100));
  const short = { ...SPECIES.pikachu, moves: ['tackle'], learn: { 12: 'tailWhip', 13: 'tackle', 15: 'howl' } };
  assert.deepEqual(latestMovesAtLevel(short, 11), ['tackle']);
  assert.deepEqual(latestMovesAtLevel(short, 14), ['tailWhip', 'tackle']);
  assert.deepEqual(latestMovesAtLevel(short, 15), ['tailWhip', 'tackle', 'howl']);
  const oldSpecies = SPECIES.pikachu;
  try { SPECIES.pikachu = short; assert.deepEqual(validateCatalog(), [], 'short learnsets should be playable'); }
  finally { SPECIES.pikachu = oldSpecies; }
  let owned = newRun(['pikachu', 'squirtle', 'vulpix']);
  owned.party[0].level = 15; owned.party[0].xp = xpForLevel(15);
  owned = recruit(owned, 'geodude');
  assert.equal(owned.party.at(-1)!.level, 15);
  assert.deepEqual(owned.party.at(-1)!.equipped, ['tackle', 'harden', 'stealthRock', 'sandstorm']);
  // The existing player-selected set survives later starts, TMs and evolution.
  const pikachuId = owned.party[0].id;
  owned = teachTm(owned, 'TM Swift', pikachuId, 0);
  assert.equal(owned.party[0].equipped[0], 'swift');
  const ownedMoves = [...owned.party[0].equipped];
  assert.deepEqual(startBattle(owned).battle!.units.find(unit => unit.partyId === pikachuId)!.moves, ownedMoves);
  owned.party[1].level = 12;
  const evolvedMoves = [...owned.party[1].equipped]; owned = evolve(owned, owned.party[1].id);
  assert.deepEqual(owned.party[1].equipped, evolvedMoves);
  const stoneMoves = [...owned.party[2].equipped]; owned = useEvolutionItem(owned, 'Fire Stone', owned.party[2].id);
  assert.equal(owned.party[2].species, 'ninetales'); assert.deepEqual(owned.party[2].equipped, stoneMoves);
  assert.deepEqual(restoreRun(jsonCopy(snapshotRun(owned)))!.party[0].equipped, ownedMoves);

  const full = newRun(['pikachu']);
  full.party[0].level = 15; full.party[0].xp = xpForLevel(15);
  while (full.party.length < 20) full.party.push({ ...jsonCopy(full.party[0]), id: `replacement-${full.party.length}` });
  full.currentNodeId = full.route.nodes.find(node => node.kind === 'recruit')!.id;
  full.phase = 'event';
  const candidate = offerRecruits(full)[0], replaced = resolveSpecial(full, { kind: 'recruit', species: candidate, replaceId: full.party[0].id });
  assert.equal(replaced.party.length, 20); assert.equal(replaced.party[0].level, 15);
  assert.deepEqual(replaced.party[0].equipped, defaultLoadoutAtLevel(candidate, 15));
  assert.equal(replaced.selected[0], replaced.party[0].id);

  const low = startBattle(routeRun(1, 'battle')); low.battle!.result = 'win';
  const beforeLevel = [...low.party[0].equipped];
  let growth = completeBattle(low);
  assert.equal(growth.party[0].level, 11);
  assert.deepEqual(growth.party[0].equipped, beforeLevel, 'leveling must not overwrite moves');
  assert.ok(growth.pendingMoves.some(choice => choice.monId === growth.party[0].id && choice.moveId === 'thunderbolt'));
  assert.equal(nextEncounter(growth).phase, 'intermission');
  const intermission = jsonCopy(snapshotRun(growth));
  intermission.schemaVersion = 26 as 27;
  const migratedIntermission = restoreRun(intermission)!;
  assert.equal(migratedIntermission.phase, 'intermission');
  assert.deepEqual(migratedIntermission.pendingMoves, growth.pendingMoves);
  assert.deepEqual(migratedIntermission.party[0].equipped, beforeLevel);
  const offer = growth.pendingMoves[0];
  const accepted = resolveLevelMove(growth, offer.monId, offer.moveId, 0);
  assert.equal(accepted.party.find(mon => mon.id === offer.monId)!.equipped[0], offer.moveId);
  growth = resolveLevelMove(growth, offer.monId, offer.moveId);
  assert.deepEqual(growth.party[0].equipped, beforeLevel, 'declining must keep the loadout');
  const shortOwned = jsonCopy(snapshotRun(growth)); shortOwned.run.party[0].equipped = ['tackle'];
  assert.deepEqual(restoreRun(shortOwned)!.party[0].equipped, ['tackle'], 'refresh must preserve valid open slots');
  for (const version of [25, 26]) {
    const old = jsonCopy(snapshotRun(bossRun)); old.schemaVersion = version as 27;
    for (const unit of old.run.battle!.units) delete (unit as { rank?: EnemyRank }).rank;
    const migrated = restoreRun(old)!;
    assert.equal(migrated.phase, 'prepare'); assert.equal(migrated.battle, undefined);
    assert.deepEqual(migrated.party, bossRun.party);
    assert.deepEqual(migrated.route, bossRun.route);
    assert.deepEqual(encounterDefinition(migrated), encounterDefinition(bossRun));
    assert.ok(migrated.report.some(line => line.includes('enemy ranks')));
  }
  console.log('Ranked encounters: count ranges, seeded previews, eight-enemy deployment on every arena, intrinsic stats/Speed/Mega, initial latest moves, manual XP/TM choices, and v27/v26/v25 saves passed.');
}
