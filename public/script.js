let autoRefreshEnabled = true;
let refreshInterval;
let captureInterval = 5000; // Default, will be updated from server

const statusEl = document.getElementById('status');
const imageEl = document.getElementById('streamImage');
const downloadBtnEl = document.getElementById('downloadBtn');
const placeholderEl = document.getElementById('placeholder');
const intervalInfoEl = document.getElementById('intervalInfo');
const pauseBtnEl = document.getElementById('pauseBtn');

// Get capture interval from server
async function getCaptureInterval() {
    try {
        const response = await fetch('/config');
        if (response.ok) {
            const config = await response.json();
            captureInterval = config.captureInterval || 5000;
            console.log(`Using capture interval: ${captureInterval}ms`);
            updateIntervalInfo();
        }
    } catch (error) {
        console.log('Could not fetch capture interval, using default:', captureInterval);
        updateIntervalInfo();
    }
}

function updateIntervalInfo() {
    const seconds = captureInterval / 1000;
    const intervalSecondsEl = document.getElementById('intervalSeconds');
    if (intervalSecondsEl) {
        intervalSecondsEl.textContent = seconds.toString();
    }
}

function setStatus(type = 'idle') {
    const messageMap = {
        idle: "Initializing stream capture...",
        pending: "Program paused",
        loading: "Capturing new image...",
        success: "Image updated successfully",
        error: "Failed to load image",
    }
    if (type === 'idle' || type === 'pending' || type === 'loading' || type === 'error' || type === 'loading') {
        statusEl.dataset.status = type;
        statusEl.textContent = messageMap[type];
    }
}

let lastImageSrc = '';
let isLoading = false;

function loadImage() {
    if (isLoading) return; // Prevent multiple concurrent requests

    isLoading = true;
    setStatus('loading');

    const timestamp = Date.now();
    const img = new Image();
    img.onload = function () {
        // Only update if the image has actually changed
        if (this.src !== lastImageSrc) {
            allowDownload(this.src);
            imageEl.src = this.src;
            imageEl.style.display = 'block';
            placeholderEl.style.display = 'none';
            setStatus('success');
            lastImageSrc = this.src;
        } else {
            setStatus('success');
        }
        isLoading = false;
    };

    img.onerror = function () {
        setStatus('error');
        isLoading = false;
        setTimeout(() => {
            if (autoRefreshEnabled) {
                setStatus('loading');
            }
        }, 2000);
    };

    img.src = `/current-image?t=${timestamp}`;
}

function refreshImage() {
    loadImage();
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;

    const buttonText = pauseBtnEl.querySelector('span');
    const buttonIcon = pauseBtnEl.querySelector('svg path');

    if (autoRefreshEnabled) {
        buttonText.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Pause Auto-Refresh
                `;
        startAutoRefresh();
        setStatus('loading');
        intervalInfoEl.style.opacity = '1';
    } else {
        buttonText.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Resume Auto-Refresh
                `;
        clearInterval(refreshInterval);
        setStatus('pending');
        intervalInfoEl.style.opacity = '0.5';
    }
}

function allowDownload(src) {

    downloadBtnEl.href = src
    downloadBtnEl.dataset.allowDownload = "true"


    const timestamp = src.split('t=').pop()
    const formattedTimestamp = new Date(Number(timestamp))

    const time = formatDateGMT7(formattedTimestamp)
    downloadBtnEl.download = "CCTV-NOC_" + time
}

function formatDateGMT7 (date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    refreshInterval = setInterval(() => {
        if (autoRefreshEnabled) {
            loadImage();
        }
    }, captureInterval); // Use dynamic capture interval
}

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    await getCaptureInterval(); // Get interval from server first
    loadImage();
    startAutoRefresh();
});

// Handle page visibility changes - pause when not visible
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        clearInterval(refreshInterval);
        setStatus("pending")
        console.log('Page hidden, pausing auto-refresh');
    } else if (autoRefreshEnabled) {
        console.log('Page visible, resuming auto-refresh');
        startAutoRefresh();
        loadImage(); // Immediate refresh when page becomes visible
    }
});

// Handle network status changes
window.addEventListener('online', function () {
    console.log('Connection restored');
    if (autoRefreshEnabled) {
        loadImage();
    }
});

window.addEventListener('offline', function () {
    console.log('Connection lost');
    setStatus('error');
});