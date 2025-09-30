let autoRefreshEnabled = true
let refreshInterval
let captureInterval = 5000

const statusEl = document.getElementById('status')
const imageEl = document.getElementById('streamImage')
const downloadBtnEl = document.getElementById('downloadBtn')
const placeholderEl = document.getElementById('placeholder')
const intervalInfoEl = document.getElementById('intervalInfo')
const mediaStateEl = document.getElementById('mediaState')

async function getCaptureIntervalFromServer() {
    try {
        const response = await fetch('/config')
        if (response.ok) {
            const config = await response.json()
            captureInterval = config.captureInterval || 5000
            console.log(`Using capture interval: ${captureInterval}ms`)
            updateIntervalInfo()
        }
    } catch (error) {
        console.log('Could not fetch capture interval, using default:', captureInterval)
        updateIntervalInfo()
    }
}

function updateIntervalInfo() {
    const seconds = captureInterval / 1000
    const intervalSecondsEl = document.getElementById('intervalSeconds')
    if (intervalSecondsEl) {
        intervalSecondsEl.textContent = seconds.toString()
    }
}

function setStatus(type = 'idle') {
    const messageMap = {
        idle: "Initializing stream capture...",
        pending: "Program paused",
        loading: "Capturing new image...",
        success: "Image updated successfully",
        error: "Failed to load image",
        offline: "You are offline",
        online: "Connection restored",
    }
    if (type === 'idle' || type === 'pending' || type === 'loading' || type === 'error' || type === 'loading' || type === 'offline' || type === 'online') {
        statusEl.dataset.status = type
        statusEl.textContent = messageMap[type]
    }
}

let lastImageSrc = ''
let isCurrentlyCapturing = false

function loadImage() {
    if (isCurrentlyCapturing) return

    isCurrentlyCapturing = true
    setStatus('loading')

    const timestamp = Date.now()
    const img = new Image()
    img.onload = function () {
        if (this.src !== lastImageSrc) {
            setStatus('success')
            allowDownload(this.src)
            lastImageSrc = this.src
            imageEl.src = this.src

            imageEl.style.display = 'block'
            placeholderEl.style.display = 'none'
        } else {
            setStatus('success')
        }
        isCurrentlyCapturing = false
    }

    img.onerror = function () {
        setStatus('error')
        isCurrentlyCapturing = false
        setTimeout(() => {
            if (autoRefreshEnabled) {
                setStatus('loading')
            }
        }, 2000)
    }

    img.src = `/current-image?t=${timestamp}`
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled

    if (autoRefreshEnabled) {
        mediaStateEl.dataset.paused = 'false'
        startAutoRefresh()
        setStatus('loading')
        intervalInfoEl.classList.add('opacity-100')
        intervalInfoEl.classList.remove('opacity-50')
    } else {
        mediaStateEl.dataset.paused = 'true'
        clearInterval(refreshInterval)
        setStatus('pending')
        mediaStateEl.dataset.paused = 'true'
        intervalInfoEl.classList.remove('opacity-100')
        intervalInfoEl.classList.add('opacity-50')
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

function formatDateGMT7(date) {
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
        clearInterval(refreshInterval)
    }

    refreshInterval = setInterval(() => {
        if (autoRefreshEnabled) {
            loadImage()
        }
    }, captureInterval)
}

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    await getCaptureIntervalFromServer()
    loadImage()
    startAutoRefresh()
})

/**
 * F O C U S
 */
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        document.body.dataset.focus = 'false'
        clearInterval(refreshInterval)
        setStatus("pending")
    } else if (autoRefreshEnabled) {
        document.body.dataset.focus = 'true'
        loadImage()
        startAutoRefresh()
    }
})