import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import Board from '../../src/battle/Board';
import { createMap } from '../../src/content/maps';
import { SPECIES } from '../../src/content/species';
import { statsAtLevel } from '../../src/game/engine';
import { mobilityFor } from '../../src/game/mobility';
import '../../src/style.css';
import { runBrowserBench } from './browserBench';

const width = 32;
const row = (y) => Array.from({ length: width }, (_, x) => {
  if (x >= 20 && x <= 22 && y >= 7 && y <= 18 && y !== 12) return '#';
  if (x >= 16 && x <= 18 && y >= 10 && y <= 19) return '~';
  if (x >= 23 && x <= 25 && y >= 20 && y <= 27) return '^';
  return '.';
}).join('');
const map = createMap({
  id: 'profile-32', name: 'Profile 32×32', weather: 'snow',
  terrain: Array.from({ length: width }, (_, y) => row(y)),
  elevation: Array.from({ length: width }, (_, y) => Array.from({ length: width }, (_, x) => x >= 10 && x <= 14 && y >= 11 && y <= 22 ? '1' : '0').join('')),
  zones: Array.from({ length: width }, () => 'A'.repeat(8) + 'N'.repeat(16) + 'E'.repeat(8)),
  playerSpawns: [[1, 4], [1, 7], [1, 10], [1, 13], [1, 16], [1, 19], [1, 22], [1, 25]],
  enemySpawns: [[30, 4], [30, 7], [30, 10], [30, 13], [30, 16], [30, 19], [30, 22], [30, 25]],
  capture: [15, 16],
});
for (let y = 3; y < 29; y += 5) for (let x = 6; x < 27; x += 5) {
  const tile = map.tiles[y][x];
  if (tile.kind === 'plain') tile.hazardUntil = 200;
}

const allies = ['pikachu', 'bulbasaur', 'squirtle', 'lapras', 'geodude', 'meowth', 'vulpix', 'charmander'];
const enemies = ['geodude', 'squirtle', 'vulpix', 'meowth', 'pikachu', 'lapras', 'bulbasaur', 'charmander'];
function makeUnit(speciesId, side, index) {
  const species = SPECIES[speciesId];
  const x = side === 'player' ? 9 : 13, y = 4 + index * 3;
  const stats = statsAtLevel(speciesId, 12);
  return {
    id: `${side}-${index}`, side, species: speciesId, name: species.name, level: 12,
    types: species.types, mobility: mobilityFor(species, map.tiles[y][x]), ability: species.ability,
    stats, moves: [...new Set([...species.moves, 'thunderbolt', 'sunnyDay', 'sandstorm'])],
    hp: stats[0], maxHp: stats[0], x, y, facing: side === 'player' ? 2 : 1,
    ap: 8, maxAp: 8, attackedThisTurn: false, status: {},
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 },
    item: 'None', itemAttackMultiplier: 1, mega: false,
  };
}
const units = [...allies.map((id, i) => makeUnit(id, 'player', i)), ...enemies.map((id, i) => makeUnit(id, 'enemy', i))];
const initialBattle = {
  map, tileChanges: {}, objective: 'defeat-and-capture', units, weather: 'snow', weatherUntil: 300,
  time: 0, round: 1, turnOrder: units.map(unit => unit.id), turnIndex: 0,
  current: units[0].id, rngState: 12345, log: [], visualEvents: [], captureHeld: false,
  encounterId: 'profile-32',
};

function Fixture() {
  const [battle, setBattle] = useState(initialBattle);
  const [mode, setMode] = useState('inspect');
  const [target, setTarget] = useState(undefined);
  useEffect(() => {
    window.__profile = {
      ready: false, playing: false,
      inspect() { setMode('inspect'); setTarget(undefined); },
      target(x = 13, y = 4) { setMode('attack'); setTarget([x, y]); },
      change(index = 0) {
        setBattle(previous => ({ ...previous, time: previous.time + 1,
          units: previous.units.map((unit, i) => i === index % previous.units.length
            ? { ...unit, hp: Math.max(1, unit.hp - 1), visual: 'hurt', visualNonce: (unit.visualNonce ?? 0) + 1 }
            : unit),
        }));
      },
      weather() {
        setBattle(previous => ({ ...previous, weather: previous.weather === 'rain' ? 'snow' : 'rain',
          weatherUntil: previous.time + 300, time: previous.time + 1,
          visualEvents: [...previous.visualEvents, {
            id: `weather-${previous.time}`, moveId: 'sunnyDay', sourceId: units[0].id,
            from: [units[0].x, units[0].y], to: [units[0].x, units[0].y], tiles: [], targetIds: [],
          }].slice(-24),
        }));
      },
      animate() {
        setBattle(previous => ({ ...previous,
          visualEvents: [...previous.visualEvents, ...Array.from({ length: 8 }, (_, i) => ({
            id: `attack-${previous.time}-${i}`, moveId: 'thunderbolt',
            sourceId: units[i].id, from: [units[i].x, units[i].y],
            to: [13, 4 + i * 3], tiles: [[13, 4 + i * 3], [14, 4 + i * 3], [13, 5 + i * 3], [14, 5 + i * 3]],
            targetIds: [units[i + 8].id],
          }))].slice(-24), time: previous.time + 1,
        }));
      },
      sceneStats() {
        const scene = window.__profileBattleScene;
        return scene && {
          gameObjects: scene.children.list.length, terrainCommands: scene.terrain.commandBuffer.length,
          overlayCommands: scene.ground.commandBuffer.length, targetCommands: scene.targetOverlay.commandBuffer.length, labels: scene.labels.length,
          sprites: scene.sprites.size, hpBars: scene.hp.size,
        };
      },
    };
    return () => { delete window.__profile; };
  }, []);
  useEffect(() => { void runBrowserBench().catch(error => {
    document.getElementById('profile-status').textContent = `Profiling failed: ${error.message}`;
  }); }, []);
  return <main><div id="profile-status">Loading battle</div><pre id="profile-results" hidden />
    <Board battle={battle} mode={mode} chosenMove="thunderbolt" target={target}
      onTile={() => {}} onAnimationState={playing => { if (window.__profile) { window.__profile.playing = playing; window.__profile.ready = true; } }} /></main>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
