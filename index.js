require('dotenv').config();
const express = require('express');
const auth = require('basic-auth');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment variables
const RTSP_URL = process.env.RTSP_URL || 'rtsp://admin:password@192.168.1.100:554';
const CAPTURE_INTERVAL = parseInt(process.env.CAPTURE_INTERVAL) || 5000;
const TEMP_DIR = path.join(__dirname, 'temp');
const CURRENT_IMAGE = path.join(TEMP_DIR, 'current.jpg');

// Basic Auth Configuration
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'password';
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false'; // Enabled by default

// Basic Auth Middleware
function basicAuth(req, res, next) {
    if (!AUTH_ENABLED) {
        return next();
    }

    const credentials = auth(req);

    if (!credentials || credentials.name !== AUTH_USERNAME || credentials.pass !== AUTH_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="CCTV NOC Snapshot"');
        return res.status(401).send('Authentication required');
    }

    next();
}

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Test write permissions
try {
    const testFile = path.join(TEMP_DIR, 'test-write.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Temp directory write permissions verified');
} catch (error) {
    console.error('Error: Cannot write to temp directory:', error.message);
    console.error('Please check file permissions for:', TEMP_DIR);
}

// Serve static files (HTML, CSS, JS) with basic auth
app.use(express.static('public'), basicAuth);

// Apply basic auth to all routes
app.use(basicAuth);

// Serve the current image
app.get('/current-image', (req, res) => {
    if (fs.existsSync(CURRENT_IMAGE)) {
        res.sendFile(CURRENT_IMAGE);
    } else {
        res.status(404).send('Image not available');
    }
});

// Test RTSP connection function
function testRTSPConnection() {
    console.log('Testing RTSP connection...');
    
    const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', RTSP_URL,
        '-t', '1',
        '-f', 'null',
        '-'
    ]);

    let hasOutput = false;

    ffmpeg.stderr.on('data', (data) => {
        const dataStr = data.toString();
        if (dataStr.includes('Stream #0:0')) {
            hasOutput = true;
            console.log('RTSP stream detected:', dataStr.trim());
        }
        if (dataStr.includes('Error') || dataStr.includes('failed')) {
            console.log(`RTSP Test Error: ${dataStr}`);
        }
    });

    // Add timeout to prevent hanging processes (increased to 30 seconds)
    const timeout = setTimeout(() => {
        if (!ffmpeg.killed) {
            console.log('FFmpeg process timeout, killing...');
            ffmpeg.kill('SIGTERM');
        }
    }, 30000); // 30 second timeout

    ffmpeg.on('close', (code) => {
        clearTimeout(timeout); // Clear timeout when process completes
        if (code === 0 || hasOutput) {
            console.log('RTSP connection test successful');
        } else {
            console.error(`RTSP connection test failed with code ${code}`);
        }
    });
}
function captureImageFallback() {
    console.log('Trying fallback capture method...');
    
    const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'udp',
        '-i', RTSP_URL,
        '-frames:v', '1',
        '-q:v', '5',
        '-pix_fmt', 'yuvj420p',
        '-f', 'image2',
        '-y',
        CURRENT_IMAGE
    ]);

    let stderrData = '';

    ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
        const dataStr = data.toString();
        if (dataStr.includes('Error') || dataStr.includes('failed') || dataStr.includes('Invalid')) {
            console.log(`FFmpeg Fallback Error: ${dataStr}`);
        }
    });

    ffmpeg.on('close', (code) => {
        clearTimeout(timeout); // Clear timeout when process completes
        if (code === 0) {
            console.log('Fallback image captured successfully');
        } else {
            console.error(`FFmpeg fallback process exited with code ${code}`);
        }
    });

    ffmpeg.on('error', (error) => {
        clearTimeout(timeout); // Clear timeout on error
        console.error('Error spawning FFmpeg fallback:', error.message);
    });

    // Add timeout to prevent hanging processes
    const timeout = setTimeout(() => {
        if (!ffmpeg.killed) {
            console.log('FFmpeg fallback timeout, killing...');
            ffmpeg.kill('SIGTERM');
        }
    }, 10000); // 10 second timeout
}

// Enhanced capture function with retry logic
let captureAttempts = 0;
const maxRetries = 2;

function captureImageWithRetry() {
    captureAttempts++;
    
    const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-use_wallclock_as_timestamps', '1',
        '-i', RTSP_URL,
        '-frames:v', '1',
        '-q:v', '2',
        '-f', 'image2',
        '-update', '1',
        '-y',
        CURRENT_IMAGE
    ]);

    let stderrData = '';

    ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
        const dataStr = data.toString();
        if (dataStr.includes('Error') || dataStr.includes('failed') || dataStr.includes('Invalid')) {
            console.log(`FFmpeg Error: ${dataStr}`);
        }
    });

    ffmpeg.on('close', (code) => {
        clearTimeout(timeout); // Clear timeout when process completes
        if (code === 0) {
            console.log('Image captured successfully');
            captureAttempts = 0; // Reset on success
        } else {
            console.error(`FFmpeg process exited with code ${code} (attempt ${captureAttempts}/${maxRetries + 1})`);
            
            if (captureAttempts <= maxRetries) {
                console.log('Retrying with fallback method...');
                setTimeout(() => {
                    captureImageFallback();
                }, 2000);
            } else {
                console.error('Max retry attempts reached');
                captureAttempts = 0; // Reset for next interval
            }
        }
    });

    ffmpeg.on('error', (error) => {
        clearTimeout(timeout); // Clear timeout on error
        console.error('Error spawning FFmpeg:', error.message);
        if (captureAttempts <= maxRetries) {
            setTimeout(() => {
                captureImageFallback();
            }, 2000);
        }
    });

    // Add timeout to prevent hanging processes (reduced to 10 seconds for captures)
    const timeout = setTimeout(() => {
        if (!ffmpeg.killed) {
            console.log('FFmpeg capture timeout, killing...');
            ffmpeg.kill('SIGTERM');
        }
    }, 10000); // 10 second timeout for captures
}

// Start capturing images every 5 seconds
setInterval(captureImageWithRetry, CAPTURE_INTERVAL);

// Initial capture will be handled in app.listen callback

// Clean up temp files on exit
process.on('exit', () => {
    if (fs.existsSync(CURRENT_IMAGE)) {
        fs.unlinkSync(CURRENT_IMAGE);
    }
});

process.on('SIGINT', () => {
    console.log('Cleaning up...');
    if (fs.existsSync(CURRENT_IMAGE)) {
        fs.unlinkSync(CURRENT_IMAGE);
    }
    process.exit();
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Capturing from RTSP: ${RTSP_URL}`);
    console.log(`Images will be captured every ${CAPTURE_INTERVAL/1000} seconds`);
    console.log(`Basic Authentication: ${AUTH_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    if (AUTH_ENABLED) {
        console.log(`Auth Username: ${AUTH_USERNAME}`);
        console.log(`Auth Password: [PROTECTED]`);
    }
    
    // Test RTSP connection first
    testRTSPConnection();
    
    // Start capturing after a short delay
    setTimeout(() => {
        captureImageWithRetry();
    }, 3000);
});