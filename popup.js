// Popup controller for The Pianist
const state = {
  isPlaying: true,
  volume: 0.75,
  reverb: 0.85,
  preset: 'hotel',
  noteCount: 0,
  startTime: Date.now()
};

const PRESETS = {
  hotel: { tempo: 72, density: 0.6, range: 'medium', complexity: 3, reverb: 0.85, description: 'Hotel' },
  spa: { tempo: 60, density: 0.4, range: 'narrow', complexity: 2, reverb: 0.9, description: 'Spa' },
  lounge: { tempo: 85, density: 0.7, range: 'wide', complexity: 4, reverb: 0.75, description: 'Lounge' },
  retail: { tempo: 95, density: 0.8, range: 'medium', complexity: 4, reverb: 0.65, description: 'Retail' }
};

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

// Create stars background
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

// Start audio in background
async function startBackgroundAudio() {
  try {
    await chrome.runtime.sendMessage({
      action: 'startAudio',
      preset: state.preset,
      volume: state.volume,
      reverb: state.reverb
    });
    console.log('Background audio started');
  } catch (error) {
    console.error('Failed to start background audio:', error);
  }
}

// Stop background audio
async function stopBackgroundAudio() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopAudio' });
    console.log('Background audio stopped');
  } catch (error) {
    console.error('Failed to stop background audio:', error);
  }
}

// Update volume in background
async function updateVolume(volume) {
  try {
    await chrome.runtime.sendMessage({ action: 'updateVolume', volume });
  } catch (error) {
    console.error('Failed to update volume:', error);
  }
}

// Update reverb in background
async function updateReverb(reverb) {
  try {
    await chrome.runtime.sendMessage({ action: 'updateReverb', reverb });
  } catch (error) {
    console.error('Failed to update reverb:', error);
  }
}

// Update preset in background
async function updatePreset(preset) {
  try {
    await chrome.runtime.sendMessage({ action: 'updatePreset', preset });
  } catch (error) {
    console.error('Failed to update preset:', error);
  }
}

// UI Event Handlers
function setupUI() {
  // Play button
  elements.playBtn.addEventListener('click', togglePlay);

  // Volume slider
  elements.volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    elements.volumeValue.textContent = val + '%';
    state.volume = val / 100;
    updateVolume(state.volume);
  });

  // Reverb slider
  elements.reverbSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    elements.reverbValue.textContent = val + '%';
    state.reverb = val / 100;
    updateReverb(state.reverb);
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
    elements.playBtn.classList.remove('active');
    elements.playLabel.textContent = 'Play';
    elements.playBtn.querySelector('.icon').textContent = '▶';
    elements.statusBadge.textContent = '⏸ PAUSED';
    elements.statusBadge.style.color = '#ffaa88';
    elements.statusBadge.style.borderColor = 'rgba(255,170,136,0.2)';
    stopBackgroundAudio();
  } else {
    // Resume
    state.isPlaying = true;
    elements.playBtn.classList.add('active');
    elements.playLabel.textContent = 'Pause';
    elements.playBtn.querySelector('.icon').textContent = '⏸';
    elements.statusBadge.textContent = '● LIVE';
    elements.statusBadge.style.color = '#7ddfa0';
    elements.statusBadge.style.borderColor = 'rgba(100,220,150,0.15)';
    startBackgroundAudio();
  }
}

function applyPreset(preset) {
  const config = PRESETS[preset];
  const reverbVal = config.reverb * 100;
  elements.reverbSlider.value = reverbVal;
  elements.reverbValue.textContent = Math.round(reverbVal) + '%';
  state.reverb = config.reverb;
  elements.presetDisplay.textContent = config.description;
  updateReverb(state.reverb);
  updatePreset(preset);
}

// Update time display
function updateTimeDisplay() {
  if (!state.isPlaying) return;
  const elapsed = (Date.now() - state.startTime) / 1000;
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  elements.timeDisplay.textContent = 
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Initialize
async function init() {
  setupUI();
  
  // Start audio automatically
  await startBackgroundAudio();
  
  // Update time every second
  setInterval(updateTimeDisplay, 1000);
  
  // Increment note count periodically (simulated)
  setInterval(() => {
    if (state.isPlaying) {
      state.noteCount += Math.floor(Math.random() * 3) + 1;
      elements.noteCount.textContent = `${state.noteCount} notes`;
    }
  }, 3000);
}

// Handle popup close - don't stop audio, keep playing in background
window.addEventListener('beforeunload', () => {
  // Audio continues in background
  console.log('Popup closed, audio continues in background');
});

// Start
init();
