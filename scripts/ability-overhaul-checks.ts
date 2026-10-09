import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABILITY_IDS, activeAbilities, abilityAbsorption, abilityDamageMultiplier, abilityHitChance } from '../src/content/abilities';
import type { AbilityId } from '../src/content/abilities';
import { itemCanEquip } from '../src/content/items';
import { MOVES } from '../src/content/moves';
import { SPECIES } from '../src/content/species';
import { active, chooseCapsuleAbility, completeBattle, createLabBattle, damagePreview, effectiveSpeed, evolve, newRun, passTurn, selectRouteNode, startAbilityCapsule, startBattle, teachTm, useAbilityPatch, useEvolutionItem, useMove, useSpecial, xpForLevel } from '../src/game/engine';
import { availableRouteNodes, createRoute } from '../src/game/route';
import { restoreRun, snapshotRun } from '../src/persistence/save';
import type { Battle, PartyMon, Run, Unit, Weather } from '../src/game/types';
import RouteScreen from '../src/ui/RouteScreen';

const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const countItem = (run: Run, item: 'Ability Capsule' | 'Ability Patch') => run.bag.filter(id => id === item).length;
const profile = (mon: PartyMon) => ({ givenAbility: mon.givenAbility, hiddenAbility: mon.hiddenAbility, hiddenAbilityUnlocked: mon.hiddenAbilityUnlocked });

function routeRun(species: string[] = ['bulbasaur']): Run {
  const run = newRun(species);
  run.seed = run.rngState = 5050;
  run.route = createRoute(run.seed);
  return run;
}

function campaignBattle(run: Run): Run {
  const first = availableRouteNodes(run.route).find(node => node.kind === 'battle');
  assert.ok(first, 'fixture should have a first-column battle');
  return startBattle(selectRouteNode(run, first.id));
}

function activateUnit(battle: Battle, unit: Unit) {
  for (let turns = 0; turns < 100 && active(battle).id !== unit.id; turns++) passTurn(battle);
  assert.equal(active(battle).id, unit.id, 'fixture unit should receive a turn');
}

function lab(ally: string, enemy: string, weather: Weather = 'clear'): Battle {
  const battle = createLabBattle({ allySpecies: ally, enemySpecies: enemy, allyLevel: 10, enemyLevel: 10,
    allyItem: 'None', enemyItem: 'None', weather, seed: 2 });
  activateUnit(battle, battle.units.find(unit => unit.side === 'player')!);
  return battle;
}

function assertFeedback(battle: Battle, ability: AbilityId, unit: Unit) {
  assert.ok(battle.feedbackEvents.some(event => event.kind === 'ability' && event.key === ability && event.unitId === unit.id),
    `${ability} feedback should name the matching ability and Pokémon`);
}

