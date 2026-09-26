import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import manifest from '../../public/assets/animations/animation-manifest.json';
import battleAssets from '../../public/assets/battle-asset-manifest.json';
import isoAssets from '../../public/assets/environment/isometric/isometric-manifest.json';
import { abilityAbsorption, effectiveness, mapHeight, mapWidth, MOVES } from '../content/data';
import type { AttackVisualEvent, Battle, FeedbackEvent, Unit } from '../game/types';
import { active, affectedTiles, canHitWithMove, inMoveRange, unitAt } from '../game/engine';
import type { MovementPath } from '../game/grid';
import { mobilityState } from '../game/mobility';
import { enqueueAttackCues } from './visualQueue';
import { gameAudio } from '../audio/audio';
import { ISO_HALF_HEIGHT, ISO_HALF_WIDTH, isoGridAtWorld, isoTileCenter, isoWorldSize } from './isometric';

const clips = manifest.clips as Record<string, { startColumn: number; frameCount: number; fps: number; loop: boolean }>;
export type BoardView = { left: number; top: number; zoom: number; width: number; height: number };
export type CameraCommand = 'zoom-in' | 'zoom-out' | 'fit' | 'center' | 'focus';
type Props = { battle: Battle; mode: 'move' | 'attack' | 'inspect'; controlBoth?: boolean; chosenMove?: string; target?: [number, number]; moveRoutes?: Map<string, MovementPath>; onTile: (x: number, y: number) => void; onAnimationState?: (playing: boolean) => void; onViewChange?: (view: BoardView) => void; cameraAction?: { id: number; command: CameraCommand; point?: [number, number] } };

