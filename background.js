// Background service worker for The Pianist
let offscreenDocument = null;
let isPlaying = false;

// Create offscreen document for background audio
async function createOffscreenDocument() {
  if (offscreenDocument) return;
  
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play piano music in background'
    });
    offscreenDocument = true;
    console.log('Offscreen document created');
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
  }
}

// Close offscreen document
async function closeOffscreenDocument() {
  if (!offscreenDocument) return;
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocument = null;
    console.log('Offscreen document closed');
  } catch (error) {
    console.error('Failed to close offscreen document:', error);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAudio') {
    createOffscreenDocument().then(() => {
      // Send message to offscreen document
      chrome.runtime.sendMessage({
        action: 'startPiano',
        preset: message.preset || 'hotel',
        volume: message.volume || 0.75,
        reverb: message.reverb || 0.85
      });
      isPlaying = true;
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'stopAudio') {
    chrome.runtime.sendMessage({ action: 'stopPiano' });
    isPlaying = false;
    // Don't close immediately, let it finish gracefully
    setTimeout(() => {
      if (!isPlaying) {
        closeOffscreenDocument();
      }
    }, 2000);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateVolume') {
    chrome.runtime.sendMessage({ 
      action: 'updateVolume', 
      volume: message.volume 
    });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateReverb') {
    chrome.runtime.sendMessage({ 
      action: 'updateReverb', 
      reverb: message.reverb 
    });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updatePreset') {
    chrome.runtime.sendMessage({ 
      action: 'updatePreset', 
      preset: message.preset 
    });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getStatus') {
    sendResponse({ isPlaying });
    return true;
  }
});

// Keep service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('The Pianist installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  // Popup will open automatically
});
