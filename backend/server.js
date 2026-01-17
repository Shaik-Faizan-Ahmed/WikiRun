import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pkg from 'pg';
import { createServer } from 'http';
import { Server } from 'socket.io';
import validator from 'validator';
import rateLimit from 'express-rate-limit';
const { Pool } = pkg;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

app.use(cors({
    origin: process.env.FRONTEND_URL || "*"
}));
app.use(express.json());

const API_BASE = 'https://en.wikipedia.org/w/api.php';

// Rate limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per window per IP
    message: 'Too many requests from this IP, please try again later.'
});

const leaderboardLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 submissions per minute
    message: 'Too many leaderboard submissions, please slow down.'
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Validation helper functions
function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
        return null;
    }
    
    // Remove HTML tags
    const cleaned = validator.escape(username.trim());
    
    // Check length (1-20 characters)
    if (cleaned.length < 1 || cleaned.length > 20) {
        return null;
    }
    
    // Only allow alphanumeric, spaces, underscores, hyphens
    if (!/^[a-zA-Z0-9 _-]+$/.test(cleaned)) {
        return null;
    }
    
    return cleaned;
}

function sanitizeRoomCode(roomCode) {
    if (!roomCode || typeof roomCode !== 'string') {
        return null;
    }
    
    // Room codes should be 4 digits
    if (!/^\d{4}$/.test(roomCode)) {
        return null;
    }
    
    return roomCode;
}

function validateDifficulty(difficulty) {
    const validDifficulties = ['easy', 'medium', 'hard'];
    return validDifficulties.includes(difficulty) ? difficulty : null;
}

function sanitizePath(path) {
    if (!Array.isArray(path)) {
        return [];
    }
    
    // Limit path length to prevent abuse
    if (path.length > 1000) {
        return path.slice(0, 1000);
    }
    
    // Sanitize each article title
    return path.map(article => {
        if (typeof article !== 'string') return '';
        return validator.escape(article.substring(0, 500)); // Limit article title length
    });
}

