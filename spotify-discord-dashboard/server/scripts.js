/**
 * Digital Harmony Dashboard
 * Main JavaScript functionality
 */

// ----------------- GLOBAL VARIABLES -----------------
// API status tracking
let discordConnected = false;
let spotifyConnected = false;
let visualizerActive = false;

// Playback tracking
let currentTrack = null;
let trackTimer = null;
let autoRefreshTimer = null;
let autoRefreshEnabled = true; // Auto-refresh enabled by default

// ----------------- INITIALIZATION FUNCTIONS -----------------
window.onload = function() {
    setDefaultProfileInfo();        
    createFractalBackground();
    setupEnhancedCursorEffect(); // Changed to use the enhanced cursor effect
    setupVisualizer();
    refreshStatus();
    startAutoRefresh();
    startDiscordRefresh();
    setTimeout(debugDiscordData, 2000); // Debug Discord data after load
};

// ----------------- PROFILE FUNCTIONS -----------------
function setDefaultProfileInfo() {
    // Set default profile information
    const yourName = "Fractal";
    const yourTag = "Frac."; 
    
    // Update the profile elements
    document.getElementById('profile-name').textContent = yourName;
    document.getElementById('profile-tag').textContent = yourTag;
}

function updateProfileFromDiscord(data) {
    // Only update if we have valid data
    if (data && data.username) {
        // Update name
        document.getElementById('profile-name').textContent = data.username;
        
        // Update connection status
        document.getElementById('profile-tag').textContent = "Connected to Discord";
        
        // Update avatar if available
        if (data.avatarURL) {
            const avatarImg = document.getElementById('avatar-image');
            if (avatarImg) {
                avatarImg.src = data.avatarURL;
                avatarImg.style.display = 'block';
                
                // Hide initials when avatar is shown
                const initials = document.getElementById('avatar-initials');
                if (initials) {
                    initials.style.display = 'none';
                }
            }
        }
    }
}

