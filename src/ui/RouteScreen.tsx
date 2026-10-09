import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { unitSet } from '../battle/unitAnimations';
import { abilityFor, abilityItemFor, itemCanEquip, itemEvolutionFor, itemFor, ITEMS, MOVES, SPECIES, tmMoveFor } from '../content/data';
import type { AbilityId } from '../content/abilities';
import type { ItemId } from '../content/items';
import { MAX_RUN_POKEMON } from '../content/roster';
import { statsAtLevel } from '../game/engine';
import { availableRouteNodes, routeNode, ROUTE_COLUMNS, type RouteNode, type RouteNodeKind } from '../game/route';
import type { PartyMon, Run } from '../game/types';
import SpeciesPortrait from './SpeciesPortrait';
import PixelIcon from './PixelIcon';

function containDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')]
    .filter(control => control.getClientRects().length > 0 && !control.closest('[inert]'));
  const first = controls[0], last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function RoutePyramid({ x, y }: { x: number; y: number }) {
  return <g className="route-player" transform={`translate(${x} ${y})`} role="img" aria-label="Current route position">
    <title>Current route position</title>
    <g className="route-player-bob">
      <path className="route-player-pyramid-outline" d="M0-46 40-23 0 38-40-23Z" />
      <path className="route-player-pyramid-left" d="M-40-23 0-1 0 38Z" />
      <path className="route-player-pyramid-right" d="M0-1 40-23 0 38Z" />
      <path className="route-player-pyramid-top" d="M0-46 40-23 0-1-40-23Z" />
      <path className="route-player-pyramid-glint" d="M0-40 29-23 0-7-29-23Z" />
    </g>
  </g>;
}

const names: Record<RouteNodeKind, string> = {
  battle: 'Battle', elite: 'Elite battle', heal: 'Healing', store: 'Store', special: 'Special encounter', recruit: 'Recruitment', boss: 'Boss',
};
const descriptions: Record<RouteNodeKind, string> = {
  battle: 'Win a standard battle for XP and coins.',
  elite: 'Face stronger opponents for a larger reward.',
  heal: 'Restore HP and revive your whole roster.',
  store: 'Spend coins on items for your party.',
  special: 'A 75% chance of a reward and a 25% chance of a setback.',
  recruit: 'Choose one of three Pokémon to join your roster.',
  boss: 'Defeat the final opponent to clear the layer.',
};
const VIEW_WIDTH = 1050;
const VIEW_HEIGHT = 4860;
const START_X = 525;
const START_Y = 3835;
const xOf = (node: RouteNode) => 180 + node.lane * 230;
const yOf = (node: RouteNode) => 3510 - (node.column - 1) * 340;

type DragGesture = { pointerId: number; startY: number; scrollTop: number; active: boolean };
type EvolutionStage = 'charging' | 'transforming' | 'complete';
type EvolutionSceneState = { monId: string; fromSpecies: string; intoSpecies: string; stage: EvolutionStage };

function EvolutionSprite({ id }: { id: string }) {
  const set = unitSet(id), idle = set.clips.idle;
  const frontRow = idle.rows === 1 ? 0 : set.facingRows[0] ?? 0;
  const idleStyle = {
    backgroundImage: `url(${idle.url})`,
    backgroundSize: `${idle.frames * 100}% ${idle.rows * 100}%`,
    backgroundPosition: `0 ${idle.rows > 1 ? frontRow / (idle.rows - 1) * 100 : 0}%`,
    animation: idle.frames > 1 ? `evolution-idle-loop ${idle.frames / idle.fps}s steps(${idle.frames}) infinite` : 'none',
    '--evolution-idle-end-position': `${idle.frames > 1 ? idle.frames / (idle.frames - 1) * 100 : 0}%`,
  } as CSSProperties;
  return <span className="evolution-idle-sprite" style={idleStyle} aria-hidden="true" />;
}

function EvolutionScene({ scene, onClose, onSkip }: { scene: EvolutionSceneState; onClose: () => void; onSkip: () => void }) {
  const fromName = SPECIES[scene.fromSpecies].name;
  const intoName = SPECIES[scene.intoSpecies].name;
  return <div className="evolution-overlay" onMouseDown={event => { if (event.target === event.currentTarget && scene.stage === 'complete') onClose(); }}>
    <section className={`evolution-dialog evolution-${scene.stage}`} role="dialog" aria-modal="true" aria-labelledby="evolution-title" aria-describedby="evolution-message" onKeyDown={event => {
      if (event.key === 'Tab') {
        event.preventDefault();
        event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();
      }
    }}>
      <span className="evolution-kicker">A NEW FORM IS REVEALING</span>
      <h2 id="evolution-title">Evolution</h2>
      <div className={`evolution-stage evolution-stage-${scene.stage}`} aria-hidden="true">
        <i className="evolution-orbit evolution-orbit-one" /><i className="evolution-orbit evolution-orbit-two" />
        <div className="evolution-sprite evolution-sprite-old"><EvolutionSprite id={scene.fromSpecies} /></div>
        {scene.stage !== 'charging' && <div className="evolution-sprite evolution-sprite-new"><EvolutionSprite id={scene.intoSpecies} /></div>}
        <div className="evolution-flash" />
        <div className="evolution-sparkles">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      </div>
      <p id="evolution-message" aria-live="polite">
        {scene.stage === 'charging' && `What? ${fromName} is evolving!`}
        {scene.stage === 'transforming' && `${fromName} is changing into ${intoName}…`}
        {scene.stage === 'complete' && `${fromName} evolved into ${intoName}!`}
      </p>
      {scene.stage === 'complete'
        ? <button type="button" className="evolution-continue" autoFocus onClick={onClose}>Continue</button>
        : <button type="button" className="evolution-skip" autoFocus onClick={onSkip}>Skip animation</button>}
    </section>
  </div>;
}

function Glyph({ kind }: { kind: RouteNodeKind }) {
  if (kind === 'heal') return <path d="M-8-24H8V-8H24V8H8V24H-8V8H-24V-8H-8Z" />;
  if (kind === 'special') return <g>
    <path d="M-18-17-10-25H10L18-17V-4L5 7V13H-5V1L8-10V-15H-8V-8H-18Z" />
    <path d="M-5 20H5V29H-5Z" />
  </g>;
  if (kind === 'recruit') return <g>
    <circle cx="-5" cy="3" r="18" />
    <path className="route-glyph-line" d="M-23 3H13" />
    <circle className="route-glyph-detail" cx="-5" cy="3" r="6" />
    <circle cx="-5" cy="3" r="2.5" />
    <path d="M14-24H22V-16H30V-8H22V0H14V-8H6V-16H14Z" />
  </g>;
  if (kind === 'store') return <g>
    <path d="M-18-7H18V22H-18Z" />
    <path d="M-24-7-18-23H18L24-7V-1L16 3 8-1 0 3-8-1-16 3-24-1Z" />
    <path className="route-glyph-line" d="M-8-20V-6M8-20V-6" />
    <path className="route-glyph-detail" d="M-4 8H6V22H-4ZM-13 7H-8V13H-13Z" />
  </g>;
  if (kind === 'boss') return <g>
    <path d="M-25-17-13-6 0-24 13-6 25-17 20 21H-20Z" />
    <path className="route-glyph-line" d="M-20 13H20" />
    <path className="route-glyph-detail" d="M0-5 5 1 0 7-5 1Z" />
  </g>;
  if (kind === 'elite') return <g>
    <path d="M0-25 22-17V3L15 16 0 25-15 16-22 3V-17Z" />
    <path className="route-glyph-detail" d="M0-14 4-5 14-4 7 3 9 13 0 8-9 13-7 3-14-4-4-5Z" />
  </g>;
  return <g>
    <path d="M0-26 8-18V7H17V14H5V25H-5V14H-17V7H-8V-18Z" />
    <path className="route-glyph-line" d="M0-16V5" />
  </g>;
}

