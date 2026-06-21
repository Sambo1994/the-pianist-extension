// Grand Piano Engine using Web Audio API with realistic piano synthesis
// Runs in offscreen document for background playback

let audioContext = null;
let isPlaying = false;
let generator = null;
let gainNode = null;
let reverbNode = null;
let convolverNode = null;
let isInitialized = false;

// Preset configurations
const PRESETS = {
  hotel: {
    tempo: 72,
    density: 0.6,
    range: 'medium',
    complexity: 3,
    reverb: 0.85,
    description: 'Hotel'
  },
  spa: {
    tempo: 60,
    density: 0.4,
    range: 'narrow',
    complexity: 2,
    reverb: 0.9,
    description: 'Spa'
  },
  lounge: {
    tempo: 85,
    density: 0.7,
    range: 'wide',
    complexity: 4,
    reverb: 0.75,
    description: 'Lounge'
  },
  retail: {
    tempo: 95,
    density: 0.8,
    range: 'medium',
    complexity: 4,
    reverb: 0.65,
    description: 'Retail'
  }
};

// Note frequencies
const NOTE_FREQUENCIES = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
  'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98, 'A6': 1760.00, 'B6': 1975.53
};

const NOTE_RANGES = {
  narrow: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5'],
  medium: ['G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5'],
  wide: ['E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5']
};

let state = {
  preset: 'hotel',
  volume: 0.75,
  reverb: 0.85,
  noteCount: 0,
  startTime: Date.now()
};

// Grand Piano Sound Generator
class GrandPianoEngine {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.reverbNode = null;
    this.convolverNode = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = state.volume;
      this.gainNode.connect(this.audioContext.destination);
      
      // Create reverb
      await this.createReverb();
      
      this.isInitialized = true;
      console.log('Grand piano engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  async createReverb() {
    try {
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * 4;
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const decay = Math.exp(-i / (sampleRate * (0.8 + state.reverb * 0.4)));
          channelData[i] = (Math.random() * 2 - 1) * decay * 0.4;
        }
      }
      
      this.convolverNode = this.audioContext.createConvolver();
      this.convolverNode.buffer = impulse;
      this.convolverNode.connect(this.gainNode);
      
    } catch (e) {
      console.warn('Reverb creation failed:', e);
    }
  }

  // Create realistic grand piano sound
  playPianoNote(note, time = 0) {
    if (!this.isInitialized || !this.audioContext) return;
    
    try {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;
      
      const now = this.audioContext.currentTime + time;
      const velocity = 0.5 + Math.random() * 0.4;
      
      // Layer 1: Main body of the note (triangle wave with filtered harmonics)
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);
      
      // Add slight pitch variation for realism
      osc1.frequency.exponentialRampToValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.001), now + 0.1);
      
      // Envelope for main body
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.4 * state.volume, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.25 * state.volume, now + 0.2);
      gain1.gain.exponentialRampToValueAtTime(velocity * 0.15 * state.volume, now + 0.8);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 3 + Math.random() * 2);
      
      // Layer 2: Bright harmonics (sine wave at 2x frequency)
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);
      
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.exponentialRampToValueAtTime(velocity * 0.15 * state.volume, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(velocity * 0.08 * state.volume, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      // Layer 3: String resonance (sine wave at 3x frequency)
      const osc3 = this.audioContext.createOscillator();
      const gain3 = this.audioContext.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 3, now);
      
      gain3.gain.setValueAtTime(0.001, now);
      gain3.gain.exponentialRampToValueAtTime(velocity * 0.08 * state.volume, now + 0.02);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      // Layer 4: Attack transient (noise burst for hammer sound)
      const bufferSize = this.audioContext.sampleRate * 0.01;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.setValueAtTime(velocity * 0.15 * state.volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      
      // Connect all layers
      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);
      noise.connect(noiseGain);
      
      // Connect to reverb or direct
      if (this.convolverNode) {
        // Wet path for reverb
        const wetGain1 = this.audioContext.createGain();
        wetGain1.gain.value = state.reverb * 0.6;
        gain1.connect(wetGain1);
        wetGain1.connect(this.convolverNode);
        
        // Dry path
        const dryGain1 = this.audioContext.createGain();
        dryGain1.gain.value = 1 - state.reverb * 0.3;
        gain1.connect(dryGain1);
        dryGain1.connect(this.gainNode);
        
        // Connect other layers to reverb too
        const wetGain2 = this.audioContext.createGain();
        wetGain2.gain.value = state.reverb * 0.4;
        gain2.connect(wetGain2);
        wetGain2.connect(this.convolverNode);
        
        const wetGain3 = this.audioContext.createGain();
        wetGain3.gain.value = state.reverb * 0.3;
        gain3.connect(wetGain3);
        wetGain3.connect(this.convolverNode);
        
        // Dry for other layers
        gain2.connect(this.gainNode);
        gain3.connect(this.gainNode);
        noiseGain.connect(this.gainNode);
      } else {
        gain1.connect(this.gainNode);
        gain2.connect(this.gainNode);
        gain3.connect(this.gainNode);
        noiseGain.connect(this.gainNode);
      }
      
      // Start all
      osc1.start(now);
      osc1.stop(now + 4);
      osc2.start(now);
      osc2.stop(now + 1.5);
      osc3.start(now);
      osc3.stop(now + 0.8);
      noise.start(now);
      noise.stop(now + 0.05);
      
      // Increment note count
      state.noteCount++;
      
    } catch (e) {
      console.debug('Note play error:', e);
    }
  }

  setVolume(value) {
    state.volume = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  setReverb(value) {
    state.reverb = value;
    this.createReverb();
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }
}