// ----------------- VISUAL EFFECTS -----------------
// Create fractal canvas background
const createFractalBackground = () => {
    const canvas = document.getElementById('fractalCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to window size
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawFractal();
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Draw Mandelbrot fractal
    function drawFractal() {
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Fractal parameters
        const maxIterations = 100;
        const zoom = 0.004 * (window.innerWidth < 600 ? 2 : 1);
        const moveX = -0.7;
        const moveY = 0;
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                // Convert pixel coordinates to complex plane coordinates
                const realPart = (x - width / 2) * zoom + moveX;
                const imaginaryPart = (y - height / 2) * zoom + moveY;
                
                let realPartZ = 0;
                let imaginaryPartZ = 0;
                let iterations = 0;
                
                // Mandelbrot formula: z = z^2 + c
                while (iterations < maxIterations && 
                       realPartZ * realPartZ + imaginaryPartZ * imaginaryPartZ < 4) {
                    const temp = realPartZ * realPartZ - imaginaryPartZ * imaginaryPartZ + realPart;
                    imaginaryPartZ = 2 * realPartZ * imaginaryPartZ + imaginaryPart;
                    realPartZ = temp;
                    iterations++;
                }
                
                // Color the pixel based on iterations
                const pixelIndex = (y * width + x) * 4;
                
                if (iterations === maxIterations) {
                    // Inside the set - black
                    data[pixelIndex] = 0;
                    data[pixelIndex + 1] = 0;
                    data[pixelIndex + 2] = 0;
                    data[pixelIndex + 3] = 255;
                } else {
                    // Outside the set - color based on iterations
                    const color1 = [21, 92, 145]; // Dark blue
                    const color2 = [80, 24, 95];  // Deep purple
                    
                    const colorRatio = iterations / maxIterations;
                    const r = Math.floor(color1[0] * (1 - colorRatio) + color2[0] * colorRatio);
                    const g = Math.floor(color1[1] * (1 - colorRatio) + color2[1] * colorRatio);
                    const b = Math.floor(color1[2] * (1 - colorRatio) + color2[2] * colorRatio);
                    
                    data[pixelIndex] = r;
                    data[pixelIndex + 1] = g;
                    data[pixelIndex + 2] = b;
                    data[pixelIndex + 3] = 50; // Very transparent
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
};

// Enhanced cursor effect with smoother trails
const setupEnhancedCursorEffect = () => {
    const cursor = document.getElementById('cursor-ghost');
    const trailsContainer = document.getElementById('cursor-trails-container');
    
    // Clear any existing trail elements
    trailsContainer.innerHTML = '';
    
    // Parameters for the trail effect
    const maxTrails = 20; // More trail elements for smoother effect
    const trails = [];
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    
    // Create trail elements
    for (let i = 0; i < maxTrails; i++) {
        const trail = document.createElement('div');
        trail.classList.add('cursor-trail');
        
        // Set size and opacity based on position in the trail
        const size = Math.max(4, 12 - (i * 0.5)); // Gradually reduce size
        const opacity = Math.max(0.1, 1 - (i * 0.05)); // Gradually reduce opacity
        
        trail.style.width = `${size}px`;
        trail.style.height = `${size}px`;
        trail.style.opacity = opacity;
        
        // Different colors for a more dynamic effect (optional)
        if (i < 5) {
            trail.style.background = 'rgba(212, 175, 55, 0.8)'; // Gold for first few elements
        } else if (i < 10) {
            trail.style.background = 'rgba(212, 175, 55, 0.6)'; // Lighter gold
        } else {
            trail.style.background = 'rgba(212, 175, 55, 0.4)'; // Even lighter gold
        }
        
        trailsContainer.appendChild(trail);
        trails.push({
            element: trail,
            x: 0,
            y: 0
        });
    }
    
    // Smoothly update cursor position with easing
    function updateCursorPosition() {
        // Ease towards target position
        currentX += (targetX - currentX) * 0.2;
        currentY += (targetY - currentY) * 0.2;
        
        // Update main cursor
        cursor.style.left = `${currentX}px`;
        cursor.style.top = `${currentY}px`;
        
        // Cascade positions through trail elements for smoother follow
        let prevX = currentX;
        let prevY = currentY;
        
        trails.forEach((trail, index) => {
            // Each trail follows the previous one with delay
            trail.x += (prevX - trail.x) * (0.18 - (index * 0.005));
            trail.y += (prevY - trail.y) * (0.18 - (index * 0.005));
            
            // Update trail element position
            trail.element.style.left = `${trail.x}px`;
            trail.element.style.top = `${trail.y}px`;
            
            // Store this position for the next trail to follow
            prevX = trail.x;
            prevY = trail.y;
        });
        
        requestAnimationFrame(updateCursorPosition);
    }
    
    // Start animation loop
    updateCursorPosition();
    
    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
    });
    
    // Change cursor size on click
    document.addEventListener('mousedown', () => {
        cursor.style.width = '35px';
        cursor.style.height = '35px';
    });
    
    document.addEventListener('mouseup', () => {
        cursor.style.width = '25px';
        cursor.style.height = '25px';
    });
};


// ----------------- AUDIO VISUALIZER -----------------
// Audio visualizer setup and toggle
function setupVisualizer() {
    const visualizerContainer = document.getElementById('audio-visualizer');
    const barCount = 32;
    
    // Create bars
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.classList.add('audio-bar');
        visualizerContainer.appendChild(bar);
    }
    
    updateVisualizer();
}

function updateVisualizer() {
    if (!visualizerActive) return;
    
    const bars = document.querySelectorAll('.audio-bar');
    bars.forEach(bar => {
        // Generate random height for each bar
        const height = Math.floor(Math.random() * 50) + 5;
        bar.style.height = `${height}px`;
    });
    
    // Update visualizer at 60fps
    requestAnimationFrame(updateVisualizer);
}

function toggleVisualizer() {
    visualizerActive = !visualizerActive;
    
    if (visualizerActive) {
        updateVisualizer();
    }
}

// ----------------- API INTERACTION -----------------
function refreshStatus() {
    // Show loading state
    showLoadingState();
    
    // Check connection status first
    fetch('http://127.0.0.1:8080/api/status')
        .then(response => response.json())
        .then(status => {
            // Update connection status in profile
            const profileTag = document.getElementById('profile-tag');
            if (status.spotifyAuthenticated) {
                fetchSpotifyData();
            } else {
                // Spotify not authenticated
                profileTag.textContent = 'Spotify not connected';
                updateSpotifyStatus({ isPlaying: false });
            }
            
            if (status.discordAuthenticated) {
                fetchDiscordData();
            } else {
                // Discord not authenticated
                const statusEl = document.getElementById('discord-status');
                const statusTextEl = statusEl.querySelector('.status-text');
                const statusIndicator = statusTextEl.querySelector('.status-indicator');
                
                statusIndicator.className = "status-indicator inactive";
                statusTextEl.querySelector('span:last-child').textContent = "Not connected";
                
                updateDiscordStatus({ isPlaying: false, isOnline: false });
            }
        })
        .catch(error => {
            console.error('Error checking API status:', error);
            // Fall back to default data if server isn't available
            setDefaultProfileInfo();
        });
}