function verifyItemsAndPersistence(): Run {
  let run = routeRun();
  const monId = run.party[0].id, initial = profile(run.party[0]);
  assert.ok(countItem(run, 'Ability Capsule') > 0, 'new runs should contain a Capsule for testing');
  assert.ok(countItem(run, 'Ability Patch') > 0, 'new runs should contain a Patch for testing');
  assert.equal(itemCanEquip('Ability Capsule', 'bulbasaur'), false);
  assert.equal(itemCanEquip('Ability Patch', 'bulbasaur'), false);
  assert.deepEqual(initial, { givenAbility: SPECIES.bulbasaur.ability, hiddenAbility: SPECIES.bulbasaur.hiddenAbility, hiddenAbilityUnlocked: false });
  // Spare items prove replays are rejected even when inventory still permits another use.
  run.bag.push('Ability Capsule', 'Ability Capsule', 'Ability Patch');
  const untouched = jsonCopy(run);
  assert.strictEqual(startAbilityCapsule(run, monId, 'hidden'), run, 'a locked hidden slot cannot be rerolled');
  assert.deepEqual(run, untouched, 'invalid use must leave Pokémon, inventory and RNG unchanged');
  const locked = campaignBattle(run).battle!.units.find(unit => unit.partyId === monId)!;
  assert.deepEqual(activeAbilities(locked), [initial.givenAbility]);
  assert.equal(abilityDamageMultiplier(locked, MOVES.tackle), 1, 'locked Technician must not boost damage');

  const capsulesBefore = countItem(run, 'Ability Capsule');
  run = startAbilityCapsule(run, monId, 'given');
  const offer = jsonCopy(run.pendingAbilityChange!);
  assert.equal(offer.slot, 'given');
  assert.equal(offer.choices.length, 3);
  assert.equal(new Set(offer.choices).size, 3);
  assert.ok(offer.choices.every(id => ABILITY_IDS.includes(id) && id !== initial.givenAbility && id !== initial.hiddenAbility));
  assert.equal(countItem(run, 'Ability Capsule'), capsulesBefore, 'rolling an offer must not consume a Capsule');
  assert.notEqual(run.rngState, untouched.rngState, 'a valid offer should commit its seeded roll');
  const pendingState = jsonCopy(run);
  assert.strictEqual(startAbilityCapsule(run, monId, 'given'), run, 'an existing offer cannot be rerolled');
  assert.strictEqual(startAbilityCapsule(run, monId, 'hidden'), run, 'an existing offer cannot switch slots');
  assert.deepEqual(run, pendingState);
  const upgrading = routeRun(['bulbasaur', 'vulpix']);
  upgrading.party[0].level = 12;
  const reserved = startAbilityCapsule(upgrading, upgrading.party[0].id, 'given');
  assert.strictEqual(evolve(reserved, reserved.party[0].id), reserved, 'ordinary evolution must wait for a Capsule choice');
  assert.strictEqual(useEvolutionItem(reserved, 'Fire Stone', reserved.party[1].id), reserved, 'item evolution must wait for a Capsule choice');
  assert.strictEqual(teachTm(reserved, 'TM Swift', reserved.party[0].id, 0), reserved, 'TM use must wait for a Capsule choice');
  assert.strictEqual(useAbilityPatch(reserved, reserved.party[0].id), reserved, 'Patch use must wait for a Capsule choice');
  const nonOffer = ABILITY_IDS.find(id => !offer.choices.includes(id))!;
  assert.strictEqual(chooseCapsuleAbility(run, nonOffer), run, 'a non-offered ability must be rejected');
  assert.deepEqual(run, pendingState);
  const sparseOffer = jsonCopy(run);
  delete sparseOffer.pendingAbilityChange!.choices[1];
  assert.strictEqual(chooseCapsuleAbility(sparseOffer, undefined as unknown as AbilityId), sparseOffer,
    'a missing choice and invalid ability must not consume a Capsule or corrupt a slot');
  assert.strictEqual(chooseCapsuleAbility(sparseOffer, sparseOffer.pendingAbilityChange!.choices[0]), sparseOffer,
    'an incomplete offer must also reject a valid remaining choice');
  const pendingSnapshot = snapshotRun(run);
  assert.equal(pendingSnapshot.schemaVersion, 28);
  run = restoreRun(jsonCopy(pendingSnapshot))!;
  assert.equal(run.phase, 'route');
  assert.deepEqual(run.pendingAbilityChange, offer, 'refresh must retain all three choices and the slot');
  assert.equal(run.rngState, pendingState.rngState, 'refresh must not advance or reset the offer RNG');
  run = chooseCapsuleAbility(run, offer.choices[0]);
  assert.equal(run.party[0].givenAbility, offer.choices[0]);
  assert.equal(run.party[0].hiddenAbility, initial.hiddenAbility);
  assert.equal(run.party[0].hiddenAbilityUnlocked, false);
  assert.equal(run.pendingAbilityChange, undefined);
  assert.equal(countItem(run, 'Ability Capsule'), capsulesBefore - 1);
  const applied = jsonCopy(run);
  assert.strictEqual(chooseCapsuleAbility(run, offer.choices[0]), run, 'replaying confirmation must not consume another Capsule');
  assert.deepEqual(run, applied);

  const patchesBefore = countItem(run, 'Ability Patch');
  const givenBeforePatch = run.party[0].givenAbility;
  run = useAbilityPatch(run, monId);
  assert.equal(run.party[0].hiddenAbilityUnlocked, true);
  assert.equal(run.party[0].givenAbility, givenBeforePatch);
  assert.equal(countItem(run, 'Ability Patch'), patchesBefore - 1);
  assert.equal(run.rngState, applied.rngState, 'Patch unlocks should not roll RNG');
  const patched = jsonCopy(run);
  assert.strictEqual(useAbilityPatch(run, monId), run, 'a second Patch use on an unlocked Pokémon must fail');
  assert.deepEqual(run, patched);
  const unlocked = campaignBattle(run).battle!.units.find(unit => unit.partyId === monId)!;
  assert.deepEqual(activeAbilities(unlocked), [run.party[0].givenAbility, run.party[0].hiddenAbility]);

  run = startAbilityCapsule(run, monId, 'hidden');
  const hiddenOffer = run.pendingAbilityChange!;
  assert.ok(hiddenOffer.choices.every(id => id !== run.party[0].givenAbility && id !== run.party[0].hiddenAbility));
  const hiddenChoice = hiddenOffer.choices[0];
  run = chooseCapsuleAbility(run, hiddenChoice);
  assert.equal(run.party[0].givenAbility, givenBeforePatch, 'rerolling hidden must preserve given');
  assert.equal(run.party[0].hiddenAbility, hiddenChoice);
  assert.equal(run.party[0].hiddenAbilityUnlocked, true);
  assert.equal(countItem(run, 'Ability Capsule'), capsulesBefore - 2);
  run = startAbilityCapsule(run, monId, 'given');
  const restored = restoreRun(jsonCopy(snapshotRun(run)))!;
  assert.equal(restored.phase, 'route');
  assert.deepEqual(profile(restored.party[0]), profile(run.party[0]), 'customized unlocked profiles must survive refresh');
  assert.deepEqual(restored.pendingAbilityChange, run.pendingAbilityChange);
  assert.equal(restored.rngState, run.rngState);
  return restored;
}