// Foreshorten upright marks so they sit within the diamond's surface.
const GLYPH_SCALE = 'scale(1.15 .78)';
function NodeEmblem({ kind }: { kind: RouteNodeKind }) {
  return <g className="route-glyph" transform="translate(0 -28)" aria-hidden="true">
    <g className="route-glyph-etch-light" transform="translate(0 1.2)">
      <g transform={GLYPH_SCALE}><Glyph kind={kind} /></g>
    </g>
    <g className="route-glyph-face" transform={GLYPH_SCALE}><Glyph kind={kind} /></g>
  </g>;
}

function TileLayers() {
  return <g className="route-tile-art" transform="scale(1.4)">
    <path className="route-node-shadow" d="M0 28 64-4 64 3 0 35-64 3-64-4Z" />
    <path className="route-node-side" d="M-64-20 0 12 64-20 64-3 0 29-64-3Z" />
    <path className="route-node-side-shade" d="M0 12 64-20 64-3 0 29Z" />
    <path className="route-node-side-highlight" d="M-64-14 0 18 64-14 64-11 0 21-64-11Z" />
    <path className="route-node-rim" d="M0-52 64-20 64-14 0 18-64-14-64-20Z" />
    <path className="route-node-top" d="M0-50 62-20 0 11-62-20Z" />
    <path className="route-node-top-light" d="M-56-20 0-47 56-20" />
    <path className="route-node-inset" d="M0-45 52-20 0 6-52-20Z" />
    <path className="route-node-bevel" d="M0-45 52-20 0-37-52-20Z" />
    <path className="route-node-inset-shade" d="M52-20 0 6-52-20-44-20 0-2 44-20Z" />
    <path className="route-node-texture" d="M0-45 52-20 0 6-52-20Z" />
    <path className="route-node-inlay" d="M0-41 45-20 0 2-45-20Z" />
  </g>;
}

function PartyEmblem() {
  return <svg className="route-party-emblem" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M20 3h24v4h8v8h5v8h4v18h-4v8h-5v8h-8v4H20v-4h-8v-8H7v-8H3V23h4v-8h5V7h8Z" fill="#081f2b" />
    <path d="M20 9h24v4h8v9h4v19h-4v9h-8v5H20v-5h-8v-9H8V22h4v-9h8Z" fill="#fff9e8" />
    <path d="M20 9h24v4h8v9h4v8H8v-8h4v-9h8Z" fill="#e35360" />
    <path d="M20 9h24v4H20ZM12 17h8v5h-8Z" fill="#ff9a88" />
    <path d="M8 29h48v7H8Z" fill="#081f2b" />
    <path d="M23 23h18v18H23Z" fill="#081f2b" />
    <path d="M27 27h10v10H27Z" fill="#fff9e8" />
    <path d="M30 30h4v4h-4Z" fill="#59c8cc" />
  </svg>;
}

function BagEmblem() {
  return <svg className="route-bag-emblem" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M17 7h30v6h5v10h5v32h-5v5H12v-5H7V23h5V13h5Z" fill="#102631" />
    <path d="M18 13h28v8H18Z" fill="#eab95f" />
    <path d="M13 25h38v28H13Z" fill="#bd734d" />
    <path d="M13 25h38v7H13Z" fill="#f4c777" />
    <path d="M19 33h26v20H19Z" fill="#df9860" />
    <path d="M27 21h10v19H27Z" fill="#102631" />
    <path d="M29 23h6v12h-6Z" fill="#fff0bd" />
    <path d="M24 40h16v10H24Z" fill="#a45d43" />
    <path d="M28 43h8v4h-8Z" fill="#f5ce75" />
  </svg>;
}

function ArtifactEmblem() {
  return <svg className="route-artifact-emblem" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M18 7h28v6h7v9h5v31h-5v6H11v-6H6V22h5v-9h7Z" fill="#102631" />
    <path d="M20 13h24v8H20Z" fill="#d9b65f" />
    <path d="M13 25h38v27H13Z" fill="#68549a" />
    <path d="M32 26 44 36 32 48 20 36Z" fill="#f1d37d" />
    <path d="M32 30 39 36 32 43 25 36Z" fill="#66d4d0" />
    <path d="M13 25h38v6H13Z" fill="#967cc5" />
  </svg>;
}

const itemIcon = (item: string) => `/assets/ui/icons/item-${item.toLowerCase().replaceAll(' ', '-')}.svg`;

type TmFlowState = { item: ItemId; step: 'party' | 'moves'; monId?: string };
type EvolutionItemFlowState = { item: ItemId };
type AbilityFlowState = { item: ItemId; step: 'party' | 'slots' | 'choices' | 'confirm'; monId?: string };
type AbilityOfferStatus = 'saving' | 'failed';
function BagItemCard({ item, count, party, hasPendingAbilityChange, onStartTm, onStartEvolutionItem, onStartAbilityItem }: { item: ItemId; count: number; party: PartyMon[]; hasPendingAbilityChange: boolean; onStartTm: (item: ItemId, trigger: HTMLButtonElement) => void; onStartEvolutionItem: (item: ItemId, trigger: HTMLButtonElement) => void; onStartAbilityItem: (item: ItemId, trigger: HTMLButtonElement) => void }) {
  const moveId = tmMoveFor(item);
  const eligible = moveId ? party.filter(mon => SPECIES[mon.species].tmMoves?.includes(moveId) && !mon.equipped.includes(moveId)) : [];
  const evolution = itemEvolutionFor(item);
  const evolutionEligible = evolution ? party.filter(mon => mon.species === evolution.from) : [];
  const abilityItem = abilityItemFor(item);
  const abilityEligible = abilityItem === 'patch' ? party.some(mon => !mon.hiddenAbilityUnlocked) : party.length > 0;
  return <article className="route-inventory-item" key={item}>
    <img src={itemIcon(item)} alt="" /><div><strong>{item}</strong><p>{itemFor(item)?.description}</p></div><span aria-label={`${count} available`}>×{count}</span>
    {moveId && <div className="route-tm-teach">
      <button type="button" disabled={!eligible.length || hasPendingAbilityChange} onClick={event => onStartTm(item, event.currentTarget)}>Use TM</button>
      {!eligible.length && <small>No compatible Pokémon needs this move.</small>}
    </div>}
    {evolution && <div className="route-tm-teach">
      <button type="button" disabled={!evolutionEligible.length || hasPendingAbilityChange} onClick={event => onStartEvolutionItem(item, event.currentTarget)}>Use item</button>
      {!evolutionEligible.length && <small>No compatible Pokémon.</small>}
    </div>}
    {abilityItem && <div className="route-tm-teach">
      <button type="button" disabled={!abilityEligible || (abilityItem === 'patch' && hasPendingAbilityChange)} onClick={event => onStartAbilityItem(item, event.currentTarget)}>{abilityItem === 'capsule' && hasPendingAbilityChange ? 'Resume choices' : `Use ${abilityItem === 'capsule' ? 'Capsule' : 'Patch'}`}</button>
      {!abilityEligible && <small>{abilityItem === 'patch' ? 'Every hidden ability is already unlocked.' : 'No Pokémon in your party.'}</small>}
      {abilityItem === 'patch' && hasPendingAbilityChange && <small>Finish the pending Capsule choice first.</small>}
    </div>}
  </article>;
}

