import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pkg from 'pg';
import { createServer } from 'http';
import { Server } from 'socket.io';
const { Pool } = pkg;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3001;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'wikirun',
    password: 'postgres',
    port: 5432,
});

app.use(cors());
app.use(express.json());

const API_BASE = 'https://en.wikipedia.org/w/api.php';

const rooms = new Map();
const activeSessions = new Map();

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ username, difficulty }) => {
        const roomCode = generateRoomCode();
        
        rooms.set(roomCode, {
            code: roomCode,
            hostUsername: null,
            players: [],
            difficulty: difficulty || 'hard',
            leaderboard: new Map(),
            matchHistory: []
        });

        socket.emit('roomCreated', { 
            roomCode, 
            difficulty: difficulty || 'hard'
        });
    });

    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }
        
        const existingPlayer = room.players.find(p => p.username === username);
        
        if (existingPlayer) {
            existingPlayer.id = socket.id;
        } else {
            if (room.players.length >= 6) {
                socket.emit('roomError', { message: 'Room is full' });
                return;
            }
            room.players.push({ id: socket.id, username });
            
            if (room.players.length === 1) {
                room.hostUsername = username;
            }
        }
        
        socket.join(roomCode);
        
        socket.emit('joinedRoom', { 
            roomCode, 
            players: room.players,
            difficulty: room.difficulty
        });
        socket.to(roomCode).emit('playerJoined', { players: room.players });
    });

    socket.on('leaveRoom', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const leavingPlayer = room.players.find(p => p.id === socket.id);
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(roomCode);

        if (room.players.length === 0) {
            rooms.delete(roomCode);
            activeSessions.delete(roomCode);
            console.log(`Room ${roomCode} deleted - no players remaining`);
        } else {
            if (leavingPlayer && room.hostUsername === leavingPlayer.username) {
                room.hostUsername = room.players[0].username;
            }
            io.to(roomCode).emit('playerLeft', { players: room.players });
        }
    });

    socket.on('changeDifficulty', ({ roomCode, difficulty }) => {
        const room = rooms.get(roomCode);
        const player = room?.players.find(p => p.id === socket.id);
        if (!room || !player || room.hostUsername !== player.username) return;

        room.difficulty = difficulty;
        io.to(roomCode).emit('difficultyChanged', { difficulty });
    });

    socket.on('startGame', async ({ roomCode }) => {
        const room = rooms.get(roomCode);
        const player = room?.players.find(p => p.id === socket.id);
        if (!room || !player || room.hostUsername !== player.username) return;

        const difficulty = room.difficulty;
        const start = await fetchRandomArticle(difficulty);
        const target = await fetchRandomArticle(difficulty);

        const session = {
            roomCode,
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

        activeSessions.set(roomCode, session);

        io.to(roomCode).emit('gameStarting', { start, target, difficulty });
    });

    socket.on('endRound', ({ roomCode, username }) => {
        console.log('🟢 SERVER: endRound event received for room:', roomCode, 'from username:', username);
        const room = rooms.get(roomCode);
        const session = activeSessions.get(roomCode);
        const player = room?.players.find(p => p.username === username);
        
        console.log('🟢 SERVER: room exists:', !!room);
        console.log('🟢 SERVER: session exists:', !!session);
        console.log('🟢 SERVER: player exists:', !!player);
        console.log('🟢 SERVER: is host:', player && room && room.hostUsername === player.username);
        
        if (!room || !session || !player || room.hostUsername !== player.username) {
            console.log('🔴 SERVER: endRound blocked - failed validation');
            return;
        }

        recordMatchResults(roomCode, session);
        
        console.log('🟢 SERVER: About to emit roundEnded to game-' + roomCode);
        // Emit to the game session room where all players are
        io.to(`game-${roomCode}`).emit('roundEnded', {});
        console.log('🟢 SERVER: roundEnded event emitted');
    });

    socket.on('joinGameSession', ({ roomCode, username }) => {
        console.log(`🔵 SERVER: ${username} joining game session: game-${roomCode}`);
        socket.join(`game-${roomCode}`);
        console.log(`🔵 SERVER: ${username} successfully joined game-${roomCode}`);
        
        const session = activeSessions.get(roomCode);
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

    socket.on('playerProgress', ({ roomCode, username, clicks, currentArticle }) => {
        const session = activeSessions.get(roomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === username);
        if (player && !player.finished) {
            player.clicks = clicks;
            player.currentArticle = currentArticle;
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

        io.to(`game-${roomCode}`).emit('standingsUpdate', { standings });
    });

    socket.on('playerFinished', async ({ roomCode, username, clicks, time, path, usedHint }) => {
        const session = activeSessions.get(roomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === username);
        if (!player || player.finished) return;

        player.finished = true;
        player.clicks = clicks;
        player.time = time;
        player.path = path;
        player.usedHint = usedHint;
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

        io.to(`game-${roomCode}`).emit('standingsUpdate', { standings });

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
            await recordMatchResults(roomCode, session);
            io.to(`game-${roomCode}`).emit('gameEnded', {});
        }
    });

    socket.on('playerQuit', ({ roomCode, username }) => {
        const session = activeSessions.get(roomCode);
        if (!session) return;

        const player = session.players.find(p => p.username === username);
        if (player) {
            player.finished = true;
            player.position = null;
        }
    });

    socket.on('getResults', ({ roomCode, username }) => {
        const room = rooms.get(roomCode);
        const session = activeSessions.get(roomCode);
        
        if (!room || !session) {
            socket.emit('resultsData', { yourStats: null, leaderboard: [] });
            return;
        }

        const player = session.players.find(p => p.username === username);
        
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
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }
        
        const existingPlayer = room.players.find(p => p.username === username);
        
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            socket.join(roomCode);
            
            socket.emit('rejoinedRoom', { 
                roomCode, 
                players: room.players,
                difficulty: room.difficulty,
                isHost: room.hostUsername === username
            });
        } else {
            socket.emit('roomError', { message: 'Player not found in room' });
        }
    });

    socket.on('getRoomLeaderboard', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }

        const leaderboard = Array.from(room.leaderboard.values());
        const matches = room.matchHistory.map(match => ({
            timestamp: match.timestamp,
            target: match.results[0]?.target || 'Unknown',
            results: match.results.sort((a, b) => a.position - b.position)
        }));
        
        socket.emit('roomLeaderboard', {
            difficulty: room.difficulty,
            leaderboard,
            matches
        });
    });

    socket.on('playAgain', async ({ roomCode, username }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.username === username);
        if (!player || room.hostUsername !== username) return;

        const difficulty = room.difficulty;
        const start = await fetchRandomArticle(difficulty);
        const target = await fetchRandomArticle(difficulty);

        const session = {
            roomCode,
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

        activeSessions.set(roomCode, session);

        io.to(roomCode).emit('gameStarting', { start, target, difficulty });
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
        playerCount: totalPlayers,
        target: session.target,
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
        const { difficulty } = req.params;
        const title = await fetchRandomArticle(difficulty);
        res.json({ title });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/article/:title', async (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
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

app.post('/api/leaderboard', async (req, res) => {
    try {
        const { nickname, difficulty, clicks, time, path, usedHint } = req.body;

        const result = await pool.query(
            'INSERT INTO leaderboard (nickname, difficulty, clicks, time, path, used_hint) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [nickname, difficulty, clicks, time, JSON.stringify(path), usedHint || false]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leaderboard/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;
        const { sortBy = 'clicks' } = req.query;

        const orderBy = sortBy === 'time' ? 'time ASC, clicks ASC' : 'clicks ASC, time ASC';

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