function showLoadingState() {
    // Reset to loading state
    document.querySelector('#spotify-status .track-details h3').textContent = "Loading...";
    document.querySelector('#spotify-status .track-details p').innerHTML = '<div class="waiting-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    
    document.querySelector('#discord-status .game-details h3').textContent = "Loading...";
    document.querySelector('#discord-status .game-details p').innerHTML = '<div class="waiting-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
}
        
// ----------------- SPOTIFY FUNCTIONS -----------------
function fetchSpotifyData(silent = false) {
    if (!silent) {
        // Only show loading state if not a silent refresh
        const trackDetailsEl = document.querySelector('#spotify-status .track-details');
        trackDetailsEl.innerHTML = `
            <h3>Loading...</h3>
            <div class="waiting-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
    }
    
    fetch('http://127.0.0.1:8080/api/spotify-current')
        .then(response => {
            if (!response.ok) {
                throw new Error('Spotify API returned an error');
            }
            return response.json();
        })
        .then(data => {
            console.log('Spotify data received:', data); // Debug logging
            updateSpotifyStatus(data);
        })
        .catch(error => {
            console.error('Error fetching Spotify data:', error);
            // Do nothing on error for silent refresh
        });
}

function updateSpotifyStatus(data) {
    const statusEl = document.getElementById('spotify-status');
    const trackDetailsEl = statusEl.querySelector('.track-details');
    const progressEl = statusEl.querySelector('.progress');
    const timestampEl = statusEl.querySelector('.timestamp');
    const albumArtImg = statusEl.querySelector('.album-art img');
    
    // Stop any existing progress timer
    if (trackTimer) {
        clearInterval(trackTimer);
        trackTimer = null;
    }
    
    if (data.isPlaying) {
        // Update track details
        trackDetailsEl.innerHTML = `
            <h3>${data.trackName}</h3>
            <p>${data.artistName}</p>
            <p>${data.albumName}</p>
        `;
        
        // Update album art
        if (data.albumArt && albumArtImg) {
            console.log("Setting album art to:", data.albumArt);
            albumArtImg.src = data.albumArt;
            albumArtImg.style.display = 'block';
        } else {
            // Fallback if no album art
            console.log("No album art available");
            if (albumArtImg) {
                albumArtImg.src = "/api/placeholder/80/80";
                albumArtImg.style.display = 'block';
            }
        }
        
        // Store current track for comparison
        currentTrack = {
            trackName: data.trackName,
            artistName: data.artistName,
            duration: data.duration,
            progress: data.progress
        };
        
        // Set initial progress
        let currentProgress = data.progress;
        const duration = data.duration;
        updateProgressBar(currentProgress, duration);
        
        // Start progress timer that updates every second
        trackTimer = setInterval(() => {
            currentProgress++;
            
            // If we've reached the end of the track, trigger a refresh
            if (currentProgress >= duration) {
                clearInterval(trackTimer);
                setTimeout(() => fetchSpotifyData(true), 1000);
                return;
            }
            
            updateProgressBar(currentProgress, duration);
        }, 1000);
    } else {
        // Not playing
        trackDetailsEl.innerHTML = `
            <h3>Not Listening</h3>
            <p class="no-activity">No current Spotify activity</p>
        `;
        
        // Reset album art to placeholder
        if (albumArtImg) {
            albumArtImg.src = "/api/placeholder/80/80";
        }
        
        progressEl.style.width = '0%';
        timestampEl.innerHTML = `
            <span>0:00</span>
            <span>0:00</span>
        `;
        currentTrack = null;
    }
}

function updateProgressBar(progress, duration) {
    const statusEl = document.getElementById('spotify-status');
    const progressEl = statusEl.querySelector('.progress');
    const timestampEl = statusEl.querySelector('.timestamp');
    
    // Update progress bar width
    const progressPercent = (progress / duration) * 100;
    progressEl.style.width = `${progressPercent}%`;
    
    // Format times
    const progressFormatted = formatTime(progress);
    const durationFormatted = formatTime(duration);
    
    // Update timestamps
    timestampEl.innerHTML = `
        <span>${progressFormatted}</span>
        <span>${durationFormatted}</span>
    `;
}

// Format seconds to MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// ----------------- DISCORD FUNCTIONS -----------------
function fetchDiscordData(silent = false) {
    // Set default information immediately
    if (!silent) {
        const gameDetailsEl = document.querySelector('#discord-status .game-details');
        gameDetailsEl.innerHTML = `
            <h3>Loading...</h3>
            <div class="waiting-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
    }
    
    fetch('http://127.0.0.1:8080/api/discord-status')
        .then(response => response.json())
        .then(data => {
            console.log("Discord data received:", data);
            
            // Create status data object for Discord card with all available data
            const statusData = {
                isPlaying: false,
                isOnline: false,
                status: data.status || 'offline'
            };
            
            // Check if user is online based on status
            if (data.status && (data.status === 'online' || data.status === 'idle' || data.status === 'dnd')) {
                statusData.isOnline = true;
            }
            
            // Check activity and include ALL details
            if (data && data.activity) {
                statusData.isPlaying = true;
                statusData.gameName = data.activity.name;
                statusData.elapsedTime = data.activity.elapsedTime;
                
                // Include these additional details from the Discord data
                statusData.details = data.activity.details;
                statusData.state = data.activity.state;
                statusData.gameIcon = data.activity.icon;
            }
            
            // Also update profile info from Discord data
            if (data.username) {
                document.getElementById('profile-name').textContent = data.username;
                document.getElementById('profile-tag').textContent = data.id || "Connected";
            }
            
            // Update Discord card with complete data
            updateDiscordStatus(statusData);
            
            // Update avatar if available
            if (data && data.avatarURL) {
                const placeholder = document.getElementById('avatar-placeholder');
                placeholder.innerHTML = `<img src="${data.avatarURL}" class="avatar-gif" alt="Discord Avatar">`;
            }
        })
        .catch(error => {
            console.error('Error fetching Discord data:', error);
            // Show offline status instead of error
            const statusEl = document.getElementById('discord-status');
            const statusTextEl = statusEl.querySelector('.status-text');
            const statusIndicator = statusTextEl.querySelector('.status-indicator');
            statusIndicator.className = "status-indicator inactive";
            statusTextEl.querySelector('span:last-child').textContent = "Offline";
        });
}

