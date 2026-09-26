import manifest from '../../public/assets/audio/audio-manifest.json';

type MusicId = keyof typeof manifest.music;
type CueId = keyof typeof manifest.cues;
const savedMuteKey = 'pokemon-tactics-audio-muted';
const gainFromDb = (db: number) => 10 ** (db / 20);

class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer | undefined>>();
  private playingEffects = new Set<AudioBufferSourceNode>();
  private desiredMusic?: MusicId;
  private music?: { source: AudioBufferSourceNode; gain: GainNode };
  private musicRevision = 0;
  private muted: boolean;

  constructor() {
    try { this.muted = localStorage.getItem(savedMuteKey) === 'true'; }
    catch { this.muted = false; }
  }

  isMuted() { return this.muted; }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : gainFromDb(-6), this.context.currentTime, 0.025);
    }
    try { localStorage.setItem(savedMuteKey, String(muted)); } catch { /* Audio settings remain in memory. */ }
  }

  async unlock() {
    if (this.muted) return;
    if (!this.context) {
      const context = new AudioContext();
      const master = context.createGain();
      const musicBus = context.createGain();
      const effectsBus = context.createGain();
      master.gain.value = this.muted ? 0 : gainFromDb(-6);
      musicBus.gain.value = gainFromDb(-10);
      effectsBus.gain.value = gainFromDb(-5);
      musicBus.connect(master);
      effectsBus.connect(master);
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      this.musicBus = musicBus;
      this.effectsBus = effectsBus;
    }
    try { await this.context.resume(); }
    catch { return; }
    void this.syncMusic();
    for (const url of [...Object.values(manifest.moves), ...Object.values(manifest.items), ...Object.values(manifest.cues)]) {
      void this.load(url);
    }
  }

  setMusic(track?: MusicId) {
    if (this.desiredMusic === track) return;
    this.desiredMusic = track;
    this.musicRevision++;
    void this.syncMusic();
  }

  playMove(moveId: string) {
    const url = (manifest.moves as Record<string, string>)[moveId] ?? manifest.cues.moveFallback;
    void this.playEffect(url);
  }

  playItem(itemId: string) {
    const url = (manifest.items as Record<string, string>)[itemId] ?? manifest.cues.itemFallback;
    void this.playEffect(url);
  }

  playCue(cue: CueId) { void this.playEffect(manifest.cues[cue]); }

  private load(url: string): Promise<AudioBuffer | undefined> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const task = fetch(url)
      .then(response => { if (!response.ok) throw new Error(`Audio ${response.status}: ${url}`); return response.arrayBuffer(); })
      .then(bytes => this.context?.decodeAudioData(bytes))
      .catch(() => undefined);
    this.buffers.set(url, task);
    return task;
  }

  private async playEffect(url: string) {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.effectsBus || this.muted) return;
    const buffer = await this.load(url);
    if (!buffer || context.state !== 'running' || this.muted) return;
    if (this.playingEffects.size >= 8) {
      const oldest = this.playingEffects.values().next().value;
      oldest?.stop();
      if (oldest) this.playingEffects.delete(oldest);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.97 + Math.random() * 0.06;
    source.connect(this.effectsBus);
    source.onended = () => { this.playingEffects.delete(source); source.disconnect(); };
    this.playingEffects.add(source);
    source.start();
  }

  private fadeOutMusic() {
    if (!this.music || !this.context) return;
    const { source, gain } = this.music;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.06);
    try { source.stop(now + 0.25); } catch { /* A prior transition already stopped it. */ }
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    this.music = undefined;
  }

  private async syncMusic() {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.musicBus) return;
    const track = this.desiredMusic;
    const revision = this.musicRevision;
    if (!track) { this.fadeOutMusic(); return; }
    const buffer = await this.load(manifest.music[track]);
    if (!buffer || revision !== this.musicRevision || context.state !== 'running') return;
    if (this.music?.source.buffer === buffer) return;
    this.fadeOutMusic();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.22);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(this.musicBus);
    source.start();
    this.music = { source, gain };
  }
}

export const gameAudio = new GameAudio();