function verifyHiddenBattleEffects() {
  const damage = lab('meowth', 'bulbasaur');
  const attacker = active(damage), defender = damage.units.find(unit => unit.side === 'enemy')!;
  defender.y = attacker.y - 1;
  const ordinaryDamage = damagePreview(damage, attacker, defender, 'tackle').max;
  attacker.hiddenAbility = 'Tough Claws';
  assert.equal(abilityDamageMultiplier(attacker, MOVES.tackle), 1.5 * 1.3, 'independent given and hidden damage bonuses should multiply');
  assert.ok(damagePreview(damage, attacker, defender, 'tackle').max > ordinaryDamage);
  assert.equal(useMove(damage, 'tackle', defender.x, defender.y), undefined);
  assertFeedback(damage, 'Technician', attacker);
  assertFeedback(damage, 'Tough Claws', attacker);

  const absorption = lab('squirtle', 'meowth');
  const waterSource = active(absorption), waterTarget = absorption.units.find(unit => unit.side === 'enemy')!;
  waterTarget.hiddenAbility = 'Water Absorb';
  waterTarget.hp = waterTarget.maxHp - 20;
  const healthBefore = waterTarget.hp;
  assert.equal(abilityAbsorption(waterTarget, 'Water')!.ability, 'Water Absorb');
  assert.equal(damagePreview(absorption, waterSource, waterTarget, 'waterPulse').max, 0);
  assert.equal(useMove(absorption, 'waterPulse', waterTarget.x, waterTarget.y), undefined);
  assert.equal(waterTarget.hp, healthBefore + Math.ceil(waterTarget.maxHp / 4));
  assertFeedback(absorption, 'Water Absorb', waterTarget);
  assert.ok(absorption.log.some(line => line.includes('Water Absorb')));

  const fire = lab('charmander', 'meowth');
  const fireTarget = fire.units.find(unit => unit.side === 'enemy')!;
  fireTarget.hiddenAbility = 'Flash Fire';
  const fireHealth = fireTarget.hp;
  assert.equal(useMove(fire, 'ember', fireTarget.x, fireTarget.y), undefined);
  assert.equal(fireTarget.hp, fireHealth);
  assert.equal(fireTarget.status.flashFire, 1);
  assertFeedback(fire, 'Flash Fire', fireTarget);
  assert.ok(fire.log.some(line => line.includes('Flash Fire')));

  const evasion = lab('meowth', 'lapras', 'sandstorm');
  const elusive = evasion.units.find(unit => unit.side === 'enemy')!;
  elusive.hiddenAbility = 'Sand Veil';
  assert.equal(abilityHitChance(elusive, 'sandstorm'), 0.8);
  assert.equal(abilityHitChance(elusive, 'clear'), 1);
  evasion.rngState = 20000; // First seeded roll is 0.987: a deterministic miss.
  const elusiveHealth = elusive.hp;
  assert.equal(useMove(evasion, 'quickAttack', elusive.x, elusive.y), undefined);
  assert.equal(elusive.hp, elusiveHealth);
  assertFeedback(evasion, 'Sand Veil', elusive);
  assert.ok(evasion.log.some(line => line.includes('missed')));

  const speed = lab('meowth', 'lapras', 'sun');
  const speedy = active(speed);
  speedy.hiddenAbility = 'Chlorophyll';
  assert.equal(effectiveSpeed(speedy, speed), speedy.stats[5] * 2);
  passTurn(speed);
  activateUnit(speed, speedy);
  assert.equal(speedy.scheduledSpeed, speedy.stats[5] * 2);
  assertFeedback(speed, 'Chlorophyll', speedy);

  const contact = lab('meowth', 'lapras');
  const contactSource = active(contact), contactTarget = contact.units.find(unit => unit.side === 'enemy')!;
  contactTarget.hiddenAbility = 'Static';
  contactTarget.y = contactSource.y - 1;
  contact.rngState = 2; // The third roll after critical/damage rolls is 0.189: Static triggers.
  assert.equal(useMove(contact, 'tackle', contactTarget.x, contactTarget.y), undefined);
  assert.ok(contactSource.status.paralyzed > contact.time);
  assertFeedback(contact, 'Static', contactTarget);
  assert.ok(contact.log.some(line => line.includes('by Static')));
}