// Music Generator
class MusicGenerator {
  constructor(engine) {
    this.engine = engine;
    this.isRunning = false;
    this.timeoutId = null;
    this.lastNoteTime = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    state.startTime = Date.now();
    this.scheduleNotes();
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  scheduleNotes() {
    if (!this.isRunning) return;

    const preset = PRESETS[state.preset];
    const tempo = preset.tempo;
    const density = preset.density;
    const range = NOTE_RANGES[preset.range];
    const complexity = preset.complexity;

    const baseInterval = 60 / tempo;
    const variation = baseInterval * 0.3;
    let interval = baseInterval + (Math.random() - 0.5) * variation * 2;
    interval = interval / (0.5 + density * 0.8);

    this.timeoutId = setTimeout(() => {
      this.playNoteCluster(range, complexity);
      this.scheduleNotes();
    }, interval * 1000);

    if (this.lastNoteTime === 0) {
      this.playNoteCluster(range, complexity);
    }
    this.lastNoteTime = Date.now();
  }

  playNoteCluster(range, complexity) {
    const noteCount = Math.floor(1 + Math.random() * complexity);
    const notes = [];

    for (let i = 0; i < noteCount; i++) {
      const note = range[Math.floor(Math.random() * range.length)];
      notes.push(note);
    }

    notes.forEach((note, index) => {
      const delay = index * 0.05 + Math.random() * 0.03;
      this.engine.playPianoNote(note, delay);
    });
  }
}

// Initialize piano engine
let pianoEngine = new GrandPianoEngine();
let musicGenerator = null;

// Message handler from background
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'startPiano') {
    if (!pianoEngine.isInitialized) {
      await pianoEngine.init();
    }
    
    if (message.preset) state.preset = message.preset;
    if (message.volume !== undefined) pianoEngine.setVolume(message.volume);
    if (message.reverb !== undefined) pianoEngine.setReverb(message.reverb);
    
    if (!musicGenerator) {
      musicGenerator = new MusicGenerator(pianoEngine);
    }
    
    if (pianoEngine.audioContext && pianoEngine.audioContext.state === 'suspended') {
      await pianoEngine.audioContext.resume();
    }
    
    musicGenerator.start();
    isPlaying = true;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'stopPiano') {
    if (musicGenerator) {
      musicGenerator.stop();
    }
    isPlaying = false;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateVolume') {
    if (pianoEngine) {
      pianoEngine.setVolume(message.volume);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateReverb') {
    if (pianoEngine) {
      pianoEngine.setReverb(message.reverb);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updatePreset') {
    state.preset = message.preset;
    sendResponse({ success: true });
    return true;
  }
});

console.log('Offscreen piano engine ready');
