// Background service worker for The Pianist extension
// Handles extension lifecycle and keeps audio running when popup is closed

let isPlaying = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStatus') {
        sendResponse({ isPlaying });
    }
    return true;
});

// Keep service worker alive
chrome.runtime.onInstalled.addListener(() => {
    console.log('The Pianist installed');
});

// Handle extension icon click - already handled by popup
console.log('The Pianist background service worker running');