function verifyEvolutionAndMega() {
  const growth = routeRun(['bulbasaur', 'vulpix']);
  for (const mon of growth.party) {
    mon.givenAbility = 'Static'; mon.hiddenAbility = 'Tough Claws'; mon.hiddenAbilityUnlocked = true;
    mon.level = 12; mon.xp = xpForLevel(12);
  }
  const expected = profile(growth.party[0]);
  const evolved = evolve(growth, growth.party[0].id);
  assert.equal(evolved.party[0].species, 'ivysaur');
  assert.deepEqual(profile(evolved.party[0]), expected);
  const stoneEvolved = useEvolutionItem(evolved, 'Fire Stone', growth.party[1].id);
  assert.equal(stoneEvolved.party[1].species, 'ninetales');
  assert.deepEqual(profile(stoneEvolved.party[1]), expected, 'item evolution should retain the customized profile');

  for (const hiddenAbilityUnlocked of [false, true]) {
    const ordinary = routeRun(['charmander']);
    ordinary.party[0].givenAbility = 'Static'; ordinary.party[0].hiddenAbility = 'Water Absorb';
    ordinary.party[0].hiddenAbilityUnlocked = hiddenAbilityUnlocked; ordinary.party[0].item = 'Charizardite X';
    const ordinaryProfile = profile(ordinary.party[0]);
    const started = campaignBattle(ordinary), battle = started.battle!, mon = battle.units.find(unit => unit.side === 'player')!;
    activateUnit(battle, mon);
    assert.equal(useSpecial(battle), undefined);
    assert.equal(mon.species, 'charizard-mega-x');
    assert.deepEqual(activeAbilities(mon), hiddenAbilityUnlocked
      ? [SPECIES['charizard-mega-x'].ability, SPECIES['charizard-mega-x'].hiddenAbility]
      : [SPECIES['charizard-mega-x'].ability]);
    assert.deepEqual(profile(started.party[0]), ordinaryProfile, 'temporary Mega abilities must not overwrite the owned profile');
    const restoredMega = restoreRun(jsonCopy(snapshotRun(started)))!;
    assert.equal(restoredMega.phase, 'battle');
    assert.deepEqual(activeAbilities(restoredMega.battle!.units.find(unit => unit.side === 'player')!), activeAbilities(mon));
    battle.result = 'win';
    const completed = completeBattle(started);
    assert.equal(completed.party[0].species, 'charmander');
    assert.deepEqual(profile(completed.party[0]), ordinaryProfile);
  }
}

