import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@14.7.77/build/esm/Tone.js';

// State
const state = {
    isPlaying: true,
    volume: 0.75,
    reverb: 0.85,
    preset: 'hotel',
    noteCount: 0,
    startTime: Date.now(),
    scheduledEvents: [],
    currentNote: null,
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

// Note ranges
const NOTE_RANGES = {
    narrow: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5'],
    medium: ['G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5'],
    wide: ['E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5']
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
    galaxyBg: document.getElementById('galaxy-bg'),
};

// Audio engine
class PianoEngine {
    constructor() {
        this.sampler = null;
        this.reverb = null;
        this.volume = null;
        this.isInitialized = false;
        this.initializing = false;
    }

    async init() {
        if (this.isInitialized || this.initializing) return;
        this.initializing = true;

        try {
            // Create reverb
            this.reverb = new Tone.Reverb({
                decay: 8,
                preDelay: 0.1,
                wet: state.reverb
            });

            // Create volume
            this.volume = new Tone.Volume(state.volume * 10 - 10).toDestination();

            // Create sampler with 3 samples (C2, C4, C6)
            this.sampler = new Tone.Sampler({
                urls: {
                    C2: 'samples/C2.wav',
                    C4: 'samples/C4.wav',
                    C6: 'samples/C6.wav',
                },
                baseUrl: chrome.runtime.getURL('/'),
                onload: () => {
                    console.log('Sampler loaded');
                },
                onerror: (err) => {
                    console.warn('Sample loading failed, using oscillators:', err);
                    this.useFallbackSynth();
                }
            });

            // Connect: sampler -> reverb -> volume
            this.sampler.connect(this.reverb);
            this.reverb.connect(this.volume);

            // Wait for Tone to be ready
            await Tone.start();
            
            // Check if sampler has samples loaded
            if (this.sampler.loaded === false) {
                // Try to load with a timeout
                await new Promise(resolve => setTimeout(resolve, 2000));
                if (this.sampler.loaded === false) {
                    this.useFallbackSynth();
                }
            }

            this.isInitialized = true;
            this.initializing = false;
            console.log('Piano engine initialized');
        } catch (error) {
            console.warn('Failed to initialize sampler, using fallback:', error);
            this.useFallbackSynth();
            this.isInitialized = true;
            this.initializing = false;
        }
    }

    useFallbackSynth() {
        console.log('Using fallback synth');
        // Create a simple synth as fallback
        this.sampler = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: 'triangle'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.3,
                release: 1.5
            }
        });
        this.sampler.connect(this.reverb);
        this.reverb.connect(this.volume);
    }

    playNote(note, time = Tone.now()) {
        if (!this.isInitialized || !this.sampler) return;
        try {
            // Handle different sampler types
            if (typeof this.sampler.triggerAttack === 'function') {
                this.sampler.triggerAttack(note, time, state.volume * 0.5);
            } else if (typeof this.sampler.triggerAttackRelease === 'function') {
                this.sampler.triggerAttackRelease(note, '8n', time, state.volume * 0.5);
            }
        } catch (e) {
            console.debug('Note play error:', e);
        }
    }

    releaseNote(note, time = Tone.now()) {
        if (!this.isInitialized || !this.sampler) return;
        try {
            if (typeof this.sampler.triggerRelease === 'function') {
                this.sampler.triggerRelease(note, time);
            }
        } catch (e) {
            console.debug('Note release error:', e);
        }
    }

    setVolume(value) {
        state.volume = value;
        if (this.volume) {
            this.volume.volume.value = value * 10 - 10;
        }
    }

    setReverb(value) {
        state.reverb = value;
        if (this.reverb) {
            this.reverb.wet.value = value;
        }
    }

    dispose() {
        if (this.sampler) {
            this.sampler.dispose();
        }
        if (this.reverb) {
            this.reverb.dispose();
        }
        if (this.volume) {
            this.volume.dispose();
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
        this.activeNotes = new Set();
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
        // Release all active notes
        this.activeNotes.forEach(note => {
            engine.releaseNote(note);
        });
        this.activeNotes.clear();
        this.updateStatus();
    }

    scheduleNotes() {
        if (!this.isRunning) return;

        const preset = PRESETS[state.preset];
        const tempo = preset.tempo;
        const density = preset.density;
        const range = NOTE_RANGES[preset.range];
        const complexity = preset.complexity;

        // Calculate time until next note (in seconds)
        const baseInterval = 60 / tempo;
        const variation = baseInterval * 0.3;
        let interval = baseInterval + (Math.random() - 0.5) * variation * 2;

        // Adjust density
        interval = interval / (0.5 + density * 0.8);

        // Schedule next note
        this.timeoutId = setTimeout(() => {
            this.playNoteCluster(range, complexity);
            this.scheduleNotes();
            this.updateStatus();
        }, interval * 1000);

        // Play first note immediately if this is a new session
        if (this.lastNoteTime === 0) {
            this.playNoteCluster(range, complexity);
        }
        this.lastNoteTime = Date.now();
    }

    playNoteCluster(range, complexity) {
        // Number of notes in this cluster
        const noteCount = Math.floor(1 + Math.random() * complexity);
        const notes = [];

        for (let i = 0; i < noteCount; i++) {
            // Random note from range
            const note = range[Math.floor(Math.random() * range.length)];
            notes.push(note);
        }

        // Play notes with slight timing variations
        const now = Tone.now();
        notes.forEach((note, index) => {
            const delay = index * 0.05 + Math.random() * 0.03;
            const time = now + delay;
            const duration = 0.5 + Math.random() * 1.0;
            
            // Track active note
            this.activeNotes.add(note);
            
            engine.playNote(note, time);
            
            // Release after duration
            setTimeout(() => {
                engine.releaseNote(note);
                this.activeNotes.delete(note);
            }, duration * 1000);

            // Update UI
            setTimeout(() => {
                elements.noteDisplay.textContent = note;
                state.noteCount++;
                elements.noteCount.textContent = `${state.noteCount} notes`;
            }, delay * 1000);
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
    // Play button
    elements.playBtn.addEventListener('click', togglePlay);

    // Volume slider
    elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        elements.volumeValue.textContent = val + '%';
        engine.setVolume(val / 100);
    });

    // Reverb slider
    elements.reverbSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        elements.reverbValue.textContent = val + '%';
        engine.setReverb(val / 100);
    });

    // Preset buttons
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
        // Pause
        state.isPlaying = false;
        generator.stop();
        elements.playBtn.classList.remove('active');
        elements.playLabel.textContent = 'Play';
        elements.playBtn.querySelector('.icon').textContent = '▶';
        elements.statusBadge.textContent = '⏸ PAUSED';
        elements.statusBadge.style.color = '#ffaa88';
        elements.statusBadge.style.borderColor = 'rgba(255,170,136,0.2)';
    } else {
        // Resume
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
    // Update reverb based on preset
    const reverbVal = config.reverb * 100;
    elements.reverbSlider.value = reverbVal;
    elements.reverbValue.textContent = Math.round(reverbVal) + '%';
    engine.setReverb(config.reverb);
    
    // Update status display
    elements.presetDisplay.textContent = config.description;
}

// Initialize
async function init() {
    setupUI();
    
    // Initialize audio engine
    await engine.init();
    
    // Set initial values
    engine.setVolume(state.volume);
    engine.setReverb(state.reverb);
    
    // Start music
    generator.start();
    
    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Reduce CPU when hidden
            if (generator.isRunning) {
                // Keep running but with reduced complexity
            }
        }
    });
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    generator.stop();
    engine.dispose();
});

// Start
init();

// Export for debugging
export { state, engine, generator };