function updateDiscordStatus(data) {
    const statusEl = document.getElementById('discord-status');
    const gameDetailsEl = statusEl.querySelector('.game-details');
    const statusTextEl = statusEl.querySelector('.status-text');
    const statusIndicator = statusTextEl.querySelector('.status-indicator');
    const gameIconEl = statusEl.querySelector('.game-icon');
    
    // Update game details
    if (data.isPlaying && data.gameName) {
        // Create game details HTML that includes details and state if available
        let gameHTML = `<h3>${data.gameName}</h3>`;
        
        // Add the details (song title, etc.) if available
        if (data.details) {
            gameHTML += `<p>${data.details}</p>`;
        }
        
        // Add the state (e.g., "Clicking circles") if available
        if (data.state) {
            gameHTML += `<p>${data.state}</p>`;
        }
        
        // Add playing time at the end
        gameHTML += `<p class="elapsed-time">Playing for ${data.elapsedTime || "a while"}</p>`;
        
        // Update the game details HTML
        gameDetailsEl.innerHTML = gameHTML;
        
        // Update game icon
        if (gameIconEl) {
            if (data.gameIcon) {
                console.log("Attempting to display game icon:", data.gameIcon);
                gameIconEl.innerHTML = `<img src="${data.gameIcon}" alt="${data.gameName}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" onerror="this.onerror=null; this.src='/api/placeholder/80/80'; console.error('Failed to load game icon');">`;
            } else {
                console.log("No game icon URL provided, using default icon");
                // Default icon based on game name
                gameIconEl.innerHTML = getDefaultGameIcon(data.gameName);
            }
        }
    } else {
        gameDetailsEl.innerHTML = `
            <h3>Not Playing</h3>
            <p class="no-activity">No current game activity</p>
        `;
        
        // Reset icon
        if (gameIconEl) {
            gameIconEl.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                    <path d="M192 64C86 64 0 150 0 256S86 448 192 448H448c106 0 192-86 192-192s-86-192-192-192H192zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24v32h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H216v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V280H136c-13.3 0-24-10.7-24-24s10.7-24 24-24h32V200z"/>
                </svg>
            `;
        }
    }
    
    // Update status indicator based on status value
    if (data.status === 'online') {
        statusIndicator.className = "status-indicator online";
        statusTextEl.querySelector('span:last-child').textContent = "Online";
    } else if (data.status === 'idle') {
        statusIndicator.className = "status-indicator inactive";
        statusTextEl.querySelector('span:last-child').textContent = "Idle";
    } else if (data.status === 'dnd') {
        statusIndicator.className = "status-indicator inactive";
        statusIndicator.style.backgroundColor = "#f04747"; // Red for Do Not Disturb
        statusTextEl.querySelector('span:last-child').textContent = "Do Not Disturb";
    } else {
        statusIndicator.className = "status-indicator inactive";
        statusTextEl.querySelector('span:last-child').textContent = "Offline";
    }
}

function getDefaultGameIcon(gameName) {
    // Convert game name to lowercase for case-insensitive matching
    const name = (gameName || '').toLowerCase();
    
    if (name.includes('osu')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <circle cx="256" cy="256" r="248" fill="#FF66AA" />
            <circle cx="256" cy="256" r="200" fill="#000000" />
            <circle cx="256" cy="256" r="180" fill="#FF66AA" />
        </svg>`;
    } else if (name.includes('minecraft')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <path fill="#8B5E3C" d="M256,0L64,96v320l192,96l192-96V96L256,0z M400,374.4L256,441.6L112,374.4V137.6L256,70.4l144,67.2V374.4z"/>
            <path fill="#8B5E3C" d="M176,192h160v128H176V192z"/>
        </svg>`;
    } else {
        // Default controller icon
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
            <path fill="#666" d="M192 64C86 64 0 150 0 256S86 448 192 448H448c106 0 192-86 192-192s-86-192-192-192H192zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24v32h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H216v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V280H136c-13.3 0-24-10.7-24-24s10.7-24 24-24h32V200z"/>
        </svg>`;
    }
}

// ----------------- DEBUG FUNCTIONS -----------------
function debugDiscordData() {
    console.log("Debugging Discord data flow...");
    
    fetch('http://127.0.0.1:8080/api/discord-status')
        .then(response => response.json())
        .then(data => {
            console.log("Raw Discord data from server:", data);
            
            // Check if data is properly structured
            if (!data) {
                console.error("Discord data is null or undefined");
                return;
            }
            
            if (typeof data !== 'object') {
                console.error("Discord data is not an object:", typeof data);
                return;
            }
            
            console.log("Discord username:", data.username);
            console.log("Discord status:", data.status);
            console.log("Discord activity:", data.activity);
            
            // Try to update UI directly with this data
            try {
                if (data.username) {
                    document.getElementById('profile-name').textContent = data.username;
                    console.log("Updated profile name to:", data.username);
                }
            } catch (uiError) {
                console.error("Error updating UI:", uiError);
            }
        })
        .catch(error => {
            console.error("Error debugging Discord data:", error);
        });
}

// ----------------- AUTO-REFRESH FUNCTIONS -----------------
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    
    if (autoRefreshEnabled) {
        startAutoRefresh();
        document.getElementById('auto-refresh-toggle').textContent = 'Disable Auto-Refresh';
    } else {
        stopAutoRefresh();
        document.getElementById('auto-refresh-toggle').textContent = 'Enable Auto-Refresh';
    }
}

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    
    // Refresh Spotify status every 10 seconds
    autoRefreshTimer = setInterval(() => {
        fetchSpotifyData(true); // true = silent refresh (no loading animation)
    }, 10000); // 10 seconds
    
    console.log('Auto-refresh enabled');
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    
    console.log('Auto-refresh disabled');
}

function startDiscordRefresh() {
    // Refresh Discord status every 30 seconds
    setInterval(() => {
        fetchDiscordData(true); // silent refresh
    }, 1000); // 1 seconds
}