function verifySaveMigration() {
  const started = campaignBattle(routeRun(['squirtle', 'pikachu']));
  passTurn(started.battle!);
  const legacy = { ...jsonCopy(snapshotRun(started)), schemaVersion: 27 };
  for (const mon of legacy.run.party) {
    delete (mon as Partial<PartyMon>).givenAbility;
    delete (mon as Partial<PartyMon>).hiddenAbility;
    delete (mon as Partial<PartyMon>).hiddenAbilityUnlocked;
  }
  const restored = restoreRun(legacy)!;
  assert.equal(restored.phase, 'battle', 'a v27 active battle should continue without returning to preparation');
  assert.deepEqual(jsonCopy(snapshotRun(restored)).run.battle!.units, legacy.run.battle!.units,
    'migration should preserve the existing ability, HP, AP and action schedule');
  assert.equal(restored.battle!.rngState, started.battle!.rngState);
  for (const mon of restored.party) assert.deepEqual(profile(mon), {
    givenAbility: SPECIES[mon.species].ability, hiddenAbility: SPECIES[mon.species].hiddenAbility, hiddenAbilityUnlocked: false,
  });
  assert.ok(restored.battle!.units.every(unit => unit.hiddenAbility === undefined));
  passTurn(restored.battle!);
  passTurn(started.battle!);
  assert.equal(restored.battle!.current, started.battle!.current, 'continued turns should resolve identically after migration');
  assert.equal(restored.battle!.time, started.battle!.time);
  assert.equal(restored.battle!.rngState, started.battle!.rngState);
  const rewritten = snapshotRun(restored);
  assert.equal(rewritten.schemaVersion, 28);
  assert.equal(restoreRun(jsonCopy(rewritten))!.phase, 'battle', 'a migrated active battle must survive the next v28 save');
}

function verifyAbilityBattleSaveItems() {
  const started = campaignBattle(routeRun());
  for (const item of ['Ability Capsule', 'Ability Patch', 'TM Swift', 'TM Thunderbolt', 'Fire Stone'] as const) {
    const invalid = jsonCopy(snapshotRun(started));
    invalid.run.battle!.units.find(unit => unit.side === 'player')!.item = item;
    const restored = restoreRun(invalid)!;
    assert.equal(restored.phase, 'prepare', `${item} must not be accepted as a battle held item`);
    assert.equal(restored.battle, undefined, 'an invalid battle must restart before it can return a Bag item as held equipment');
    assert.equal(restored.party[0].item, started.party[0].item, 'battle recovery must preserve the owned held item');
    assert.deepEqual(restored.bag, started.bag, 'invalid battle equipment must not grant extra Bag items');
  }
  for (const item of ['None', 'Leftovers', 'Sitrus Berry', 'Assault Vest', 'X Attack'] as const) {
    const valid = jsonCopy(snapshotRun(started));
    valid.run.battle!.units.find(unit => unit.side === 'player')!.item = item;
    const restored = restoreRun(valid)!;
    assert.equal(restored.phase, 'battle', `${item} must remain valid battle equipment`);
    assert.equal(restored.battle!.units.find(unit => unit.side === 'player')!.item, item);
  }
  const ordinary = routeRun(['charmander']);
  ordinary.party[0].item = 'Charizardite X';
  const megaRun = campaignBattle(ordinary), mega = megaRun.battle!.units.find(unit => unit.side === 'player')!;
  activateUnit(megaRun.battle!, mega);
  assert.equal(useSpecial(megaRun.battle!), undefined);
  for (const schemaVersion of [27, 28] as const) {
    const saved = { ...jsonCopy(snapshotRun(megaRun)), schemaVersion };
    const restored = restoreRun(saved)!;
    assert.equal(restored.phase, 'battle', `v${schemaVersion} Mega saves must retain their compatible base-species stone`);
    assert.equal(restored.battle!.units.find(unit => unit.side === 'player')!.item, 'Charizardite X');
  }
}

