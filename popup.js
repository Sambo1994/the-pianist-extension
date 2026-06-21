// Self-contained piano engine using Web Audio API - No external dependencies!

// State
const state = {
    isPlaying: true,
    volume: 0.75,
    reverb: 0.85,
    preset: 'hotel',
    noteCount: 0,
    startTime: Date.now(),
    audioContext: null,
    reverbNode: null,
    gainNode: null,
    convolverNode: null,
    activeOscillators: [],
    reverbBuffer: null
};

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

// Note ranges and frequencies
const NOTE_RANGES = {
    narrow: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5'],
    medium: ['G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5'],
    wide: ['E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5']
};

const NOTE_FREQUENCIES = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98, 'A6': 1760.00, 'B6': 1975.53
};

// DOM elements
const elements = {
    playBtn: document.getElementById('playBtn'),
    playLabel: document.getElementById('playLabel'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    reverbSlider: document.getElementById('reverbSlider'),
    reverbValue: document.getElementById('reverbValue'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    statusBadge: document.getElementById('statusBadge'),
    timeDisplay: document.getElementById('timeDisplay'),
    noteDisplay: document.getElementById('noteDisplay'),
    noteCount: document.getElementById('noteCount'),
    presetDisplay: document.getElementById('presetDisplay'),
};

// Audio Engine using Web Audio API
class PianoEngine {
    constructor() {
        this.audioContext = null;
        this.reverbNode = null;
        this.gainNode = null;
        this.convolverNode = null;
        this.isInitialized = false;
        this.activeNotes = new Map();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain node (volume control)
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = state.volume;
            this.gainNode.connect(this.audioContext.destination);
            
            // Create reverb
            await this.createReverb();
            
            this.isInitialized = true;
            console.log('Audio engine initialized');
        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }

    async createReverb() {
        try {
            // Create impulse response for reverb
            const sampleRate = this.audioContext.sampleRate;
            const length = sampleRate * 3; // 3 second reverb
            const impulse = this.audioContext.createBuffer(2, length, sampleRate);
            
            for (let channel = 0; channel < 2; channel++) {
                const channelData = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    const decay = Math.exp(-i / (sampleRate * 0.8 * (0.5 + state.reverb * 0.5)));
                    channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
                }
            }
            
            this.convolverNode = this.audioContext.createConvolver();
            this.convolverNode.buffer = impulse;
            this.convolverNode.connect(this.gainNode);
            
            // Create reverb wet/dry mix
            this.reverbNode = this.audioContext.createGain();
            this.reverbNode.gain.value = state.reverb;
            
            // Connect: input -> reverb -> gain -> destination
            // We'll connect sources to both dry and wet paths
        } catch (e) {
            console.warn('Reverb creation failed, using simple delay:', e);
            // Fallback to simple delay
            this.reverbNode = this.audioContext.createDelay(1.5);
            this.reverbNode.delayTime.value = 0.5;
            this.reverbNode.connect(this.gainNode);
        }
    }

    playNote(note, time = 0) {
        if (!this.isInitialized || !this.audioContext) return;
        
        try {
            const freq = NOTE_FREQUENCIES[note];
            if (!freq) return;
            
            const now = this.audioContext.currentTime + time;
            
            // Create oscillator for piano-like sound
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            // Use multiple oscillators for richer sound
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            
            // Main oscillator
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.001, now + 0.1);
            
            // Second oscillator for harmonics
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 2, now);
            gain2.gain.setValueAtTime(0.1, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            
            // Envelope
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.5 * state.volume, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.3 * state.volume, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            
            // Connect
            osc.connect(gain);
            osc2.connect(gain2);
            
            // Connect to reverb or direct
            if (this.reverbNode && this.convolverNode) {
                // Wet path
                const wetGain = this.audioContext.createGain();
                wetGain.gain.value = state.reverb * 0.7;
                gain.connect(wetGain);
                wetGain.connect(this.convolverNode);
                
                // Dry path
                const dryGain = this.audioContext.createGain();
                dryGain.gain.value = 1 - state.reverb * 0.5;
                gain.connect(dryGain);
                dryGain.connect(this.gainNode);
                
                gain2.connect(this.convolverNode);
            } else {
                gain.connect(this.gainNode);
                gain2.connect(this.gainNode);
            }
            
            // Start and stop
            osc.start(now);
            osc.stop(now + 1.5);
            osc2.start(now);
            osc2.stop(now + 0.8);
            
            // Store for cleanup
            const noteId = `${note}_${now}`;
            this.activeNotes.set(noteId, { osc, osc2, gain, gain2 });
            
            // Auto cleanup
            setTimeout(() => {
                this.activeNotes.delete(noteId);
            }, 2000);
            
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
        // Recreate reverb with new value
        if (this.audioContext) {
            this.createReverb();
        }
    }

    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isInitialized = false;
    }
}

