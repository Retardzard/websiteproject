/**
 * Unified Server for Digital Harmony Dashboard
 * Combines Spotify API integration and Discord Bot functionality
 */

// =================== DEPENDENCIES ===================
const express = require('express');
const cors = require('cors');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// =================== CONFIGURATION ===================
// Load configuration from config.json
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Configuration loaded successfully');
} catch (err) {
  console.error('Error loading configuration:', err.message);
  process.exit(1); // Exit if config can't be loaded
}

// Your Discord user ID (to track your specific status)
const DISCORD_USER_ID = "316238373641519105";

// Server port
const PORT = 8080;

// =================== EXPRESS SERVER SETUP ===================
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(session({
  secret: 'your-random-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using https
}));

// Serve static files
app.use(express.static(__dirname));

// =================== SPOTIFY API SETUP ===================
const spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientId,
  clientSecret: config.spotify.clientSecret,
  redirectUri: config.spotify.redirectUri
});

// Store Discord data in memory
let discordData = {};

// =================== DISCORD BOT SETUP ===================
// Create Discord client with required intents
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ]
});

// =================== ROUTES ===================

// Main Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Spotify Auth Routes ----
app.get('/login', (req, res) => {
  const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    // Store tokens in session
    req.session.spotifyTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (data.body.expires_in * 1000)
    };
    
    // Set tokens on spotifyApi instance
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    
    // Log the refresh token so it can be saved for future use
    console.log('Save this refresh token for future use:', refresh_token);
    
    // Redirect to dashboard after successful login
    res.redirect('/');
  } catch (err) {
    console.error('Error during authentication:', err);
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

// ---- API Endpoints ----

// Spotify current track endpoint
app.get('/api/spotify-current', async (req, res) => {
  // Use tokens from session if available
  const tokens = req.session.spotifyTokens;
  
  if (!tokens || !tokens.accessToken) {
    return res.status(401).json({ 
      isPlaying: false,
      error: 'Not authenticated with Spotify',
      authUrl: '/login'
    });
  }
  
  // Check if token needs refresh
  if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
    try {
      spotifyApi.setAccessToken(tokens.accessToken);
      spotifyApi.setRefreshToken(tokens.refreshToken);
      
      const data = await spotifyApi.refreshAccessToken();
      tokens.accessToken = data.body.access_token;
      tokens.expiresAt = Date.now() + (data.body.expires_in * 1000);
      
      spotifyApi.setAccessToken(tokens.accessToken);
      req.session.spotifyTokens = tokens;
    } catch (err) {
      return res.status(401).json({ 
        isPlaying: false,
        error: 'Failed to refresh token',
        authUrl: '/login'
      });
    }
  }
  
  try {
    spotifyApi.setAccessToken(tokens.accessToken);
    const data = await spotifyApi.getMyCurrentPlaybackState();
    
    if (data.body && data.body.is_playing) {
      const track = data.body.item;
      res.json({
        isPlaying: true,
        trackName: track.name,
        artistName: track.artists.map(artist => artist.name).join(', '),
        albumName: track.album.name,
        albumArt: track.album.images[0]?.url || null,
        duration: Math.floor(track.duration_ms / 1000),
        progress: Math.floor(data.body.progress_ms / 1000)
      });
    } else {
      res.json({ isPlaying: false });
    }
  } catch (err) {
    res.status(500).json({ 
      isPlaying: false,
      error: 'Failed to fetch Spotify data',
      details: err.message 
    });
  }
});

// Discord status endpoint
app.get('/api/discord-status', (req, res) => {
  console.log('Sending Discord data to client:', discordData);
  res.json(discordData);
});

// Endpoint to receive Discord data (internal use only)
app.post('/api/update-discord', (req, res) => {
  console.log('Received Discord update:', req.body);
  discordData = req.body;
  res.json({ success: true });
});

// Combined status endpoint
app.get('/api/status', (req, res) => {
  const tokens = req.session.spotifyTokens;
  
  res.json({
    spotifyAuthenticated: !!tokens?.accessToken,
    discordAuthenticated: !!discordData.username,
    loginUrl: '/login'
  });
});

// =================== DISCORD BOT FUNCTIONALITY ===================