function TmTeachingDialog({ flow, moveId, eligible, recipient, onChooseParty, onChooseMove, onBack, onClose }: {
  flow: TmFlowState;
  moveId: string;
  eligible: PartyMon[];
  recipient?: PartyMon;
  onChooseParty: (monId: string) => void;
  onChooseMove: (slot?: number) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const taughtMove = MOVES[moveId];
  return <div className="tm-flow-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section key={`${flow.item}-${flow.step}-${flow.monId ?? ''}`} className="tm-flow-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-flow-title" aria-describedby="tm-flow-description" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header className="tm-flow-heading">
        <div><small>{flow.step === 'party' ? 'STEP 1 OF 2 · CHOOSE A RECIPIENT' : 'STEP 2 OF 2 · CHOOSE A MOVE SLOT'}</small><h2 id="tm-flow-title">{flow.step === 'party' ? 'Use Technical Machine' : 'Choose a move to replace'}</h2></div>
        <button type="button" className="tm-flow-close" aria-label="Close TM use" onClick={onClose}><PixelIcon name="close" /></button>
      </header>
      <p id="tm-flow-description" className="tm-flow-description">{flow.step === 'party'
        ? `Choose a compatible party Pokémon to learn ${taughtMove?.name ?? moveId}.`
        : `${SPECIES[recipient?.species ?? '']?.name ?? 'This Pokémon'} will learn ${taughtMove?.name ?? moveId}. Choose an active move to replace, or use an open slot.`}</p>
      {flow.step === 'party' && <div className="tm-party-choices">
        {eligible.map((mon, index) => {
          const species = SPECIES[mon.species];
          return <button key={mon.id} type="button" className="tm-party-choice" autoFocus={mon.id === flow.monId || (!flow.monId && index === 0)} onClick={() => onChooseParty(mon.id)}>
            <span className="tm-party-choice-portrait"><SpeciesPortrait id={mon.species} /></span>
            <span className="tm-party-choice-details"><strong>{species.name}</strong><small>Lv {mon.level} · {species.types.join(' / ')}</small></span>
            <span className="tm-party-choice-count">{mon.equipped.length}/4 moves</span>
          </button>;
        })}
      </div>}
      {flow.step === 'moves' && recipient && <>
        <div className="tm-selected-recipient"><span className="tm-party-choice-portrait"><SpeciesPortrait id={recipient.species} /></span><span><strong>{SPECIES[recipient.species].name}</strong><small>Lv {recipient.level} · {recipient.equipped.length} active moves</small></span></div>
        <div className="tm-move-choices">
          {recipient.equipped.length < 4 && <button type="button" className="tm-move-choice tm-open-slot-choice" autoFocus onClick={() => onChooseMove()}>
            <span className="tm-move-slot-number"><PixelIcon name="plus" /></span><span className="tm-move-choice-copy"><strong>Open move slot</strong><small>Add {taughtMove?.name ?? moveId} without replacing a move.</small></span><span className="tm-move-action-label">ADD</span>
          </button>}
          {recipient.equipped.length >= 4 && recipient.equipped.map((id, index) => {
            const move = MOVES[id];
            return <button key={`${recipient.id}-${index}-${id}`} type="button" className="tm-move-choice" autoFocus={index === 0} onClick={() => onChooseMove(index)}>
              <span className="tm-move-slot-number">{index + 1}</span><span className="tm-move-choice-copy"><strong>{move?.name ?? id}</strong><small>{move ? `${move.type} · ${move.category} · ${move.detail}` : 'Current active move'}</small></span><span className="tm-move-action-label">REPLACE</span>
            </button>;
          })}
        </div>
        <div className="tm-flow-actions"><button type="button" className="tm-flow-back" onClick={onBack}><PixelIcon name="arrow-left" /> Choose another Pokémon</button><small>Using this TM consumes one copy.</small></div>
      </>}
      {flow.step === 'party' && <div className="tm-flow-actions"><button type="button" className="tm-flow-cancel" onClick={onClose}>Cancel</button><small>The TM is used only after you confirm a move.</small></div>}
    </section>
  </div>;
}

function EvolutionItemDialog({ item, evolution, eligible, onChooseParty, onClose }: {
  item: ItemId;
  evolution: { from: string; into: string };
  eligible: PartyMon[];
  onChooseParty: (monId: string) => void;
  onClose: () => void;
}) {
  const fromName = SPECIES[evolution.from]?.name ?? evolution.from;
  const intoName = SPECIES[evolution.into]?.name ?? evolution.into;
  return <div className="tm-flow-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="tm-flow-dialog" role="dialog" aria-modal="true" aria-labelledby="evolution-item-title" aria-describedby="evolution-item-description" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header className="tm-flow-heading">
        <div><small>CHOOSE A RECIPIENT</small><h2 id="evolution-item-title">Use {item}</h2></div>
        <button type="button" className="tm-flow-close" aria-label={`Close ${item} use`} onClick={onClose}><PixelIcon name="close" /></button>
      </header>
      <p id="evolution-item-description" className="tm-flow-description">Choose a {fromName} to evolve into {intoName}. Using the stone consumes one copy.</p>
      <div className="tm-party-choices">
        {eligible.map((mon, index) => {
          const species = SPECIES[mon.species];
          return <button key={mon.id} type="button" className="tm-party-choice" autoFocus={index === 0} onClick={() => onChooseParty(mon.id)}>
            <span className="tm-party-choice-portrait"><SpeciesPortrait id={mon.species} /></span>
            <span className="tm-party-choice-details"><strong>{species.name}</strong><small>Lv {mon.level} · {species.types.join(' / ')}</small></span>
            <span className="tm-party-choice-count">EVOLVE</span>
          </button>;
        })}
      </div>
      <div className="tm-flow-actions"><button type="button" className="tm-flow-cancel" onClick={onClose}>Cancel</button><small>The stone is used after you choose a Pokémon.</small></div>
    </section>
  </div>;
}

function AbilityItemDialog({ flow, party, recipient, pending, abilityOfferStatus, onRetryAbilityOffer, onCancelUnsavedAbilityOffer, onChooseParty, onChooseSlot, onChooseAbility, onUnlock, onBack, onClose }: {
  flow: AbilityFlowState;
  party: PartyMon[];
  recipient?: PartyMon;
  pending: Run['pendingAbilityChange'];
  abilityOfferStatus?: AbilityOfferStatus;
  onRetryAbilityOffer?: () => void;
  onCancelUnsavedAbilityOffer?: () => void;
  onChooseParty: (monId: string) => void;
  onChooseSlot: (slot: 'given' | 'hidden') => void;
  onChooseAbility: (ability: AbilityId) => void;
  onUnlock: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const isCapsule = abilityItemFor(flow.item) === 'capsule';
  const eligible = isCapsule ? party : party.filter(mon => !mon.hiddenAbilityUnlocked);
  const monName = recipient ? SPECIES[recipient.species].name : 'This Pokémon';
  const slotName = pending?.slot === 'hidden' ? 'hidden ability' : 'given ability';
  return <div className="tm-flow-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section key={`${flow.item}-${flow.step}-${flow.monId ?? ''}`} className="tm-flow-dialog ability-flow-dialog" role="dialog" aria-modal="true" aria-labelledby="ability-flow-title" aria-describedby="ability-flow-description" onKeyDown={containDialogFocus}>
      <header className="tm-flow-heading">
        <div><small>{flow.step === 'party' ? 'CHOOSE A POKÉMON' : flow.step === 'slots' ? 'CHOOSE AN ABILITY SLOT' : flow.step === 'choices' ? abilityOfferStatus === 'saving' ? 'SAVING ABILITY CHOICES' : abilityOfferStatus === 'failed' ? 'SAVE REQUIRED' : 'CHOOSE ONE OF THREE ABILITIES' : 'UNLOCK HIDDEN ABILITY'}</small><h2 id="ability-flow-title">{flow.item}</h2></div>
        <button type="button" className="tm-flow-close" aria-label={`Close ${flow.item} use`} onClick={onClose}><PixelIcon name="close" /></button>
      </header>
      <p id="ability-flow-description" className="tm-flow-description">{flow.step === 'party'
        ? isCapsule ? 'Choose a Pokémon, then choose the ability slot you want to change.' : 'Choose a Pokémon whose hidden ability is locked.'
        : flow.step === 'slots' ? `Choose which of ${monName}’s abilities to replace. Selecting a slot saves three random choices.`
          : flow.step === 'choices' ? abilityOfferStatus
            ? `${monName}’s ${slotName} will change after the choices are saved and you select a replacement.`
            : `Choose ${monName}’s new ${slotName}. These choices stay saved until you finish, including after a reload.`
            : `${monName} will gain a second active ability. Both abilities will work together in battle.`}</p>
      {flow.step === 'party' && <div className="tm-party-choices">{eligible.map((mon, index) => <button key={mon.id} type="button" className="tm-party-choice" autoFocus={mon.id === flow.monId || (!flow.monId && index === 0)} onClick={() => onChooseParty(mon.id)}>
        <span className="tm-party-choice-portrait"><SpeciesPortrait id={mon.species} /></span>
        <span className="tm-party-choice-details"><strong>{SPECIES[mon.species].name}</strong><small>Lv {mon.level} · Given: {mon.givenAbility}</small><small>Hidden: {mon.hiddenAbility} · {mon.hiddenAbilityUnlocked ? 'Active' : 'Locked'}</small></span>
        <span className="tm-party-choice-count">{isCapsule ? 'CHANGE' : 'UNLOCK'}</span>
      </button>)}</div>}
      {recipient && flow.step !== 'party' && <div className="tm-selected-recipient"><span className="tm-party-choice-portrait"><SpeciesPortrait id={recipient.species} /></span><span><strong>{monName}</strong><small>Lv {recipient.level} · {recipient.hiddenAbilityUnlocked ? 'Two active abilities' : 'One active ability'}</small></span></div>}
      {flow.step === 'slots' && recipient && <div className="ability-slot-choices">
        <button type="button" className="ability-choice" autoFocus onClick={() => onChooseSlot('given')}><small>GIVEN ABILITY · ACTIVE</small><strong>{recipient.givenAbility}</strong><span>{abilityFor(recipient.givenAbility)?.description}</span></button>
        {recipient.hiddenAbilityUnlocked
          ? <button type="button" className="ability-choice" onClick={() => onChooseSlot('hidden')}><small>HIDDEN ABILITY · ACTIVE</small><strong>{recipient.hiddenAbility}</strong><span>{abilityFor(recipient.hiddenAbility)?.description}</span></button>
          : <p className="ability-locked-slot">Hidden ability: <strong>{recipient.hiddenAbility}</strong> · Locked. Use an Ability Patch to unlock this slot first.</p>}
      </div>}
      {flow.step === 'choices' && pending && recipient && <>
        <p className="ability-current-slot">Replacing {slotName}: <strong>{pending.slot === 'given' ? recipient.givenAbility : recipient.hiddenAbility}</strong></p>
        {abilityOfferStatus === 'saving'
          ? <div className="ability-offer-save-status" role="status" aria-busy="true"><strong>Saving ability choices…</strong><p>The three choices will appear when saving finishes.</p></div>
          : abilityOfferStatus === 'failed'
            ? <div className="ability-offer-save-status ability-offer-save-failed" role="alert"><strong>Ability choices could not be saved.</strong><p>Retry saving to view the choices. Your Pokémon and Capsule have not changed.</p><div className="ability-offer-save-actions"><button type="button" autoFocus disabled={!onRetryAbilityOffer} onClick={onRetryAbilityOffer}>Retry saving</button>{onCancelUnsavedAbilityOffer && <button type="button" className="ability-offer-cancel" onClick={onCancelUnsavedAbilityOffer}>Cancel use</button>}</div></div>
            : <div className="ability-slot-choices ability-random-choices">{pending.choices.map((ability, index) => <button key={ability} type="button" className="ability-choice" autoFocus={index === 0} onClick={() => onChooseAbility(ability)}><small>CHOICE {index + 1}</small><strong>{ability}</strong><span>{abilityFor(ability)?.description}</span><b>Choose ability</b></button>)}</div>}
      </>}
      {flow.step === 'confirm' && recipient && <div className="ability-unlock-preview"><small>HIDDEN ABILITY · WILL BECOME ACTIVE</small><strong>{recipient.hiddenAbility}</strong><p>{abilityFor(recipient.hiddenAbility)?.description}</p><span>Given ability: {recipient.givenAbility}</span><button type="button" className="ability-unlock-button" autoFocus onClick={onUnlock}>Unlock hidden ability</button></div>}
      <div className="tm-flow-actions">
        {(flow.step === 'slots' || flow.step === 'confirm') && <button type="button" className="tm-flow-back" onClick={onBack}><PixelIcon name="arrow-left" /> Choose another Pokémon</button>}
        {(flow.step === 'party' || flow.step === 'choices') && <button type="button" className="tm-flow-cancel" autoFocus={flow.step === 'choices' && abilityOfferStatus === 'saving'} onClick={onClose}>{flow.step === 'choices' ? 'Choose later' : 'Cancel'}</button>}
        <small>{flow.step === 'choices' ? 'Finish this choice before continuing the route. One Capsule is consumed after choosing.' : isCapsule ? 'One Capsule is consumed after choosing a replacement.' : 'One Patch is consumed after confirming the unlock.'}</small>
      </div>
    </section>
  </div>;
}

type Props = {
  run: Run;
  onChoose: (id: string) => void;
  onBack: () => void;
  onEquipItem: (monId: string, item: string) => void;
  onEvolve: (id: string) => void;
  onTeachTm: (item: ItemId, monId: string, replaceSlot?: number) => void;
  onUseEvolutionItem: (item: ItemId, monId: string) => void;
  onStartAbilityCapsule: (monId: string, slot: 'given' | 'hidden') => void;
  onChooseCapsuleAbility: (ability: AbilityId) => void;
  onUseAbilityPatch: (monId: string) => void;
  abilityOfferStatus?: AbilityOfferStatus;
  onRetryAbilityOffer?: () => void;
  onCancelUnsavedAbilityOffer?: () => void;
  backdropOnly?: boolean;
};

export default function RouteScreen({ run, onChoose, onBack, onEquipItem, onEvolve, onTeachTm, onUseEvolutionItem, onStartAbilityCapsule, onChooseCapsuleAbility, onUseAbilityPatch, abilityOfferStatus, onRetryAbilityOffer, onCancelUnsavedAbilityOffer, backdropOnly = false }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const partyButton = useRef<HTMLButtonElement>(null);
  const inventoryButton = useRef<HTMLButtonElement>(null);
  const inventoryModalCloseButton = useRef<HTMLButtonElement>(null);
  const artifactButton = useRef<HTMLButtonElement>(null);
  const evolutionCardTargets = useRef(new Map<string, HTMLElement>());
  const tmTriggerTargets = useRef(new Map<ItemId, HTMLButtonElement>());
  const evolutionItemTriggerTargets = useRef(new Map<ItemId, HTMLButtonElement>());
  const abilityItemTriggerTargets = useRef(new Map<ItemId, HTMLButtonElement>());
  const drag = useRef<DragGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const [openPanel, setOpenPanel] = useState<'party' | 'inventory' | 'artifacts' | null>(run.pendingAbilityChange && !backdropOnly ? 'inventory' : null);
  const [evolutionScene, setEvolutionScene] = useState<EvolutionSceneState | null>(null);
  const [tmFlow, setTmFlow] = useState<TmFlowState | null>(null);
  const [evolutionItemFlow, setEvolutionItemFlow] = useState<EvolutionItemFlowState | null>(null);
  const [abilityFlow, setAbilityFlow] = useState<AbilityFlowState | null>(run.pendingAbilityChange && !backdropOnly ? { item: 'Ability Capsule', step: 'choices', monId: run.pendingAbilityChange.monId } : null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string>();
  const availableNodes = useMemo(() => availableRouteNodes(run.route), [run.route]);
  const available = useMemo(() => new Set(availableNodes.map(node => node.id)), [availableNodes]);
  const visited = useMemo(() => new Set(run.route.visited), [run.route.visited]);
  const currentNode = routeNode(run.route, run.route.visited.at(-1));
  const markerX = currentNode ? xOf(currentNode) : START_X;
  const markerY = (currentNode ? yOf(currentNode) : START_Y) - 72;
  const inspectedNode = routeNode(run.route, inspectedNodeId) ?? availableNodes[0];
  const inspectedStatus = inspectedNode && (available.has(inspectedNode.id) ? 'AVAILABLE' : visited.has(inspectedNode.id) ? 'CLEARED' : 'AHEAD');
  const nextColumn = Math.min(ROUTE_COLUMNS, run.route.visited.length + 1);
  const bagCounts = useMemo(() => {
    const counts = new Map<ItemId, number>();
    for (const item of run.bag) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
  }, [run.bag]);
  const { bagItems, tmBagItems, evolutionBagItems, abilityBagItems, heldBagItems } = useMemo(() => {
    const bagItems = ITEMS.filter(item => item !== 'None' && bagCounts.has(item)).map(item => ({ item, count: bagCounts.get(item)! }));
    return {
      bagItems,
      tmBagItems: bagItems.filter(({ item }) => !!tmMoveFor(item)),
      evolutionBagItems: bagItems.filter(({ item }) => !!itemEvolutionFor(item)),
      abilityBagItems: bagItems.filter(({ item }) => !!abilityItemFor(item)),
      heldBagItems: bagItems.filter(({ item }) => !tmMoveFor(item) && !itemEvolutionFor(item) && !abilityItemFor(item)),
    };
  }, [bagCounts]);
  const equippedItems = run.party.filter(mon => mon.item !== 'None');
  const tmFlowMove = tmFlow ? tmMoveFor(tmFlow.item) : undefined;
  const tmFlowEligible = tmFlowMove ? run.party.filter(mon => SPECIES[mon.species].tmMoves?.includes(tmFlowMove) && !mon.equipped.includes(tmFlowMove)) : [];
  const tmFlowRecipient = tmFlow?.monId ? run.party.find(mon => mon.id === tmFlow.monId) : undefined;
  const abilityFlowRecipient = run.party.find(mon => mon.id === (abilityFlow?.step === 'choices' ? run.pendingAbilityChange?.monId : abilityFlow?.monId));
  const pan = (direction: -1 | 1) => scroll.current?.scrollBy({ top: direction * Math.max(300, scroll.current.clientHeight * .72), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const closePanel = () => {
    const returnFocus = openPanel === 'party' ? partyButton : openPanel === 'artifacts' ? artifactButton : inventoryButton;
    setOpenPanel(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };
  const closeEvolution = () => {
    const monId = evolutionScene?.monId;
    setEvolutionScene(null);
    requestAnimationFrame(() => { if (monId) evolutionCardTargets.current.get(monId)?.focus(); });
  };
  const skipEvolution = () => setEvolutionScene(current => current ? { ...current, stage: 'complete' } : current);
  const startTmFlow = (item: ItemId, trigger: HTMLButtonElement) => {
    tmTriggerTargets.current.set(item, trigger);
    setTmFlow({ item, step: 'party' });
  };
  const closeTmFlow = () => {
    const item = tmFlow?.item;
    setTmFlow(null);
    requestAnimationFrame(() => {
      const trigger = item ? tmTriggerTargets.current.get(item) : undefined;
      if (trigger?.isConnected) trigger.focus();
      else inventoryModalCloseButton.current?.focus();
    });
  };
  const startEvolutionItemFlow = (item: ItemId, trigger: HTMLButtonElement) => {
    evolutionItemTriggerTargets.current.set(item, trigger);
    setEvolutionItemFlow({ item });
  };
  const closeEvolutionItemFlow = () => {
    const item = evolutionItemFlow?.item;
    setEvolutionItemFlow(null);
    requestAnimationFrame(() => {
      const trigger = item ? evolutionItemTriggerTargets.current.get(item) : undefined;
      if (trigger?.isConnected) trigger.focus();
      else inventoryModalCloseButton.current?.focus();
    });
  };
  const chooseTmRecipient = (monId: string) => setTmFlow(current => current ? { ...current, step: 'moves', monId } : current);
  const returnToTmRecipients = () => setTmFlow(current => current ? { ...current, step: 'party' } : current);
  const teachSelectedTm = (slot?: number) => {
    if (!tmFlow || !tmFlowRecipient) return;
    onTeachTm(tmFlow.item, tmFlowRecipient.id, slot);
    closeTmFlow();
  };
  const useSelectedEvolutionItem = (monId: string) => {
    if (!evolutionItemFlow) return;
    const evolution = itemEvolutionFor(evolutionItemFlow.item);
    const mon = run.party.find(candidate => candidate.id === monId);
    if (!evolution || !mon || mon.species !== evolution.from || !run.bag.includes(evolutionItemFlow.item)) return;
    onUseEvolutionItem(evolutionItemFlow.item, mon.id);
    setEvolutionItemFlow(null);
    setOpenPanel('party');
    setEvolutionScene({ monId: mon.id, fromSpecies: mon.species, intoSpecies: evolution.into, stage: 'charging' });
  };
  const resumeAbilityChoice = () => {
    if (!run.pendingAbilityChange) return;
    setOpenPanel('inventory');
    setAbilityFlow({ item: 'Ability Capsule', step: 'choices', monId: run.pendingAbilityChange.monId });
  };
  const startAbilityFlow = (item: ItemId, trigger: HTMLButtonElement) => {
    abilityItemTriggerTargets.current.set(item, trigger);
    if (run.pendingAbilityChange) { resumeAbilityChoice(); return; }
    setAbilityFlow({ item, step: 'party' });
  };
  const closeAbilityFlow = () => {
    const item = abilityFlow?.item;
    setAbilityFlow(null);
    requestAnimationFrame(() => {
      const trigger = item ? abilityItemTriggerTargets.current.get(item) : undefined;
      if (trigger?.isConnected) trigger.focus();
      else inventoryModalCloseButton.current?.focus();
    });
  };
  const chooseAbilityRecipient = (monId: string) => setAbilityFlow(current => current ? { ...current, monId, step: abilityItemFor(current.item) === 'capsule' ? 'slots' : 'confirm' } : current);
  const chooseAbilitySlot = (slot: 'given' | 'hidden') => {
    if (!abilityFlowRecipient) return;
    onStartAbilityCapsule(abilityFlowRecipient.id, slot);
  };
  const chooseAbility = (ability: AbilityId) => {
    if (abilityOfferStatus || !run.pendingAbilityChange?.choices.includes(ability)) return;
    onChooseCapsuleAbility(ability);
  };
  const unlockHiddenAbility = () => {
    if (!abilityFlowRecipient || abilityFlowRecipient.hiddenAbilityUnlocked) return;
    onUseAbilityPatch(abilityFlowRecipient.id);
    closeAbilityFlow();
  };
  useEffect(() => {
    if (backdropOnly) return;
    if (run.pendingAbilityChange) {
      setOpenPanel('inventory');
      setAbilityFlow({ item: 'Ability Capsule', step: 'choices', monId: run.pendingAbilityChange.monId });
    } else {
      setAbilityFlow(current => current?.step === 'choices' ? null : current);
      requestAnimationFrame(() => inventoryModalCloseButton.current?.focus());
    }
  }, [run.pendingAbilityChange, backdropOnly]);

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const focusY = currentNode ? yOf(currentNode) : START_Y;
    const placeFocus = () => {
      const map = viewport.querySelector('svg');
      const scale = map ? map.clientWidth / VIEW_WIDTH : 1;
      const anchor = viewport.clientWidth < 600 ? .65 : .83;
      viewport.scrollTop = Math.max(0, focusY * scale - viewport.clientHeight * anchor);
    };
    placeFocus();
    const resize = new ResizeObserver(placeFocus);
    resize.observe(viewport);
    window.addEventListener('resize', placeFocus);
    return () => { resize.disconnect(); window.removeEventListener('resize', placeFocus); };
  }, [run.route.visited.length, currentNode]);
  useEffect(() => {
    if (!openPanel) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (abilityFlow) {
        if (abilityFlow.step === 'slots' || abilityFlow.step === 'confirm') setAbilityFlow(current => current ? { ...current, step: 'party' } : current);
        else closeAbilityFlow();
        return;
      }
      if (tmFlow) {
        if (tmFlow.step === 'moves') returnToTmRecipients();
        else closeTmFlow();
        return;
      }
      if (evolutionItemFlow) {
        closeEvolutionItemFlow();
        return;
      }
      if (evolutionScene) {
        if (evolutionScene.stage === 'complete') closeEvolution();
        return;
      }
      closePanel();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [openPanel, evolutionScene, tmFlow, evolutionItemFlow, abilityFlow]);
  useEffect(() => {
    if (!evolutionScene || evolutionScene.stage === 'complete') return;
    const currentStage = evolutionScene.stage;
    const nextStage = currentStage === 'charging' ? 'transforming' : 'complete';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = window.setTimeout(() => {
      setEvolutionScene(current => current?.monId === evolutionScene.monId && current.stage === currentStage
        ? { ...current, stage: nextStage }
        : current);
    }, reducedMotion ? 0 : currentStage === 'charging' ? 1700 : 850);
    return () => window.clearTimeout(timeout);
  }, [evolutionScene]);

  const onMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') return;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      scrollTop: event.currentTarget.scrollTop,
      active: false,
    };
  };
  const onMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientY - gesture.startY;
    if (!gesture.active && Math.abs(distance) > 7) {
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add('dragging');
    }
    if (gesture.active) {
      event.preventDefault();
      event.currentTarget.scrollTop = gesture.scrollTop - distance;
    }
  };
  const endMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.active) {
      suppressClickUntil.current = performance.now() + 250;
      event.currentTarget.classList.remove('dragging');
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };
  return <main className={`route-screen${backdropOnly ? ' route-screen-backdrop' : ''}`} aria-hidden={backdropOnly}>
    <header className="route-heading">
      <span>LAYER 1 · THE CAVERNS</span>
      <strong>Choose a Route</strong>
      <small>Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS}</small>
    </header>

    {!backdropOnly && run.pendingAbilityChange && !openPanel && <div className="route-ability-pending" role="status"><span>{abilityOfferStatus === 'saving' ? 'Saving ability choices… Complete the choice after saving to continue the route.' : abilityOfferStatus === 'failed' ? 'Ability choices could not be saved. Reopen the choices to retry saving.' : 'Finish your Ability Capsule choice to continue the route.'}</span><button type="button" onClick={resumeAbilityChoice}>Resume ability choices</button></div>}

    {!backdropOnly && <aside className="route-hud" aria-label="Route status" inert={!!openPanel}>
      <div className="route-coins" aria-label={`${run.coins} coins`}><PixelIcon name="coin" /><b>{run.coins}</b><span>COINS</span></div>
      <button className="route-party-button" ref={partyButton} type="button" aria-label={`Open travelling team, ${run.party.length} of ${MAX_RUN_POKEMON} Pokémon owned`} aria-expanded={openPanel === 'party'} onClick={() => setOpenPanel('party')}>
        <PartyEmblem /><b>Party</b><small>{run.party.length} / {MAX_RUN_POKEMON}</small>
      </button>
      <button className="route-inventory-button" ref={inventoryButton} type="button" aria-label={`Open inventory, ${run.bag.length} items in bag`} aria-expanded={openPanel === 'inventory'} onClick={() => setOpenPanel('inventory')}>
        <BagEmblem /><b>Bag</b><small>{run.bag.length}</small>
      </button>
      <button className="route-artifact-button" ref={artifactButton} type="button" aria-label="Open Artifact Bag" aria-expanded={openPanel === 'artifacts'} onClick={() => setOpenPanel('artifacts')}>
        <ArtifactEmblem /><b>Artifact Bag</b><small>SOON</small>
      </button>
    </aside>}
    {!backdropOnly && <button className="route-back-button" type="button" aria-label="Return to title screen" inert={!!openPanel} onClick={onBack}><PixelIcon name="arrow-left" /></button>}
    {!backdropOnly && <aside className="route-guide" aria-label="Route guide" inert={!!openPanel}>
      <div className="route-guide-heading"><span>NEXT STOP</span><b>{String(nextColumn).padStart(2, '0')} <small>/ {ROUTE_COLUMNS}</small></b></div>
      <div className="route-guide-track" aria-label={`${run.route.visited.length} of ${ROUTE_COLUMNS} columns cleared`}>
        {Array.from({ length: ROUTE_COLUMNS }, (_, index) => <i key={index} className={index < run.route.visited.length ? 'cleared' : index === run.route.visited.length ? 'next' : ''} />)}
      </div>
      {inspectedNode && <div className="route-guide-detail" aria-live="polite"><strong>{names[inspectedNode.kind]}</strong><span>{inspectedStatus} · COLUMN {inspectedNode.column}</span><p>{descriptions[inspectedNode.kind]}</p></div>}
      <div className="route-guide-controls"><button type="button" onClick={() => pan(-1)} aria-label="Pan route up toward boss"><PixelIcon name="arrow-up" /></button><span>CLIMB TO THE BOSS</span><button type="button" onClick={() => pan(1)} aria-label="Pan route down toward start"><PixelIcon name="arrow-down" /></button></div>
    </aside>}

    <div className="route-map-scroll" ref={scroll} inert={!!openPanel || backdropOnly} aria-label="Ten-column route map. Scroll or drag upward from the start to the boss."
      onPointerDown={onMapPointerDown} onPointerMove={onMapPointerMove} onPointerUp={endMapDrag}
      onPointerCancel={endMapDrag} onLostPointerCapture={endMapDrag}
      onClickCapture={event => {
        if (performance.now() < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragStart={event => event.preventDefault()}>
      <svg className="route-map" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="xMidYMin meet" aria-label="Vertical branching route climbing from column one at the bottom to the boss in column ten at the top">
        <defs>
          <pattern id="route-stone-grain" width="18" height="16" patternUnits="userSpaceOnUse"><path fill="#fff1c2" opacity=".32" d="M2 2h5v2H2zM12 11h4v2h-4z" /><path fill="#483018" opacity=".27" d="M9 5h4v2H9zM1 12h3v2H1z" /></pattern>
        </defs>
        <line className="route-start-link" x1={START_X} y1={START_Y - 28} x2={xOf(run.route.nodes[0])} y2={yOf(run.route.nodes[0]) - 28} />
        <g className="route-links">{run.route.links.map(link => {
          const from = routeNode(run.route, link.from)!, to = routeNode(run.route, link.to)!;
          const connected = visited.has(from.id) && visited.has(to.id);
          const reachable = visited.has(from.id) && available.has(to.id);
          return <line key={`${from.id}-${to.id}`} x1={xOf(from)} y1={yOf(from) - 28} x2={xOf(to)} y2={yOf(to) - 28} className={connected ? 'cleared' : reachable ? 'reachable' : ''} />;
        })}</g>
        <g className="route-start" transform={`translate(${START_X} ${START_Y})`}><TileLayers /></g>
        {run.route.nodes.map(node => {
          const isAvailable = available.has(node.id) && !run.pendingAbilityChange, isVisited = visited.has(node.id), isCurrent = currentNode?.id === node.id;
          return <g key={node.id} className={`route-node ${node.kind}${isAvailable ? ' available' : ''}${isVisited ? ' visited' : ''}${isCurrent ? ' current' : ''}`} transform={`translate(${xOf(node)} ${yOf(node)})`}
            role={backdropOnly ? undefined : 'button'} tabIndex={backdropOnly ? -1 : isAvailable ? 0 : -1} aria-disabled={!isAvailable}
            aria-label={`Column ${node.column}: ${names[node.kind]}${isAvailable ? ', available' : isVisited ? ', completed' : ', locked'}`}
            onPointerEnter={() => setInspectedNodeId(node.id)} onPointerLeave={() => setInspectedNodeId(undefined)}
            onFocus={() => setInspectedNodeId(node.id)} onBlur={() => setInspectedNodeId(undefined)}
            onClick={() => { if (!backdropOnly && isAvailable) onChoose(node.id); }} onKeyDown={event => { if (!backdropOnly && isAvailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChoose(node.id); } }}>
            <title>{`${names[node.kind]} · column ${node.column}`}</title>
            <TileLayers />
            {!isCurrent && <NodeEmblem kind={node.kind} />}
            {isAvailable && <g className="route-choice-marker" transform="translate(0 -138)"><path d="M0 43-29-10 0-27 29-10Z" /><path className="route-choice-shine" d="M0-20-20-9 0 2 20-9Z" /></g>}
          </g>;
        })}
        <RoutePyramid x={markerX} y={markerY} />
      </svg>
    </div>
    {!backdropOnly && <p className="route-instruction"><span>◆</span> {run.pendingAbilityChange ? abilityOfferStatus === 'saving' ? 'Saving ability choices… · reopen the Bag for progress' : abilityOfferStatus === 'failed' ? 'Ability choices need saving · reopen the Bag to retry' : 'Ability Capsule choice pending · reopen the Bag to finish' : <>Select a glowing connected node <b>·</b> paths can branch into up to four choices</>}</p>}

    {!backdropOnly && openPanel === 'artifacts' && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-artifact-title" onKeyDown={containDialogFocus} onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="route-party-panel route-artifact-panel">
        <div className="route-party-head">
          <div className="route-party-heading"><span className="route-party-heading-icon"><ArtifactEmblem /></span><div><small>ROUTE · ARTIFACTS</small><h2 id="route-artifact-title">Artifact Bag</h2></div></div>
          <div className="route-party-head-actions"><button type="button" autoFocus aria-label="Close Artifact Bag" onClick={closePanel}><PixelIcon name="close" /></button></div>
        </div>
        <p className="route-artifact-message">Coming soon</p>
        <p className="route-party-note">Artifacts will live here in a future update. Continue your journey with Party and Bag.</p>
      </div>
    </section>}

    {!backdropOnly && openPanel === 'inventory' && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-inventory-title" inert={!!tmFlow || !!evolutionItemFlow || !!evolutionScene || !!abilityFlow} onKeyDown={containDialogFocus} onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="route-party-panel route-inventory-panel">
        <div className="route-party-head">
          <div className="route-party-heading"><span className="route-party-heading-icon"><BagEmblem /></span><div><small>ROUTE · ITEMS</small><h2 id="route-inventory-title">Inventory</h2></div></div>
          <div className="route-party-head-actions"><button ref={inventoryModalCloseButton} type="button" autoFocus aria-label="Close inventory" onClick={closePanel}><PixelIcon name="close" /></button></div>
        </div>
        <div className="route-inventory-summary"><span><b>{run.bag.length}</b> in bag</span><span><b>{equippedItems.length}</b> held by team</span><button type="button" onClick={() => setOpenPanel('party')}>Manage team <PixelIcon name="arrow-right" /></button></div>
        {run.pendingAbilityChange && <div className="ability-pending-notice"><p>{abilityOfferStatus === 'saving' ? 'Saving ability choices… Finish saving and complete the choice to continue the route or use another item.' : abilityOfferStatus === 'failed' ? 'Your Capsule choices could not be saved. Resume the choices and retry saving to continue.' : 'Your Capsule choices are saved. Finish the choice to continue the route or use another item.'}</p><button type="button" onClick={resumeAbilityChoice}>Resume ability choices</button></div>}
        {abilityBagItems.length > 0 && <><h3>Ability items</h3><p className="route-tm-help">Unlock a hidden ability with a Patch, or change an ability with a Capsule. Each item is single-use.</p><div className="route-inventory-grid">{abilityBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} hasPendingAbilityChange={!!run.pendingAbilityChange} onStartTm={startTmFlow} onStartEvolutionItem={startEvolutionItemFlow} onStartAbilityItem={startAbilityFlow} />)}</div></>}
        {heldBagItems.length > 0 && <><h3>Held items</h3><div className="route-inventory-grid">{heldBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} hasPendingAbilityChange={!!run.pendingAbilityChange} onStartTm={startTmFlow} onStartEvolutionItem={startEvolutionItemFlow} onStartAbilityItem={startAbilityFlow} />)}</div></>}
        {evolutionBagItems.length > 0 && <><h3>Evolution items</h3><p className="route-tm-help">Use an evolution item to choose a compatible Pokémon. Each item is single-use.</p><div className="route-inventory-grid">{evolutionBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} hasPendingAbilityChange={!!run.pendingAbilityChange} onStartTm={startTmFlow} onStartEvolutionItem={startEvolutionItemFlow} onStartAbilityItem={startAbilityFlow} />)}</div></>}
        {tmBagItems.length > 0 && <><h3>Technical Machines</h3><p className="route-tm-help">Use a TM to choose a compatible Pokémon, then select a move to replace. Each TM is single-use.</p><div className="route-inventory-grid">{tmBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} hasPendingAbilityChange={!!run.pendingAbilityChange} onStartTm={startTmFlow} onStartEvolutionItem={startEvolutionItemFlow} onStartAbilityItem={startAbilityFlow} />)}</div></>}
        {!bagItems.length && <p className="route-inventory-empty">Your bag is empty. Visit a Store node to buy items or TMs, or change a held item in Party to return it here.</p>}
        {equippedItems.length > 0 && <><h3>Held by team</h3><div className="route-inventory-equipped">{equippedItems.map(mon => <div key={mon.id}><img src={itemIcon(mon.item)} alt="" /><span><b>{mon.item}</b><small>{SPECIES[mon.species].name}</small></span></div>)}</div></>}
      </div>
    </section>}

    {!backdropOnly && openPanel === 'party' && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-party-title" inert={!!evolutionScene} onKeyDown={containDialogFocus} onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="route-party-panel">
        <div className="route-party-head">
          <div className="route-party-heading"><span className="route-party-heading-icon"><PartyEmblem /></span><div><small>ROUTE · TEAM MANAGEMENT</small><h2 id="route-party-title">Travelling Team</h2></div></div>
          <div className="route-party-head-actions"><div className="route-party-owned"><b>{run.party.length}</b><span>/ {MAX_RUN_POKEMON} OWNED</span></div><button type="button" autoFocus aria-label="Close travelling team" onClick={closePanel}><PixelIcon name="close" /></button></div>
        </div>
        <div className="route-party-intro"><p>Review moves and abilities, manage held items and evolve here. Use TMs, Ability Capsules and Ability Patches from the Bag.</p><span>{run.party.filter(mon => mon.hp > 0).length} ready</span><span>{run.bag.length} in bag</span></div>
        <div className="route-party-grid">{run.party.map(mon => {
          const species = SPECIES[mon.species], maxHp = statsAtLevel(mon.species, mon.level)[0];
          const evolution = species.evolves && mon.level >= species.evolves.level ? species.evolves : undefined;
          const availableItems = [mon.item, ...ITEMS.filter(item => (item === 'None' || bagCounts.has(item)) && itemCanEquip(item, mon.species))]
            .filter((item, index, all) => all.indexOf(item) === index);
          return <article ref={element => { if (element) evolutionCardTargets.current.set(mon.id, element); else evolutionCardTargets.current.delete(mon.id); }} tabIndex={-1} className={`route-party-card${mon.hp <= 0 ? ' fainted' : ''}`} data-type={species.types[0].toLowerCase()} key={mon.id}>
            <div className="route-party-card-top"><div className="route-party-portrait"><SpeciesPortrait id={mon.species} /></div>
              <div className="route-party-card-main">
                <div className="route-party-name-row"><h3>{species.name}</h3><span>{mon.hp <= 0 ? 'FAINTED' : `Lv ${mon.level}`}</span></div>
                <div className="route-party-types">{species.types.map(type => <span key={type}>{type}</span>)}</div>
                <div className="route-party-hp-line"><span>HP</span><b>{mon.hp} / {maxHp}</b></div>
                <div className="route-party-health" role="progressbar" aria-label={`${species.name} HP`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={mon.hp}><i style={{ width: `${Math.max(0, Math.min(100, mon.hp / maxHp * 100))}%` }} /></div>
              </div>
            </div>
            <div className="route-party-facts"><div title={abilityFor(mon.givenAbility)?.description}><span aria-hidden="true"><PixelIcon name="spark" /></span><small>GIVEN ABILITY</small><b>{mon.givenAbility}</b></div><div className={`route-hidden-ability${mon.hiddenAbilityUnlocked ? '' : ' locked'}`} title={abilityFor(mon.hiddenAbility)?.description}><span aria-hidden="true"><PixelIcon name="spark" /></span><small>HIDDEN · {mon.hiddenAbilityUnlocked ? 'ACTIVE' : 'LOCKED'}</small><b>{mon.hiddenAbility}</b></div><div><span aria-hidden="true"><PixelIcon name="bag" /></span><small>HELD ITEM</small><b>{mon.item}</b></div></div>
            <div className="route-party-moves"><span>EQUIPPED MOVES</span><ul>{mon.equipped.map((id, index) => <li key={`${index}-${id}`}>{MOVES[id]?.name ?? id}</li>)}</ul></div>
            <details className="route-party-manage"><summary><span>Manage Pokémon</span><span>{evolution ? 'Evolution ready' : 'Held item'}</span></summary>
              <div className="route-party-controls">
                <label className="route-party-item-control">Held item
                  <select aria-label={`${species.name} held item`} value={mon.item} disabled={!!run.pendingAbilityChange} onChange={event => onEquipItem(mon.id, event.target.value)}>
                    {availableItems.map(item => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
                {evolution && <button type="button" className="route-evolve-button" disabled={!!run.pendingAbilityChange} onClick={event => {
                  event.currentTarget.blur();
                  onEvolve(mon.id);
                  setEvolutionScene({ monId: mon.id, fromSpecies: mon.species, intoSpecies: evolution.into, stage: 'charging' });
                }}>Evolve into {SPECIES[evolution.into].name}</button>}
              </div>
            </details>
          </article>;
        })}</div>
      </div>
    </section>}
    {!backdropOnly && tmFlow && openPanel === 'inventory' && tmFlowMove && <TmTeachingDialog flow={tmFlow} moveId={tmFlowMove} eligible={tmFlowEligible} recipient={tmFlowRecipient}
      onChooseParty={chooseTmRecipient} onChooseMove={teachSelectedTm} onBack={returnToTmRecipients} onClose={closeTmFlow} />}
    {!backdropOnly && evolutionItemFlow && openPanel === 'inventory' && itemEvolutionFor(evolutionItemFlow.item) && <EvolutionItemDialog item={evolutionItemFlow.item} evolution={itemEvolutionFor(evolutionItemFlow.item)!} eligible={run.party.filter(mon => mon.species === itemEvolutionFor(evolutionItemFlow.item)!.from)} onChooseParty={useSelectedEvolutionItem} onClose={closeEvolutionItemFlow} />}
    {!backdropOnly && abilityFlow && openPanel === 'inventory' && <AbilityItemDialog flow={abilityFlow} party={run.party} recipient={abilityFlowRecipient} pending={run.pendingAbilityChange} abilityOfferStatus={abilityOfferStatus} onRetryAbilityOffer={onRetryAbilityOffer} onCancelUnsavedAbilityOffer={onCancelUnsavedAbilityOffer} onChooseParty={chooseAbilityRecipient} onChooseSlot={chooseAbilitySlot} onChooseAbility={chooseAbility} onUnlock={unlockHiddenAbility} onBack={() => setAbilityFlow(current => current ? { ...current, step: 'party' } : current)} onClose={closeAbilityFlow} />}
    {!backdropOnly && evolutionScene && <EvolutionScene scene={evolutionScene} onClose={closeEvolution} onSkip={skipEvolution} />}
  </main>;
}