function verifyDurableAbilityOfferUi() {
  const run = routeRun(), monId = run.party[0].id;
  const offered = startAbilityCapsule(run, monId, 'given');
  const offer = offered.pendingAbilityChange!;
  const untouched = jsonCopy(offered);
  const noAction = () => {};
  const render = (abilityOfferStatus?: 'saving' | 'failed', canCancel = true) => renderToStaticMarkup(createElement(RouteScreen, {
    run: offered, onChoose: noAction, onBack: noAction, onEquipItem: noAction, onEvolve: noAction,
    onTeachTm: noAction, onUseEvolutionItem: noAction, onStartAbilityCapsule: noAction,
    onChooseCapsuleAbility: noAction, onUseAbilityPatch: noAction, abilityOfferStatus,
    onRetryAbilityOffer: noAction, onCancelUnsavedAbilityOffer: canCancel ? noAction : undefined,
  }));
  for (const status of ['saving', 'failed'] as const) {
    const markup = render(status);
    assert.equal((markup.match(/<button\b[^>]*class="ability-choice"/g) ?? []).length, 0,
      `${status} offers must not render random choice buttons`);
    for (const ability of offer.choices) assert.equal(markup.includes(ability), false,
      `${status} offers must not reveal the randomly rolled ${ability}`);
    assert.ok(markup.includes('Choose later'), `${status} offers can still be dismissed`);
    assert.equal(markup.includes('Your Capsule choices are saved.'), false,
      `${status} notices must not claim that persistence succeeded`);
    if (status === 'saving') {
      assert.ok(markup.includes('Saving ability choices…'));
      assert.ok(markup.includes('aria-busy="true"'));
      assert.equal(markup.includes('Cancel use'), false, 'a pending write must not be cancellable');
    } else {
      assert.ok(markup.includes('Retry saving'), 'failed offers need a retry action');
      assert.ok(markup.includes('Cancel use'), 'failed unrevealed offers may be cancelled when authorized');
    }
  }
  assert.equal(render('failed', false).includes('Cancel use'), false,
    'failed offers must not expose cancellation without a callback');
  const ready = render();
  assert.equal((ready.match(/<button\b[^>]*class="ability-choice"/g) ?? []).length, 3,
    'durable or loaded offers render exactly three choice buttons');
  for (const ability of offer.choices) assert.ok(ready.includes(ability), `durable offers must show ${ability}`);
  assert.equal(ready.includes('Retry saving'), false);
  assert.equal(ready.includes('Cancel use'), false, 'a durable offer cannot be cancelled to reroll');
  assert.deepEqual(offered, untouched, 'rendering save status must retain target, slot, choices, inventory and RNG');
}

export function verifyAbilityOverhaul() {
  const customized = verifyItemsAndPersistence();
  const invalid = jsonCopy(snapshotRun(customized));
  invalid.run.party[0].givenAbility = 'missing-ability' as AbilityId;
  assert.equal(restoreRun(invalid)!.phase, 'starter', 'saves must reject unknown assigned abilities');
  verifyHiddenBattleEffects();
  verifyEvolutionAndMega();
  verifySaveMigration();
  verifyAbilityBattleSaveItems();
  verifyDurableAbilityOfferUi();
  console.log('Ability overhaul: item transactions, persisted offers, dual passives and feedback, evolution/Mega profiles, and v27/v28 saves passed.');
}