class BattleScene extends Phaser.Scene {
  battle!: Battle;
  mode: Props['mode'] = 'inspect';
  controlBoth = false;
  chosenMove?: string;
  target?: [number, number];
  moveRoutes?: Map<string, MovementPath>;
  onTile: Props['onTile'] = () => {};
  onAnimationState: Props['onAnimationState'] = () => {};
  onViewChange: Props['onViewChange'] = () => {};
  cameraActionId = -1;
  press?: { pointerId: number; startX: number; startY: number; lastX: number; lastY: number; panOnly: boolean; dragging: boolean };
  terrainTexture?: Phaser.GameObjects.RenderTexture;
  terrain!: Phaser.GameObjects.Graphics;
  ground!: Phaser.GameObjects.Graphics;
  targetOverlay!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  sprites = new Map<string, Phaser.GameObjects.Sprite>();
  markers = new Map<string, { shadow: Phaser.GameObjects.Ellipse; ripple: Phaser.GameObjects.Ellipse }>();
  hp = new Map<string, Phaser.GameObjects.Graphics>();
  cover = new Map<string, Phaser.GameObjects.Image>();
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
    for (const asset of battleAssets.assets) this.load.image(asset.id, asset.url);
    for (const [kind, urls] of Object.entries(isoAssets.tiles)) urls.forEach((url, level) => this.load.svg(`iso-${kind}-h${level}-96px`, url));
    for (const [id, url] of Object.entries(isoAssets.decorations)) this.load.svg(`iso-${id}`, url);
    const unitIds = new Set([manifest.fallbackUnit, ...this.battle.units.map(unit => unit.species)]);
    const moveIds = new Set(this.battle.units.flatMap(unit => unit.moves));
    for (const [id, url] of Object.entries(manifest.units)) if (unitIds.has(id)) this.load.spritesheet(id, url, { frameWidth: 32, frameHeight: 32 });
    for (const [id, url] of Object.entries(manifest.effects)) this.load.spritesheet(`effect-${id}`, url, { frameWidth: 32, frameHeight: 32 });
    for (const [id, asset] of Object.entries(manifest.attacks)) if (moveIds.has(id)) this.load.spritesheet(`attack-${id}`, asset.url, { frameWidth: 32, frameHeight: 32 });
  }
  create() {
    const world = isoWorldSize(this.battle.map);
    this.terrainTexture = this.add.renderTexture(0, 0, world.width, world.height).setOrigin(0).setDepth(0);
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.press) return;
      const panOnly = pointer.rightButtonDown() || pointer.middleButtonDown() || pointer.event.shiftKey;
      this.press = { pointerId: pointer.id, startX: pointer.x, startY: pointer.y, lastX: pointer.x, lastY: pointer.y, panOnly, dragging: panOnly };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const press = this.press;
      if (!press || press.pointerId !== pointer.id || !pointer.isDown) return;
      if (!press.dragging && Math.hypot(pointer.x - press.startX, pointer.y - press.startY) < 6) return;
      press.dragging = true;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - press.lastX) / camera.zoom;
      camera.scrollY -= (pointer.y - press.lastY) / camera.zoom;
      press.lastX = pointer.x; press.lastY = pointer.y;
      this.game.canvas.style.cursor = 'grabbing';
      this.emitView();
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const press = this.press;
      if (!press || press.pointerId !== pointer.id) return;
      this.press = undefined;
      this.game.canvas.style.cursor = 'grab';
      if (press.dragging || press.panOnly) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cell = isoGridAtWorld(this.battle.map, world.x, world.y);
      if (cell) this.onTile(cell[0], cell[1]);
    });
    this.input.on('pointerupoutside', () => { this.press = undefined; this.game.canvas.style.cursor = 'grab'; });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _deltaX: number, deltaY: number) => {
      this.zoom(deltaY < 0 ? 0.25 : -0.25);
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.resizeViewport());
    this.resizeViewport(true);
    this.renderBattle();
    this.playFeedback();
    void this.playNextAttack();
    this.updateAnimationState();
  }
  drawTerrain() {
    if (!this.terrainTexture) return;
    const stamp = new Phaser.GameObjects.Image(this, 0, 0, 'iso-plain-h0-96px').setOrigin(0);
    const decor = new Phaser.GameObjects.Image(this, 0, 0, 'iso-flower').setOrigin(0);
    const width = mapWidth(this.battle.map), height = mapHeight(this.battle.map);
    for (let diagonal = 0; diagonal < width + height - 1; diagonal++) for (let y = Math.max(0, diagonal - width + 1); y <= Math.min(height - 1, diagonal); y++) {
      const x = diagonal - y, tile = this.battle.map.tiles[y][x], center = isoTileCenter(this.battle.map, x, y);
      stamp.setTexture(`iso-${tile.kind}-h${tile.height}-96px`);
      this.terrainTexture.draw(stamp, center.x - ISO_HALF_WIDTH, center.y - ISO_HALF_HEIGHT);
      const occupied = [...this.battle.map.playerSpawns, ...this.battle.map.enemySpawns].some(([sx, sy]) => sx === x && sy === y)
        || (this.battle.map.capture?.[0] === x && this.battle.map.capture[1] === y);
      if (tile.kind === 'plain' && !occupied) {
        const detail = (x * 13 + y * 29) % 17;
        if (detail === 0) { decor.setTexture('iso-tree'); this.terrainTexture.draw(decor, center.x - 48, center.y - 99); }
        else if (detail === 4 || detail === 11) { decor.setTexture('iso-rock'); this.terrainTexture.draw(decor, center.x - 24, center.y - 35); }
        else if (detail === 7 || detail === 15) { decor.setTexture('iso-flower'); this.terrainTexture.draw(decor, center.x - 16, center.y - 22); }
        else if (detail === 9) { decor.setTexture('iso-bush'); this.terrainTexture.draw(decor, center.x - 24, center.y - 36); }
        else if (detail === 12 || detail === 2) { decor.setTexture('iso-grass-tuft'); this.terrainTexture.draw(decor, center.x - 12, center.y - 21); }
      }
      const zone = this.battle.map.zones[y][x];
      if (zone !== 'neutral') { this.terrain.fillStyle(zone === 'ally' ? 0x96edb0 : 0xf8a184, 0.08); this.fillDiamond(this.terrain, center.x, center.y); }
    }
    stamp.destroy(); decor.destroy();
  }
  private diamondPoints(x: number, y: number) { return [
    { x, y: y - ISO_HALF_HEIGHT }, { x: x + ISO_HALF_WIDTH, y },
    { x, y: y + ISO_HALF_HEIGHT }, { x: x - ISO_HALF_WIDTH, y },
  ]; }
  private fillDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number) { graphics.fillPoints(this.diamondPoints(x, y), true); }
  private strokeDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number) { graphics.strokePoints(this.diamondPoints(x, y), true); }
  private fitZoom() {
    const width = Math.max(1, this.scale.width), height = Math.max(1, this.scale.height);
    const world = isoWorldSize(this.battle.map);
    return Math.min(width / world.width, height / world.height, 2);
  }
  private emitView() {
    const camera = this.cameras.main;
    const corner = camera.getWorldPoint(0, 0);
    this.onViewChange?.({ left: corner.x, top: corner.y, zoom: camera.zoom, width: camera.width, height: camera.height });
  }
  private setCameraBounds() {
    const camera = this.cameras.main, world = isoWorldSize(this.battle.map);
    const marginX = camera.width / camera.zoom * 0.18, marginY = camera.height / camera.zoom * 0.18;
    camera.setBounds(-marginX, -marginY, world.width + marginX * 2, world.height + marginY * 2);
  }
  resizeViewport(initial = false) {
    if (!this.battle || !this.cameras.main) return;
    const camera = this.cameras.main;
    const width = Math.max(1, this.scale.width), height = Math.max(1, this.scale.height);
    camera.setSize(width, height);
    const world = isoWorldSize(this.battle.map);
    camera.setRoundPixels(true);
    if (initial) {
      const fit = this.fitZoom();
      camera.setZoom(Math.max(fit, Math.min(1, Math.max(width, height) / 1152)));
      const unit = this.battle.units.find(candidate => candidate.id === this.battle.current);
      if (fit >= 0.75 || !unit) camera.centerOn(world.width / 2, world.height / 2);
      else { const center = isoTileCenter(this.battle.map, unit.x, unit.y); camera.centerOn(center.x, center.y); }
    } else camera.setZoom(Math.max(this.fitZoom(), camera.zoom));
    this.setCameraBounds();
    this.emitView();
  }
  private zoom(delta: number) {
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(Math.round((camera.zoom + delta) * 4) / 4, this.fitZoom(), 2.5));
    this.setCameraBounds();
    this.emitView();
  }
  command(command: CameraCommand, point?: [number, number]) {
    const camera = this.cameras.main;
    if (!camera || !this.ground) return;
    if (command === 'zoom-in') this.zoom(0.25);
    else if (command === 'zoom-out') this.zoom(-0.25);
    else if (command === 'fit') {
      camera.setZoom(this.fitZoom());
      this.setCameraBounds();
      const world = isoWorldSize(this.battle.map); camera.centerOn(world.width / 2, world.height / 2);
      this.emitView();
    } else {
      const unit = this.battle.units.find(candidate => candidate.id === this.battle.current);
      if (command === 'focus' && point) { const center = isoTileCenter(this.battle.map, point[0], point[1]); camera.centerOn(center.x, center.y); }
      else if (unit) { const center = isoTileCenter(this.battle.map, unit.x, unit.y); camera.centerOn(center.x, center.y); }
      this.emitView();
    }
  }
  setProps(props: Props) {
    const activeChanged = this.battle?.current !== props.battle.current;
    const boardChanged = this.battle !== props.battle || this.mode !== props.mode || this.chosenMove !== props.chosenMove || this.controlBoth !== !!props.controlBoth;
    const targetChanged = this.target?.[0] !== props.target?.[0] || this.target?.[1] !== props.target?.[1];
    this.battle = props.battle; this.mode = props.mode; this.controlBoth = !!props.controlBoth; this.chosenMove = props.chosenMove; this.target = props.target; this.moveRoutes = props.moveRoutes; this.onTile = props.onTile; this.onAnimationState = props.onAnimationState; this.onViewChange = props.onViewChange;
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
    if (this.ground) {
      if (boardChanged) this.renderBattle(); else if (targetChanged) this.renderTarget();
      if (activeChanged && !props.battle.result && this.fitZoom() < 0.75) this.command('center');
      if (props.cameraAction && props.cameraAction.id !== this.cameraActionId) {
        this.cameraActionId = props.cameraAction.id; this.command(props.cameraAction.command, props.cameraAction.point);
      }
      this.playFeedback(); void this.playNextAttack();
    }
  }
  private playFeedback() {
    if (!this.ground) return;
    for (const event of this.pendingFeedback.splice(0)) {
      const unit = this.battle.units.find(candidate => candidate.id === event.unitId);
      if (!unit) continue;
      if (event.kind === 'ability') gameAudio.playAbility(event.key);
      else gameAudio.playItem(event.key);
      const center = isoTileCenter(this.battle.map, unit.x, unit.y);
      const label = this.add.text(center.x, center.y - 45, event.key, {
        fontFamily: 'monospace', fontSize: '13px', color: event.kind === 'ability' ? '#fff0a7' : '#b4f5d0',
        backgroundColor: '#10262ddd', padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 1).setDepth(20);
      this.tweens.add({ targets: label, y: label.y - 17, alpha: 0, duration: 850, onComplete: () => label.destroy() });
    }
  }
  private tileCenter([x, y]: [number, number]): [number, number] { const center = isoTileCenter(this.battle.map, x, y); return [center.x, center.y - 4]; }
  private unitCenter(unit: Unit, [x, y]: [number, number]): [number, number] {
    const [centerX, centerY] = this.tileCenter([x, y]);
    const state = mobilityState(unit.mobility.canFly, unit.mobility.canSwim, this.battle.map.tiles[y][x]);
    return [centerX, centerY - 16 + (state === 'flying' ? -10 : state === 'swimming' ? 4 : 0)];
  }
  private markerCenter([x, y]: [number, number]): [number, number] { const center = isoTileCenter(this.battle.map, x, y); return [center.x, center.y + 5]; }
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
    const moveHighlights = this.mode === 'move' && (current.side === 'player' || this.controlBoth) ? new Set(this.moveRoutes?.keys()) : new Set<string>();
    const attackMove = this.mode === 'attack' && this.chosenMove && (current.side === 'player' || this.controlBoth) ? MOVES[this.chosenMove] : undefined;
    const activeCover = new Set<string>();
    for (let y = 0; y < mapHeight(this.battle.map); y++) for (let x = 0; x < mapWidth(this.battle.map); x++) {
      const tile = this.battle.map.tiles[y][x], center = isoTileCenter(this.battle.map, x, y);
      if (tile.hazardUntil && tile.hazardUntil > this.battle.time) { this.ground.lineStyle(3, 0xe6a991, 0.95); this.strokeDiamond(this.ground, center.x, center.y); }
      if (tile.mudUntil && tile.mudUntil > this.battle.time) { this.ground.fillStyle(0x563c31, 0.7); this.ground.fillEllipse(center.x, center.y, 28, 10); }
      if (tile.coverUntil && tile.coverUntil > this.battle.time) {
        const key = `${x},${y}`; activeCover.add(key);
        if (!this.cover.has(key)) this.cover.set(key, this.add.image(center.x, center.y - 16, 'overlay-cover-16px').setScale(1.8).setDepth(3));
      }
      if (moveHighlights.has(`${x},${y}`)) { this.ground.fillStyle(0x9fe4bd, 0.38); this.fillDiamond(this.ground, center.x, center.y); }
      if (attackMove && (attackMove.target !== 'unit' || x !== current.x || y !== current.y) && inMoveRange(this.battle, current, this.chosenMove!, x, y)) {
        this.ground.fillStyle(0x8bbcff, 0.28); this.fillDiamond(this.ground, center.x, center.y);
      }
      const defender = attackMove ? unitAt(this.battle, x, y) : undefined;
      if (attackMove?.power && defender && canHitWithMove(this.battle, current, this.chosenMove!, defender)) {
        const absorbed = !!abilityAbsorption(defender.ability, attackMove.type);
        const multiplier = absorbed ? 0 : effectiveness(attackMove.type, defender.types);
        const color = multiplier === 0 ? 0xa7aeb3 : multiplier < 1 ? 0xeea47d : multiplier > 1 ? 0x7be3a6 : 0xf0d985;
        this.ground.lineStyle(3, color); this.strokeDiamond(this.ground, center.x, center.y);
        this.labels.push(this.add.text(center.x, center.y - 31, absorbed ? 'ABS' : `${multiplier}×`, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#183033' }).setOrigin(0.5).setDepth(8));
      }
      if (this.battle.map.capture?.[0] === x && this.battle.map.capture[1] === y) {
        this.ground.lineStyle(3, this.battle.captureHeld ? 0x7be0a3 : 0xe7d477); this.strokeDiamond(this.ground, center.x, center.y);
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
    for (const [key, image] of this.cover) if (!activeCover.has(key)) { image.destroy(); this.cover.delete(key); }
    this.renderTarget();
  }
  renderTarget() {
    if (!this.targetOverlay) return;
    this.targetOverlay.clear();
    if (!this.target) return;
    const [x, y] = this.target;
    if (this.mode === 'move') {
      const path = this.moveRoutes?.get(`${x},${y}`);
      if (path) {
        const actor = active(this.battle);
        this.targetOverlay.lineStyle(5, 0xffe5a0, 0.9);
        const start = isoTileCenter(this.battle.map, actor.x, actor.y);
        let fromX = start.x, fromY = start.y;
        for (const [stepX, stepY] of path.points) {
          const step = isoTileCenter(this.battle.map, stepX, stepY), toX = step.x, toY = step.y;
          this.targetOverlay.lineBetween(fromX, fromY, toX, toY);
          this.targetOverlay.fillStyle(0xffe5a0, 0.8); this.targetOverlay.fillCircle(toX, toY, 4);
          fromX = toX; fromY = toY;
        }
      }
      const center = isoTileCenter(this.battle.map, x, y);
      this.targetOverlay.lineStyle(4, path ? 0xffd576 : 0xff806d);
      this.strokeDiamond(this.targetOverlay, center.x, center.y);
      return;
    }
    if (this.mode === 'attack' && this.chosenMove && MOVES[this.chosenMove]) {
      for (const [tx, ty] of affectedTiles(this.battle.map, this.chosenMove, x, y)) {
        const affected = isoTileCenter(this.battle.map, tx, ty);
        this.targetOverlay.fillStyle(0xffd576, 0.3);
        this.fillDiamond(this.targetOverlay, affected.x, affected.y);
      }
    }
    const center = isoTileCenter(this.battle.map, x, y);
    this.targetOverlay.lineStyle(4, 0xffd576);
    this.strokeDiamond(this.targetOverlay, center.x, center.y);
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
    bar.clear(); bar.fillStyle(0x10242b); bar.fillRect(x - 24, y - 38, 48, 7);
    bar.fillStyle(unit.side === 'player' ? 0x9ee3b5 : 0xf69b8c); bar.fillRect(x - 23, y - 37, 46 * unit.hp / unit.maxHp, 5);
    if (unit.id === this.battle.current) { const center = isoTileCenter(this.battle.map, unit.x, unit.y); this.ground.lineStyle(3, unit.side === 'player' ? 0xffe08c : 0xff8d70); this.strokeDiamond(this.ground, center.x, center.y); }
  }
}

export default function Board(props: Props) {
  const holder = useRef<HTMLDivElement>(null), scene = useRef<BattleScene | null>(null);
  const width = mapWidth(props.battle.map), height = mapHeight(props.battle.map);
  useEffect(() => {
    if (!holder.current) return;
    const boardScene = new BattleScene(); scene.current = boardScene; boardScene.setProps(props);
    const game = new Phaser.Game({ type: Phaser.AUTO, width: Math.max(1, holder.current.clientWidth), height: Math.max(1, holder.current.clientHeight), parent: holder.current, backgroundColor: '#1a2733', pixelArt: true, antialias: false, scene: boardScene, scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER } });
    const observer = new ResizeObserver(() => {
      if (!holder.current) return;
      const nextWidth = Math.max(1, holder.current.clientWidth), nextHeight = Math.max(1, holder.current.clientHeight);
      if (game.scale.width !== nextWidth || game.scale.height !== nextHeight) game.scale.resize(nextWidth, nextHeight);
    });
    observer.observe(holder.current);
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    holder.current.addEventListener('contextmenu', preventMenu);
    if (import.meta.env.MODE === 'profile') (window as Window & { __profileBattleScene?: BattleScene }).__profileBattleScene = boardScene;
    return () => { observer.disconnect(); holder.current?.removeEventListener('contextmenu', preventMenu); game.destroy(true); scene.current = null; if (import.meta.env.MODE === 'profile') delete (window as Window & { __profileBattleScene?: BattleScene }).__profileBattleScene; };
  }, [width, height]);
  useEffect(() => { scene.current?.setProps(props); }, [props]);
  return <div className="board" ref={holder} aria-label={`${width} by ${height} battle board`} />;
}
