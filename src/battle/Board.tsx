import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import manifest from '../../public/assets/animations/animation-manifest.json';
import { abilityAbsorption, effectiveness, mapHeight, mapWidth, MOVES } from '../content/data';
import type { AttackVisualEvent, Battle, FeedbackEvent, Unit } from '../game/types';
import { active, affectedTiles, canHitWithMove, inMoveRange, reachableTiles, unitAt } from '../game/engine';
import { mobilityState } from '../game/mobility';
import { enqueueAttackCues } from './visualQueue';
import { gameAudio } from '../audio/audio';

const TILE = 64;
const colors: Record<string, number> = { plain: 0x42776d, water: 0x336c9b, lava: 0xbb5844, wall: 0x263c48 };
const clips = manifest.clips as Record<string, { startColumn: number; frameCount: number; fps: number; loop: boolean }>;
type Props = { battle: Battle; mode: 'move' | 'attack' | 'inspect'; chosenMove?: string; target?: [number, number]; onTile: (x: number, y: number) => void; onAnimationState?: (playing: boolean) => void };

class BattleScene extends Phaser.Scene {
  battle!: Battle;
  mode: Props['mode'] = 'inspect';
  chosenMove?: string;
  target?: [number, number];
  onTile: Props['onTile'] = () => {};
  onAnimationState: Props['onAnimationState'] = () => {};
  terrain!: Phaser.GameObjects.Graphics;
  ground!: Phaser.GameObjects.Graphics;
  targetOverlay!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  sprites = new Map<string, Phaser.GameObjects.Sprite>();
  markers = new Map<string, { shadow: Phaser.GameObjects.Ellipse; ripple: Phaser.GameObjects.Ellipse }>();
  hp = new Map<string, Phaser.GameObjects.Graphics>();
  seen = new Map<string, number>();
  seenAttacks = new Set<string>();
  seenFeedback = new Set<string>();
  pendingFeedback: FeedbackEvent[] = [];
  pendingAttacks: AttackVisualEvent[] = [];
  playingAttack?: AttackVisualEvent;
  draining = false;
  catchingUp = false;
  movingUnits = new Set<string>();
  constructor() { super('battle'); }
  preload() {
    const unitIds = new Set([manifest.fallbackUnit, ...this.battle.units.map(unit => unit.species)]);
    const moveIds = new Set(this.battle.units.flatMap(unit => unit.moves));
    for (const [id, url] of Object.entries(manifest.units)) if (unitIds.has(id)) this.load.spritesheet(id, url, { frameWidth: 32, frameHeight: 32 });
    for (const [id, url] of Object.entries(manifest.effects)) this.load.spritesheet(`effect-${id}`, url, { frameWidth: 32, frameHeight: 32 });
    for (const [id, asset] of Object.entries(manifest.attacks)) if (moveIds.has(id)) this.load.spritesheet(`attack-${id}`, asset.url, { frameWidth: 32, frameHeight: 32 });
  }
  create() {
    this.terrain = this.add.graphics().setDepth(0);
    this.ground = this.add.graphics().setDepth(1);
    this.targetOverlay = this.add.graphics().setDepth(2);
    this.drawTerrain();
    const unitIds = new Set([manifest.fallbackUnit, ...this.battle.units.map(unit => unit.species)]);
    const moveIds = new Set(this.battle.units.flatMap(unit => unit.moves));
    for (const id of Object.keys(manifest.units).filter(id => unitIds.has(id))) for (let direction = 0; direction < 4; direction++) for (const [clip, data] of Object.entries(clips)) {
      const start = direction * manifest.columns + data.startColumn;
      this.anims.create({ key: `${id}-${direction}-${clip}`, frames: this.anims.generateFrameNumbers(id, { start, end: start + data.frameCount - 1 }), frameRate: data.fps, repeat: data.loop ? -1 : 0 });
    }
    for (const id of Object.keys(manifest.effects)) this.anims.create({ key: `effect-${id}`, frames: this.anims.generateFrameNumbers(`effect-${id}`, { start: 0, end: 3 }), frameRate: manifest.effectFps });
    for (const id of Object.keys(manifest.attacks).filter(id => moveIds.has(id))) {
      const frames = this.anims.generateFrameNumbers(`attack-${id}`, { start: 0, end: manifest.attackFrameCount - 1 });
      this.anims.create({ key: `attack-${id}`, frames, frameRate: manifest.attackFps });
      this.anims.create({ key: `attack-${id}-travel`, frames, frameRate: manifest.attackFps, repeat: -1 });
    }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTile(Math.floor(pointer.x / TILE), Math.floor(pointer.y / TILE)));
    this.renderBattle();
    this.playFeedback();
    void this.playNextAttack();
    this.updateAnimationState();
  }
  drawTerrain() {
    for (let y = 0; y < mapHeight(this.battle.map); y++) for (let x = 0; x < mapWidth(this.battle.map); x++) {
      const tile = this.battle.map.tiles[y][x], left = x * TILE, top = y * TILE;
      this.terrain.fillStyle(colors[tile.kind], 1); this.terrain.fillRect(left + 1, top + 1, TILE - 2, TILE - 2);
      const zone = this.battle.map.zones[y][x];
      if (zone !== 'neutral') { this.terrain.fillStyle(zone === 'ally' ? 0x9de1b7 : 0xedb4a2, 0.13); this.terrain.fillRect(left + 1, top + 1, TILE - 2, TILE - 2); }
      if (tile.height) { this.terrain.fillStyle(0xd8e1a8, 0.18 * tile.height); this.terrain.fillRect(left + 1, top + 1, TILE - 2, TILE - 2); }
      if (tile.height) this.add.text(left + 5, top + 4, `H${tile.height}`, { fontFamily: 'monospace', fontSize: '11px', color: '#f0f5da' }).setDepth(3);
      if (tile.kind === 'water') this.add.text(left + 5, top + 45, '≈', { fontFamily: 'monospace', fontSize: '18px', color: '#bce5ff' }).setDepth(3);
      if (tile.kind === 'lava') this.add.text(left + 5, top + 45, '◆', { fontFamily: 'monospace', fontSize: '13px', color: '#ffbc73' }).setDepth(3);
    }
  }
  setProps(props: Props) {
    const boardChanged = this.battle !== props.battle || this.mode !== props.mode || this.chosenMove !== props.chosenMove;
    const targetChanged = this.target?.[0] !== props.target?.[0] || this.target?.[1] !== props.target?.[1];
    this.battle = props.battle; this.mode = props.mode; this.chosenMove = props.chosenMove; this.target = props.target; this.onTile = props.onTile; this.onAnimationState = props.onAnimationState;
    const incoming = (props.battle.visualEvents ?? []).filter(event => !this.seenAttacks.has(event.id));
    for (const event of incoming) this.seenAttacks.add(event.id);
    if (incoming.length) {
      const { queue, skipped } = enqueueAttackCues(this.pendingAttacks, incoming);
      this.pendingAttacks = queue;
      if (skipped || incoming.length > 1 || queue.length > 1) this.catchingUp = true;
    }
    const recentIds = new Set((props.battle.visualEvents ?? []).map(event => event.id));
    for (const id of this.seenAttacks) if (!recentIds.has(id)) this.seenAttacks.delete(id);
    const cues = (props.battle.feedbackEvents ?? []).filter(event => !this.seenFeedback.has(event.id));
    for (const event of cues) this.seenFeedback.add(event.id);
    this.pendingFeedback = [...this.pendingFeedback, ...cues].slice(-4);
    const currentFeedback = new Set((props.battle.feedbackEvents ?? []).map(event => event.id));
    for (const id of this.seenFeedback) if (!currentFeedback.has(id)) this.seenFeedback.delete(id);
    if (this.ground) { if (boardChanged) this.renderBattle(); else if (targetChanged) this.renderTarget(); this.playFeedback(); void this.playNextAttack(); }
  }
  private playFeedback() {
    if (!this.ground) return;
    for (const event of this.pendingFeedback.splice(0)) {
      const unit = this.battle.units.find(candidate => candidate.id === event.unitId);
      if (!unit) continue;
      if (event.kind === 'ability') gameAudio.playAbility(event.key);
      else gameAudio.playItem(event.key);
      const label = this.add.text(unit.x * TILE + TILE / 2, unit.y * TILE - 5, event.key, {
        fontFamily: 'monospace', fontSize: '13px', color: event.kind === 'ability' ? '#fff0a7' : '#b4f5d0',
        backgroundColor: '#10262ddd', padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 1).setDepth(20);
      this.tweens.add({ targets: label, y: label.y - 17, alpha: 0, duration: 850, onComplete: () => label.destroy() });
    }
  }
  private tileCenter([x, y]: [number, number]): [number, number] { return [x * TILE + TILE / 2, y * TILE + TILE / 2 - 4]; }
  private unitCenter(unit: Unit, [x, y]: [number, number]): [number, number] {
    const [centerX, centerY] = this.tileCenter([x, y]);
    const state = mobilityState(unit.mobility.canFly, unit.mobility.canSwim, this.battle.map.tiles[y][x]);
    return [centerX, centerY + (state === 'flying' ? -10 : state === 'swimming' ? 4 : 0)];
  }
  private markerCenter([x, y]: [number, number]): [number, number] { return [x * TILE + TILE / 2, y * TILE + TILE / 2 + 17]; }
  private showMarkers(unit: Unit, markers: { shadow: Phaser.GameObjects.Ellipse; ripple: Phaser.GameObjects.Ellipse }, [x, y]: [number, number]) {
    const state = mobilityState(unit.mobility.canFly, unit.mobility.canSwim, this.battle.map.tiles[y][x]);
    markers.shadow.setVisible(state === 'flying');
    markers.ripple.setVisible(state === 'swimming');
  }
  private wait(ms: number): Promise<void> { return new Promise(resolve => this.time.delayedCall(ms, resolve)); }
  private updateAnimationState() { this.onAnimationState?.(this.draining || this.movingUnits.size > 0); }
  private async playNextAttack() {
    if (this.draining || !this.pendingAttacks.length || !this.ground) return;
    this.draining = true; this.updateAnimationState();
    while (this.pendingAttacks.length && this.scene.isActive()) {
      const event = this.pendingAttacks.shift()!;
      this.playingAttack = event;
      await this.playAttackEvent(event, this.catchingUp);
      this.playingAttack = undefined;
      this.renderBattle();
    }
    this.draining = false; this.updateAnimationState();
    this.catchingUp = false;
    if (this.pendingAttacks.length && this.scene.isActive()) void this.playNextAttack();
  }
  private async playAttackEvent(event: AttackVisualEvent, fast: boolean) {
    gameAudio.playMove(event.moveId);
    const asset = manifest.attacks[event.moveId as keyof typeof manifest.attacks];
    if (!asset) {
      const [x, y] = this.tileCenter(event.to);
      const fallback = this.add.sprite(x, y, 'effect-attack-impact').setScale(1.55).setDepth(11);
      fallback.play('effect-attack-impact');
      fallback.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fallback.destroy());
      await this.wait(fast ? 160 : Math.round(1000 * manifest.effectFrameCount / manifest.effectFps));
      return;
    }
    const attacker = this.battle.units.find(unit => unit.id === event.sourceId);
    const attackerSprite = this.sprites.get(event.sourceId);
    if (attacker && attackerSprite) {
      const [sourceX, sourceY] = this.unitCenter(attacker, event.from);
      const markers = this.markers.get(event.sourceId);
      if (markers) {
        const [markerX, markerY] = this.markerCenter(event.from);
        markers.shadow.setPosition(markerX, markerY); markers.ripple.setPosition(markerX, markerY);
        this.showMarkers(attacker, markers, event.from);
      }
      this.tweens.killTweensOf(attackerSprite);
      attackerSprite.setPosition(sourceX, sourceY);
      const facing = event.to[0] > event.from[0] ? 2 : event.to[0] < event.from[0] ? 1 : event.to[1] < event.from[1] ? 3 : 0;
      const texture = Object.hasOwn(manifest.units, attacker.species) ? attacker.species : manifest.fallbackUnit;
      attackerSprite.play(`${texture}-${facing}-${asset.style === 'weather' || asset.style === 'self' ? 'special' : 'attack'}`, true);
    }
    await this.wait(fast ? 50 : 100);
    if (asset.style === 'projectile') {
      const [sx, sy] = attacker ? this.unitCenter(attacker, event.from) : this.tileCenter(event.from), [tx, ty] = this.tileCenter(event.to);
      const projectile = this.add.sprite(sx, sy, `attack-${event.moveId}`).setScale(1.5).setDepth(10);
      projectile.play(`attack-${event.moveId}-travel`);
      const distance = Math.abs(tx - sx) + Math.abs(ty - sy);
      const duration = fast ? Math.min(160, Math.max(75, distance * 0.4)) : Math.max(150, distance) * 1.1;
      await new Promise<void>(resolve => this.tweens.add({ targets: projectile, x: tx, y: ty, duration, ease: 'Sine.easeInOut', onComplete: () => { projectile.destroy(); resolve(); } }));
    }
    const width = mapWidth(this.battle.map), height = mapHeight(this.battle.map);
    const tiles: [number, number][] = asset.style === 'weather'
      ? [[0.2, 0.2], [0.45, 0.3], [0.7, 0.55], [0.8, 0.8]].map(([x, y]) => [Math.min(width - 1, Math.floor(x * width)), Math.min(height - 1, Math.floor(y * height))])
      : event.tiles.length ? event.tiles : [event.to];
    const unique = [...new Map(tiles.map(tile => [tile.join(','), tile])).values()];
    for (const tile of unique) {
      const [x, y] = this.tileCenter(tile);
      const effect = this.add.sprite(x, y, `attack-${event.moveId}`).setScale(asset.style === 'area' ? 1.8 : 1.55).setDepth(11);
      effect.play(`attack-${event.moveId}`);
      effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.destroy());
    }
    for (const id of event.targetIds) {
      const target = this.battle.units.find(unit => unit.id === id), sprite = this.sprites.get(id);
      if (!target || !sprite) continue;
      const texture = Object.hasOwn(manifest.units, target.species) ? target.species : manifest.fallbackUnit;
      sprite.play(`${texture}-${target.facing}-${target.hp <= 0 ? 'faint' : 'hurt'}`, true);
    }
    if (event.targetIds.length) gameAudio.playCue('pokemonHit');
    await this.wait(fast ? 160 : Math.round(1000 * manifest.attackFrameCount / manifest.attackFps));
    if (attacker && attackerSprite?.active && attacker.hp > 0) {
      const texture = Object.hasOwn(manifest.units, attacker.species) ? attacker.species : manifest.fallbackUnit;
      attackerSprite.play(`${texture}-${attacker.facing}-idle`, true);
    }
  }
  renderBattle() {
    if (!this.battle || !this.ground) return;
    this.ground.clear();
    for (const label of this.labels) label.destroy(); this.labels = [];
    const current = active(this.battle);
    const moveHighlights = this.mode === 'move' && current.side === 'player' && current.ap > 0 ? reachableTiles(this.battle, current) : new Set<string>();
    const attackMove = this.mode === 'attack' && this.chosenMove && current.side === 'player' ? MOVES[this.chosenMove] : undefined;
    for (let y = 0; y < mapHeight(this.battle.map); y++) for (let x = 0; x < mapWidth(this.battle.map); x++) {
      const tile = this.battle.map.tiles[y][x], left = x * TILE, top = y * TILE;
      if (tile.hazardUntil && tile.hazardUntil > this.battle.time) { this.ground.lineStyle(3, 0xd4b5a5, 0.9); this.ground.strokeRect(left + 5, top + 5, TILE - 10, TILE - 10); }
      if (tile.mudUntil && tile.mudUntil > this.battle.time) { this.ground.fillStyle(0x563c31, 0.6); this.ground.fillCircle(left + 52, top + 13, 6); }
      if (tile.coverUntil && tile.coverUntil > this.battle.time) { this.ground.fillStyle(0x999a9a, 0.9); this.ground.fillTriangle(left + 48, top + 12, left + 57, top + 12, left + 53, top + 4); }
      if (moveHighlights.has(`${x},${y}`)) { this.ground.fillStyle(0x9fe4bd, 0.3); this.ground.fillRect(left + 2, top + 2, TILE - 4, TILE - 4); }
      if (attackMove && (attackMove.target !== 'unit' || x !== current.x || y !== current.y) && inMoveRange(this.battle, current, this.chosenMove!, x, y)) {
        this.ground.fillStyle(0x8bbcff, 0.22); this.ground.fillRect(left + 2, top + 2, TILE - 4, TILE - 4);
      }
      const defender = attackMove ? unitAt(this.battle, x, y) : undefined;
      if (attackMove?.power && defender && canHitWithMove(this.battle, current, this.chosenMove!, defender)) {
        const absorbed = !!abilityAbsorption(defender.ability, attackMove.type);
        const multiplier = absorbed ? 0 : effectiveness(attackMove.type, defender.types);
        const color = multiplier === 0 ? 0xa7aeb3 : multiplier < 1 ? 0xeea47d : multiplier > 1 ? 0x7be3a6 : 0xf0d985;
        this.ground.lineStyle(3, color); this.ground.strokeRect(left + 4, top + 4, TILE - 8, TILE - 8);
        this.labels.push(this.add.text(left + 36, top + 4, absorbed ? 'ABS' : `${multiplier}×`, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#183033' }).setDepth(8));
      }
      if (this.battle.map.capture?.[0] === x && this.battle.map.capture[1] === y) {
        this.ground.lineStyle(3, this.battle.captureHeld ? 0x7be0a3 : 0xe7d477); this.ground.strokeCircle(left + 32, top + 32, 22);
      }
    }
    for (const unit of this.battle.units) this.drawUnit(unit);
    const protectedIds = new Set([...(this.playingAttack ? [this.playingAttack] : []), ...this.pendingAttacks].flatMap(event => [event.sourceId, ...event.targetIds]));
    for (const [id, sprite] of this.sprites) if (!this.battle.units.some(u => u.id === id && u.hp > 0) && !protectedIds.has(id)) {
      gameAudio.playCue('pokemonFaint');
      this.movingUnits.delete(id); this.updateAnimationState();
      sprite.destroy(); this.sprites.delete(id);
      const markers = this.markers.get(id); markers?.shadow.destroy(); markers?.ripple.destroy(); this.markers.delete(id);
      this.hp.get(id)?.destroy(); this.hp.delete(id);
    }
    this.renderTarget();
  }
  renderTarget() {
    if (!this.targetOverlay) return;
    this.targetOverlay.clear();
    if (!this.target) return;
    const [x, y] = this.target;
    if (this.mode === 'attack' && this.chosenMove && MOVES[this.chosenMove]) {
      for (const [tx, ty] of affectedTiles(this.battle.map, this.chosenMove, x, y)) {
        this.targetOverlay.fillStyle(0xffd576, 0.25);
        this.targetOverlay.fillRect(tx * TILE + 4, ty * TILE + 4, TILE - 8, TILE - 8);
      }
    }
    this.targetOverlay.lineStyle(4, 0xffd576);
    this.targetOverlay.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
  }
  private animateRoute(sprite: Phaser.GameObjects.Sprite, markers: { shadow: Phaser.GameObjects.Ellipse; ripple: Phaser.GameObjects.Ellipse }, path: [number, number][], unit: Unit, texture: string, facing: number) {
    this.tweens.killTweensOf(sprite);
    this.tweens.killTweensOf(markers.shadow);
    this.tweens.killTweensOf(markers.ripple);
    sprite.play(`${texture}-${facing}-move`, true);
    this.movingUnits.add(unit.id); this.updateAnimationState();
    const step = (index: number) => {
      if (!sprite.active) { this.movingUnits.delete(unit.id); this.updateAnimationState(); return; }
      if (index >= path.length) { sprite.play(`${texture}-${facing}-idle`, true); this.movingUnits.delete(unit.id); this.updateAnimationState(); return; }
      const point = path[index];
      this.showMarkers(unit, markers, point);
      const [x, y] = this.unitCenter(unit, point), [markerX, markerY] = this.markerCenter(point);
      this.tweens.add({ targets: [markers.shadow, markers.ripple], x: markerX, y: markerY, duration: 150, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: sprite, x, y, duration: 150, ease: 'Sine.easeInOut', onComplete: () => step(index + 1) });
    };
    step(0);
  }
  drawUnit(unit: Unit) {
    if (unit.hp <= 0) return;
    const texture = Object.hasOwn(manifest.units, unit.species) ? unit.species : manifest.fallbackUnit;
    let sprite = this.sprites.get(unit.id);
    const [x, y] = this.unitCenter(unit, [unit.x, unit.y]);
    const [markerX, markerY] = this.markerCenter([unit.x, unit.y]);
    let markers = this.markers.get(unit.id);
    if (!markers) {
      const shadow = this.add.ellipse(markerX, markerY, 35, 11, 0x071d24, 0.55).setDepth(4);
      const ripple = this.add.ellipse(markerX, markerY, 42, 15, 0x9eddfa, 0.18).setStrokeStyle(2, 0xc5f0ff, 0.9).setDepth(4);
      markers = { shadow, ripple }; this.markers.set(unit.id, markers);
    }
    const newVisual = this.seen.get(unit.id) !== unit.visualNonce;
    if (!sprite) { sprite = this.add.sprite(x, y, texture).setScale(1.65).setDepth(5); this.sprites.set(unit.id, sprite); sprite.play(`${texture}-${unit.facing}-idle`); }
    else if (newVisual && unit.visual === 'move' && unit.visualPath?.length) this.animateRoute(sprite, markers, unit.visualPath, unit, texture, unit.facing);
    else if ((sprite.x !== x || sprite.y !== y) && !this.tweens.isTweening(sprite)) this.tweens.add({ targets: sprite, x, y, duration: 230, ease: 'Sine.easeInOut' });
    if (!(unit.visual === 'move' && (newVisual || this.tweens.isTweening(sprite)))) {
      this.showMarkers(unit, markers, [unit.x, unit.y]);
      if (!this.tweens.isTweening(markers.shadow)) markers.shadow.setPosition(markerX, markerY);
      if (!this.tweens.isTweening(markers.ripple)) markers.ripple.setPosition(markerX, markerY);
    }
    if (newVisual) {
      this.seen.set(unit.id, unit.visualNonce ?? 0);
      const clip = unit.visual && clips[unit.visual] ? unit.visual : 'idle';
      if (clip !== 'move' || !unit.visualPath?.length) sprite.play(`${texture}-${unit.facing}-${clip}`, true);
      if (clip !== 'idle' && clip !== 'move') sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite?.play(`${texture}-${unit.facing}-idle`, true));
      if (clip === 'hurt' || clip === 'buff' || clip === 'special') {
        const effect = clip === 'hurt' ? 'status' : clip === 'special' ? 'mega' : 'buff';
        const burst = this.add.sprite(x, y, `effect-${effect}`).setScale(1.5).setDepth(8);
        burst.play(`effect-${effect}`); burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
      }
    }
    let bar = this.hp.get(unit.id); if (!bar) { bar = this.add.graphics().setDepth(7); this.hp.set(unit.id, bar); }
    bar.clear(); bar.fillStyle(0x10242b); bar.fillRect(x - 24, y + 22, 48, 7);
    bar.fillStyle(unit.side === 'player' ? 0x9ee3b5 : 0xf69b8c); bar.fillRect(x - 23, y + 23, 46 * unit.hp / unit.maxHp, 5);
    if (unit.id === this.battle.current) { this.ground.lineStyle(3, unit.side === 'player' ? 0xffe08c : 0xff8d70); this.ground.strokeRect(unit.x * TILE + 2, unit.y * TILE + 2, 60, 60); }
  }
}

export default function Board(props: Props) {
  const holder = useRef<HTMLDivElement>(null), scene = useRef<BattleScene | null>(null);
  const width = mapWidth(props.battle.map), height = mapHeight(props.battle.map);
  useEffect(() => {
    if (!holder.current) return;
    const boardScene = new BattleScene(); scene.current = boardScene; boardScene.setProps(props);
    const game = new Phaser.Game({ type: Phaser.AUTO, width: TILE * width, height: TILE * height, parent: holder.current, backgroundColor: '#14262d', pixelArt: true, antialias: false, scene: boardScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
    if (import.meta.env.MODE === 'profile') (window as Window & { __profileBattleScene?: BattleScene }).__profileBattleScene = boardScene;
    return () => { game.destroy(true); scene.current = null; if (import.meta.env.MODE === 'profile') delete (window as Window & { __profileBattleScene?: BattleScene }).__profileBattleScene; };
  }, [width, height]);
  useEffect(() => { scene.current?.setProps(props); }, [props]);
  return <div className="board" ref={holder} style={{ aspectRatio: `${width} / ${height}` }} aria-label={`${width} by ${height} battle board`} />;
}