const rooms = new Map();
const activeSessions = new Map();

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ username, difficulty }) => {
        const cleanUsername = sanitizeUsername(username);
        if (!cleanUsername) {
            socket.emit('roomError', { message: 'Invalid username. Use 1-20 alphanumeric characters only.' });
            return;
        }
        
        const validDifficulty = validateDifficulty(difficulty) || 'hard';
        const roomCode = generateRoomCode();
        
        rooms.set(roomCode, {
            code: roomCode,
            hostUsername: null,
            players: [],
            difficulty: validDifficulty,
            leaderboard: new Map(),
            matchHistory: []
        });

        socket.emit('roomCreated', { 
            roomCode, 
            difficulty: validDifficulty
        });
    });

    socket.on('joinRoom', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode) {
            socket.emit('roomError', { message: 'Invalid room code.' });
            return;
        }
        
        if (!cleanUsername) {
            socket.emit('roomError', { message: 'Invalid username. Use 1-20 alphanumeric characters only.' });
            return;
        }
        
        const room = rooms.get(cleanRoomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }
        
        const existingPlayer = room.players.find(p => p.username === cleanUsername);
        
        if (existingPlayer) {
            existingPlayer.id = socket.id;
        } else {
            if (room.players.length >= 6) {
                socket.emit('roomError', { message: 'Room is full' });
                return;
            }
            room.players.push({ id: socket.id, username: cleanUsername });
            
            if (room.players.length === 1) {
                room.hostUsername = cleanUsername;
            }
        }
        
        socket.join(cleanRoomCode);
        
        socket.emit('joinedRoom', { 
            roomCode: cleanRoomCode, 
            players: room.players,
            difficulty: room.difficulty
        });
        socket.to(cleanRoomCode).emit('playerJoined', { players: room.players });
    });

    socket.on('leaveRoom', ({ roomCode }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        if (!cleanRoomCode) return;
        
        const room = rooms.get(cleanRoomCode);
        if (!room) return;

        const leavingPlayer = room.players.find(p => p.id === socket.id);
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(cleanRoomCode);

        if (room.players.length === 0) {
            rooms.delete(cleanRoomCode);
            activeSessions.delete(cleanRoomCode);
            console.log(`Room ${cleanRoomCode} deleted - no players remaining`);
        } else {
            if (leavingPlayer && room.hostUsername === leavingPlayer.username) {
                room.hostUsername = room.players[0].username;
            }
            io.to(cleanRoomCode).emit('playerLeft', { players: room.players });
        }
    });

    socket.on('changeDifficulty', ({ roomCode, difficulty }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const validDifficulty = validateDifficulty(difficulty);
        
        if (!cleanRoomCode || !validDifficulty) return;
        
        const room = rooms.get(cleanRoomCode);
        const player = room?.players.find(p => p.id === socket.id);
        if (!room || !player || room.hostUsername !== player.username) return;

        room.difficulty = validDifficulty;
        io.to(cleanRoomCode).emit('difficultyChanged', { difficulty: validDifficulty });
    });

    socket.on('startGame', async ({ roomCode }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        if (!cleanRoomCode) return;
        
        const room = rooms.get(cleanRoomCode);
        const player = room?.players.find(p => p.id === socket.id);
        if (!room || !player || room.hostUsername !== player.username) return;

        const difficulty = room.difficulty;
        const start = await fetchRandomArticle(difficulty);
        const target = await fetchRandomArticle(difficulty);

        const session = {
            roomCode: cleanRoomCode,
            start,
            target,
            difficulty,
            players: room.players.map(p => ({
                ...p,
                clicks: 0,
                time: 0,
                path: [],
                finished: false,
                position: null
            })),
            finishedCount: 0,
            startTime: Date.now()
        };

        activeSessions.set(cleanRoomCode, session);

        io.to(cleanRoomCode).emit('gameStarting', { start, target, difficulty });
    });

    socket.on('endRound', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        console.log('🟢 SERVER: endRound event received for room:', cleanRoomCode, 'from username:', cleanUsername);
        const room = rooms.get(cleanRoomCode);
        const session = activeSessions.get(cleanRoomCode);
        const player = room?.players.find(p => p.username === cleanUsername);
        
        console.log('🟢 SERVER: room exists:', !!room);
        console.log('🟢 SERVER: session exists:', !!session);
        console.log('🟢 SERVER: player exists:', !!player);
        console.log('🟢 SERVER: is host:', player && room && room.hostUsername === player.username);
        
        if (!room || !session || !player || room.hostUsername !== player.username) {
            console.log('🔴 SERVER: endRound blocked - failed validation');
            return;
        }

        recordMatchResults(cleanRoomCode, session);
        
        console.log('🟢 SERVER: About to emit roundEnded to game-' + cleanRoomCode);
        io.to(`game-${cleanRoomCode}`).emit('roundEnded', {});
        console.log('🟢 SERVER: roundEnded event emitted');
    });

    socket.on('joinGameSession', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        console.log(`🔵 SERVER: ${cleanUsername} joining game session: game-${cleanRoomCode}`);
        socket.join(`game-${cleanRoomCode}`);
        console.log(`🔵 SERVER: ${cleanUsername} successfully joined game-${cleanRoomCode}`);
        
        const session = activeSessions.get(cleanRoomCode);
        if (session) {
            const standings = session.players
                .map(p => ({
                    username: p.username,
                    clicks: p.clicks,
                    finished: p.finished
                }))
                .sort((a, b) => {
                    if (a.finished && !b.finished) return -1;
                    if (!a.finished && b.finished) return 1;
                    if (a.finished && b.finished) return 0;
                    return a.clicks - b.clicks;
                });
            
            socket.emit('standingsUpdate', { standings });
        }
    });

    socket.on('leaveGameSession', ({ roomCode }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        if (!cleanRoomCode) return;
        
        console.log(`🔴 SERVER: Player leaving game session: game-${cleanRoomCode}`);
        socket.leave(`game-${cleanRoomCode}`);
    });

    socket.on('playerProgress', ({ roomCode, username, clicks, currentArticle }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        const session = activeSessions.get(cleanRoomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === cleanUsername);
        if (player && !player.finished) {
            // Validate clicks is a reasonable number
            const validClicks = typeof clicks === 'number' && clicks >= 0 && clicks <= 10000 ? clicks : player.clicks;
            player.clicks = validClicks;
            
            // Sanitize current article
            if (currentArticle && typeof currentArticle === 'string') {
                player.currentArticle = validator.escape(currentArticle.substring(0, 500));
            }
        }

        const standings = session.players
            .map(p => ({
                username: p.username,
                clicks: p.clicks,
                finished: p.finished
            }))
            .sort((a, b) => {
                if (a.finished && !b.finished) return -1;
                if (!a.finished && b.finished) return 1;
                if (a.finished && b.finished) return 0;
                return a.clicks - b.clicks;
            });

        io.to(`game-${cleanRoomCode}`).emit('standingsUpdate', { standings });
    });

    socket.on('playerFinished', async ({ roomCode, username, clicks, time, path, usedHint }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        const session = activeSessions.get(cleanRoomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === cleanUsername);
        if (!player || player.finished) return;

        player.finished = true;
        
        // Validate numeric inputs
        player.clicks = typeof clicks === 'number' && clicks >= 0 && clicks <= 10000 ? clicks : 0;
        player.time = typeof time === 'number' && time >= 0 && time <= 86400000 ? time : 0; // Max 24 hours
        player.path = sanitizePath(path);
        player.usedHint = Boolean(usedHint);
        session.finishedCount++;

        const finishedPlayers = session.players.filter(p => p.finished)
            .sort((a, b) => a.clicks !== b.clicks ? a.clicks - b.clicks : a.time - b.time);
        
        finishedPlayers.forEach((p, idx) => {
            p.position = idx + 1;
        });

        const standings = session.players
            .map(p => ({
                username: p.username,
                clicks: p.clicks,
                finished: p.finished
            }))
            .sort((a, b) => {
                if (a.finished && !b.finished) return -1;
                if (!a.finished && b.finished) return 1;
                if (a.finished && b.finished) return 0;
                return a.clicks - b.clicks;
            });

        io.to(`game-${cleanRoomCode}`).emit('standingsUpdate', { standings });

        const totalPlayers = session.players.length;
        let gameEnded = false;

        if (totalPlayers === 2 && session.finishedCount >= 1) {
            gameEnded = true;
        } else if (totalPlayers === 3 && session.finishedCount >= 2) {
            gameEnded = true;
        } else if (totalPlayers >= 4 && totalPlayers <= 6 && session.finishedCount >= 3) {
            gameEnded = true;
        }

        if (gameEnded) {
            await recordMatchResults(cleanRoomCode, session);
            io.to(`game-${cleanRoomCode}`).emit('gameEnded', {});
        }
    });

    socket.on('playerQuit', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        const session = activeSessions.get(cleanRoomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === cleanUsername);
        if (player) {
            player.finished = true;
            player.position = null;
        }
    });

    socket.on('getResults', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) {
            socket.emit('resultsData', { yourStats: null, leaderboard: [] });
            return;
        }
        
        const room = rooms.get(cleanRoomCode);
        const session = activeSessions.get(cleanRoomCode);
        
        if (!room || !session) {
            socket.emit('resultsData', { yourStats: null, leaderboard: [] });
            return;
        }

        const player = session.players.find(p => p.username === cleanUsername);
        
        const yourStats = player ? {
            clicks: player.clicks,
            time: player.time,
            path: player.path,
            position: player.position
        } : null;

        const leaderboard = Array.from(room.leaderboard.values());
        
        socket.emit('resultsData', { yourStats, leaderboard });
    });

    socket.on('rejoinRoom', ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) {
            socket.emit('roomError', { message: 'Invalid room code or username.' });
            return;
        }
        
        const room = rooms.get(cleanRoomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }
        
        const existingPlayer = room.players.find(p => p.username === cleanUsername);
        
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            socket.join(cleanRoomCode);
            
            socket.emit('rejoinedRoom', { 
                roomCode: cleanRoomCode, 
                players: room.players,
                difficulty: room.difficulty,
                isHost: room.hostUsername === cleanUsername
            });
        } else {
            socket.emit('roomError', { message: 'Player not found in room' });
        }
    });

    socket.on('getRoomLeaderboard', ({ roomCode }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        
        if (!cleanRoomCode) {
            socket.emit('roomError', { message: 'Invalid room code.' });
            return;
        }
        
        const room = rooms.get(cleanRoomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }

        const leaderboard = Array.from(room.leaderboard.values());
        const matches = room.matchHistory.map(match => ({
            timestamp: match.timestamp,
            target: match.target,
            difficulty: match.difficulty,
            playerCount: match.playerCount,
            abandoned: match.abandoned,
            results: match.results.sort((a, b) => a.position - b.position)
        }));
        
        socket.emit('roomLeaderboard', {
            difficulty: room.difficulty,
            leaderboard,
            matches
        });
    });

    socket.on('playAgain', async ({ roomCode, username }) => {
        const cleanRoomCode = sanitizeRoomCode(roomCode);
        const cleanUsername = sanitizeUsername(username);
        
        if (!cleanRoomCode || !cleanUsername) return;
        
        const room = rooms.get(cleanRoomCode);
        if (!room) return;

        const player = room.players.find(p => p.username === cleanUsername);
        if (!player || room.hostUsername !== cleanUsername) return;

        const difficulty = room.difficulty;
        const start = await fetchRandomArticle(difficulty);
        const target = await fetchRandomArticle(difficulty);

        const session = {
            roomCode: cleanRoomCode,
            start,
            target,
            difficulty,
            players: room.players.map(p => ({
                ...p,
                clicks: 0,
                time: 0,
                path: [],
                finished: false,
                position: null
            })),
            finishedCount: 0,
            startTime: Date.now()
        };

        activeSessions.set(cleanRoomCode, session);

        io.to(cleanRoomCode).emit('gameStarting', { start, target, difficulty });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

async function recordMatchResults(roomCode, session) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const totalPlayers = session.players.length;
    const finishedPlayers = session.players.filter(p => p.finished && p.position);
    
    let countPositions = 1;
    if (totalPlayers === 3) countPositions = 2;
    else if (totalPlayers >= 4) countPositions = 3;
    
    finishedPlayers.forEach(player => {
        if (player.position > countPositions) return;
        
        if (!room.leaderboard.has(player.username)) {
            room.leaderboard.set(player.username, {
                username: player.username,
                first: 0,
                second: 0,
                third: 0,
                totalMatches: 0
            });
        }

        const stats = room.leaderboard.get(player.username);
        stats.totalMatches++;
        
        if (player.position === 1) stats.first++;
        else if (player.position === 2 && countPositions >= 2) stats.second++;
        else if (player.position === 3 && countPositions >= 3) stats.third++;
    });

    room.matchHistory.push({
        timestamp: Date.now(),
        playerCount: session.players.length,
        target: session.target,
        difficulty: session.difficulty,
        abandoned: finishedPlayers.length === 0,
        results: finishedPlayers.map(p => ({
            username: p.username,
            position: p.position,
            clicks: p.clicks,
            time: p.time
        }))
    });
}

async function fetchRandomArticle(difficulty) {
    if (difficulty === 'hard') {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            list: 'random',
            rnnamespace: 0,
            rnlimit: 1
        });
        
        const response = await fetch(`${API_BASE}?${params}`);
        const data = await response.json();
        return data.query.random[0].title;
    }

    const result = await pool.query(
        'SELECT title FROM articles WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 1',
        [difficulty]
    );

    return result.rows[0]?.title || 'Wikipedia';
}