// Piano engine instance
let engine = new PianoEngine();

// Music generator
class MusicGenerator {
    constructor() {
        this.isRunning = false;
        this.timeoutId = null;
        this.lastNoteTime = 0;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        state.startTime = Date.now();
        this.scheduleNotes();
        this.updateStatus();
    }

    stop() {
        this.isRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.updateStatus();
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
            this.updateStatus();
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
            const duration = 0.5 + Math.random() * 1.0;
            
            engine.playNote(note, delay);
            
            setTimeout(() => {
                elements.noteDisplay.textContent = note;
                state.noteCount++;
                elements.noteCount.textContent = `${state.noteCount} notes`;
            }, delay * 1000 + 50);
        });
    }

    updateStatus() {
        const elapsed = (Date.now() - state.startTime) / 1000;
        const minutes = Math.floor(elapsed / 60);
        const seconds = Math.floor(elapsed % 60);
        elements.timeDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        elements.noteCount.textContent = `${state.noteCount} notes`;
    }
}

// Music generator instance
let generator = new MusicGenerator();

// Initialize galaxy background
function createStars() {
    const bg = document.getElementById('galaxy-bg');
    for (let i = 0; i < 150; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 2.5 + 0.5;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--duration', (3 + Math.random() * 5) + 's');
        star.style.animationDelay = Math.random() * 5 + 's';
        star.style.opacity = 0.3 + Math.random() * 0.5;
        bg.appendChild(star);
    }
}
createStars();

// UI Event Handlers
function setupUI() {
    elements.playBtn.addEventListener('click', togglePlay);

    elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        elements.volumeValue.textContent = val + '%';
        engine.setVolume(val / 100);
    });

    elements.reverbSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        elements.reverbValue.textContent = val + '%';
        engine.setReverb(val / 100);
    });

    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const preset = btn.dataset.preset;
            state.preset = preset;
            elements.presetDisplay.textContent = PRESETS[preset].description;
            applyPreset(preset);
        });
    });
}

function togglePlay() {
    if (state.isPlaying) {
        state.isPlaying = false;
        generator.stop();
        elements.playBtn.classList.remove('active');
        elements.playLabel.textContent = 'Play';
        elements.playBtn.querySelector('.icon').textContent = '▶';
        elements.statusBadge.textContent = '⏸ PAUSED';
        elements.statusBadge.style.color = '#ffaa88';
        elements.statusBadge.style.borderColor = 'rgba(255,170,136,0.2)';
    } else {
        state.isPlaying = true;
        elements.playBtn.classList.add('active');
        elements.playLabel.textContent = 'Pause';
        elements.playBtn.querySelector('.icon').textContent = '⏸';
        elements.statusBadge.textContent = '● LIVE';
        elements.statusBadge.style.color = '#7ddfa0';
        elements.statusBadge.style.borderColor = 'rgba(100,220,150,0.15)';
        generator.start();
    }
}

function applyPreset(preset) {
    const config = PRESETS[preset];
    const reverbVal = config.reverb * 100;
    elements.reverbSlider.value = reverbVal;
    elements.reverbValue.textContent = Math.round(reverbVal) + '%';
    engine.setReverb(config.reverb);
    elements.presetDisplay.textContent = config.description;
}

// Initialize
async function init() {
    setupUI();
    await engine.init();
    engine.setVolume(state.volume);
    engine.setReverb(state.reverb);
    generator.start();
}

// Cleanup
window.addEventListener('beforeunload', () => {
    generator.stop();
    engine.dispose();
});

// Start
init();