// Check user status function
async function checkUserStatus() {
  try {
    // Get bot status
    const botUser = discordClient.user;
    console.log(`Bot connected as ${botUser.username}`);
    
    // Look for target user in all guilds
    for (const guild of discordClient.guilds.cache.values()) {
      try {
        console.log(`Checking guild: ${guild.name}`);
        
        // Try to fetch the member
        const member = await guild.members.fetch(DISCORD_USER_ID);
        
        if (member) {
          console.log(`Found user in guild ${guild.name}`);
          
          // Create a simple, consistent data structure
          const statusData = {
            username: "Fractal", // Hard-code your display name here
            id: "Frac.", // Replace with your actual Discord tag/ID
            status: member.presence ? member.presence.status : "offline",
            activity: null
          };
          
          // Get user avatar URL if available
          if (member.user) {
            statusData.avatarURL = member.user.displayAvatarURL({ 
              dynamic: true, 
              format: 'gif', 
              size: 128 
            });
            console.log("User avatar URL:", statusData.avatarURL);
          }
          
          // Check for activities
          if (member.presence && member.presence.activities && member.presence.activities.length > 0) {
            console.log("Found activities:", member.presence.activities.length);
            
            // Log all activities for debugging
            member.presence.activities.forEach(activity => {
              console.log("Activity:", {
                name: activity.name,
                type: activity.type,
                details: activity.details,
                state: activity.state,
                timestamps: activity.timestamps
              });
            });
            
            // Look for ANY activity, not just type 0
            const gameActivity = member.presence.activities.find(a => 
              a.name && a.name !== 'Custom Status' && a.name !== 'Spotify'
            );
            
            if (gameActivity) {
              console.log(`Found activity: ${gameActivity.name}, Type: ${gameActivity.type}`);
              
              // Calculate elapsed time if timestamps exist
              let elapsedTime = "Active now";
              if (gameActivity.timestamps && gameActivity.timestamps.start) {
                const startTime = new Date(gameActivity.timestamps.start);
                const now = new Date();
                const elapsedMinutes = Math.floor((now - startTime) / 60000);
                elapsedTime = `${elapsedMinutes} minutes`;
              }
              
              // Add the activity data to the status object
              statusData.activity = {
                name: gameActivity.name,
                type: gameActivity.type,
                elapsedTime: elapsedTime,
                details: gameActivity.details || null,
                state: gameActivity.state || null
              };
              
              // Try to get game icon
              if (gameActivity.assets && gameActivity.assets.largeImageURL) {
                try {
                  // If it's a function, call it to get the URL
                  if (typeof gameActivity.assets.largeImageURL === 'function') {
                    statusData.activity.icon = gameActivity.assets.largeImageURL();
                    console.log("Icon URL from function:", statusData.activity.icon);
                  } else {
                    // Otherwise use it directly
                    statusData.activity.icon = gameActivity.assets.largeImageURL;
                    console.log("Icon URL direct:", statusData.activity.icon);
                  }
                } catch (iconError) {
                  console.error("Error getting large image URL:", iconError);
                }
              } 
              // Fallback to large image
              else if (gameActivity.assets && gameActivity.assets.largeImage) {
                statusData.activity.icon = `https://cdn.discordapp.com/app-assets/${gameActivity.applicationId}/${gameActivity.assets.largeImage}.png`;
                console.log("Icon URL from largeImage:", statusData.activity.icon);
              }
              // Try small image as fallback
              else if (gameActivity.assets && gameActivity.assets.smallImageURL) {
                try {
                  if (typeof gameActivity.assets.smallImageURL === 'function') {
                    statusData.activity.icon = gameActivity.assets.smallImageURL();
                  } else {
                    statusData.activity.icon = gameActivity.assets.smallImageURL;
                  }
                } catch (iconError) {
                  console.error("Error getting small image URL:", iconError);
                }
              }
              else if (gameActivity.assets && gameActivity.assets.smallImage) {
                statusData.activity.icon = `https://cdn.discordapp.com/app-assets/${gameActivity.applicationId}/${gameActivity.assets.smallImage}.png`;
              }
            }
            
            // Log the final icon URL for debugging
            if (statusData.activity && statusData.activity.icon) {
              console.log("Final icon URL:", statusData.activity.icon);
            }
          }
          
          console.log("Sending status data:", statusData);
          
          // Update the internal discord data directly
          discordData = statusData;
          
          // Also send to server for API consistency
          try {
            await axios.post(`http://localhost:${PORT}/api/update-discord`, statusData, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            console.log("Status updated successfully");
            return; // Exit after successful update
          } catch (apiError) {
            console.error("Error sending to server:", apiError.message);
          }
        }
      } catch (memberError) {
        console.error(`Error with member in guild ${guild.name}:`, memberError.message);
      }
    }
    
    console.log("User not found in any guild");
    
    // Send offline status if user not found, but keep your name consistent
    const offlineData = {
      username: "Fractal", // Keep your name consistent
      id: "Frac.", // Your Discord tag
      status: "offline",
      activity: null
    };
    
    // Update the internal discord data directly
    discordData = offlineData;
    
    try {
      await axios.post(`http://localhost:${PORT}/api/update-discord`, offlineData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (offlineError) {
      console.error("Error sending offline status:", offlineError.message);
    }
    
  } catch (error) {
    console.error("Overall error in checkUserStatus:", error.message);
  }
}

// Discord bot event handlers
discordClient.once('ready', () => {
  console.log(`Discord bot logged in as ${discordClient.user.tag}`);
  
  // Initial status check
  checkUserStatus();
  
  // Check status every 30 seconds
  setInterval(checkUserStatus, 30000);
});

// =================== SERVER STARTUP ===================
// Start Express server
app.listen(PORT, () => {
  console.log(`Unified server running at http://127.0.0.1:${PORT}`);
  console.log(`Open http://127.0.0.1:${PORT}/ to access the dashboard`);
  console.log(`Visit http://127.0.0.1:${PORT}/login to authenticate with Spotify`);
  
  // Login to Discord
  discordClient.login(config.discord.token)
    .then(() => console.log('Discord bot connected'))
    .catch(error => console.error('Discord bot connection error:', error));
});