app.get('/api/random/:difficulty', async (req, res) => {
    try {
        const difficulty = validateDifficulty(req.params.difficulty);
        if (!difficulty) {
            return res.status(400).json({ error: 'Invalid difficulty. Must be easy, medium, or hard.' });
        }
        
        const title = await fetchRandomArticle(difficulty);
        res.json({ title });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/article/:title', async (req, res) => {
    try {
        let title = decodeURIComponent(req.params.title);
        
        // Sanitize title - limit length and remove dangerous characters
        if (title.length > 500) {
            return res.status(400).json({ error: 'Article title too long' });
        }
        
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        
        const response = await fetch(wikiUrl, {
            headers: {
                'User-Agent': 'WikiRun/1.0'
            }
        });
        const html = await response.text();
        
        const $ = cheerio.load(html);
        
        $('head').prepend('<base href="https://en.wikipedia.org/">');
        
        $('#mw-panel').remove();
        $('.vector-column-start').remove();
        $('.vector-column-end').remove();
        $('#vector-toc-pinned-container').remove();
        $('.vector-page-toolbar').remove();
        $('#p-lang').remove();
        $('#footer').remove();
        $('#mw-navigation').remove();
        $('.mw-jump-link').remove();
        $('#siteNotice').remove();
        $('#centralNotice').remove();
        $('.vector-header').remove();
        $('#vector-user-links-dropdown').remove();
        $('.vector-search-box').remove();
        
        $('.mw-page-container').css({
            'margin-left': '0',
            'margin-right': '0',
            'padding-left': '0',
            'padding-right': '0'
        });
        
        $('.mw-page-container-inner').css({
            'grid-template-columns': '0 minmax(0, 1fr) 0',
            'margin-left': '0',
            'margin-right': '0'
        });
        
        $('.mw-content-container').css({
            'max-width': '100%',
            'margin': '0'
        });
        
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.startsWith('/wiki/') && !href.includes(':') && !href.includes('#')) {
                $(elem).attr('data-wiki-link', href.replace('/wiki/', ''));
                $(elem).attr('onclick', 'return false;');
            } else if (href && (href.startsWith('/') || href.startsWith('#'))) {
                $(elem).attr('onclick', 'return false;');
            }
        });
        
        $('body').append(`
            <script>
                document.addEventListener('click', function(e) {
                    const link = e.target.closest('a[data-wiki-link]');
                    if (link) {
                        e.preventDefault();
                        const title = link.getAttribute('data-wiki-link');
                        window.parent.postMessage({ type: 'navigate', title: decodeURIComponent(title) }, '*');
                        return false;
                    }
                    
                    const otherLink = e.target.closest('a');
                    if (otherLink) {
                        e.preventDefault();
                        return false;
                    }
                });
            </script>
        `);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send($.html());
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leaderboard', leaderboardLimiter, async (req, res) => {
    try {
        const { nickname, difficulty, clicks, time, path, usedHint } = req.body;

        // Validate inputs
        const cleanNickname = sanitizeUsername(nickname);
        if (!cleanNickname) {
            return res.status(400).json({ error: 'Invalid nickname. Use 1-20 alphanumeric characters only.' });
        }
        
        const validDifficulty = validateDifficulty(difficulty);
        if (!validDifficulty) {
            return res.status(400).json({ error: 'Invalid difficulty. Must be easy, medium, or hard.' });
        }
        
        const validClicks = typeof clicks === 'number' && clicks >= 0 && clicks <= 10000 ? clicks : 0;
        const validTime = typeof time === 'number' && time >= 0 && time <= 86400000 ? time : 0;
        const cleanPath = sanitizePath(path);

        const result = await pool.query(
            'INSERT INTO leaderboard (nickname, difficulty, clicks, time, path, used_hint) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [cleanNickname, validDifficulty, validClicks, validTime, JSON.stringify(cleanPath), Boolean(usedHint)]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leaderboard/:difficulty', async (req, res) => {
    try {
        const difficulty = validateDifficulty(req.params.difficulty);
        if (!difficulty) {
            return res.status(400).json({ error: 'Invalid difficulty. Must be easy, medium, or hard.' });
        }
        
        const { sortBy = 'clicks' } = req.query;
        const validSortBy = ['clicks', 'time'].includes(sortBy) ? sortBy : 'clicks';
        const orderBy = validSortBy === 'time' ? 'time ASC, clicks ASC' : 'clicks ASC, time ASC';

        const result = await pool.query(
            `SELECT nickname, clicks, time, path, used_hint, created_at 
             FROM leaderboard 
             WHERE difficulty = $1 
             ORDER BY ${orderBy} 
             LIMIT 10`,
            [difficulty]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

httpServer.listen(PORT, () => {
    console.log(`WikiRun backend running on http://localhost:${PORT}`);
});
