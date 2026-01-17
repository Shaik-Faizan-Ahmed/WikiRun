let socket;
let username = '';
let roomCode = '';
let isHost = false;
let currentDifficulty = 'hard';

const BACKEND_URL = 'https://wikirun.onrender.com';

const urlParams = new URLSearchParams(window.location.search);
roomCode = urlParams.get('roomCode');
username = urlParams.get('username');
const isCreator = urlParams.get('creator') === 'true';
const isJoiner = urlParams.get('joiner') === 'true';

if (!roomCode || !username) {
    window.location.href = 'multiplayer-lobby.html';
}

document.getElementById('roomCodeDisplay').textContent = roomCode;

function connectWebSocket() {
    if (socket && socket.connected) {
        return;
    }
    
    socket = io(BACKEND_URL, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionAttempts: 3
    });

    socket.on('connect', () => {
        console.log('WebSocket connected, isCreator:', isCreator, 'isJoiner:', isJoiner);
        
        setTimeout(() => {
            if (isCreator || isJoiner) {
                console.log('Emitting joinRoom');
                socket.emit('joinRoom', { roomCode, username });
            } else {
                console.log('Emitting rejoinRoom');
                socket.emit('rejoinRoom', { roomCode, username });
            }
        }, 200);
    });

    socket.on('roomCreated', (data) => {
        console.log('Room created:', data);
        isHost = true;
        currentDifficulty = data.difficulty;
        updatePlayersList(data.players);
        updateDifficultyDisplay();
    });

    socket.on('joinedRoom', (data) => {
        console.log('Joined room:', data);
        if (data.players[0].username === username) {
            isHost = true;
        }
        currentDifficulty = data.difficulty;
        updatePlayersList(data.players);
        updateDifficultyDisplay();
    });

    socket.on('rejoinedRoom', (data) => {
        console.log('Rejoined room:', data);
        isHost = data.isHost;
        currentDifficulty = data.difficulty;
        updatePlayersList(data.players);
        updateDifficultyDisplay();
    });

    socket.on('roomError', (data) => {
        alert(data.message);
        window.location.href = 'multiplayer-lobby.html';
    });

    socket.on('playerJoined', (data) => {
        updatePlayersList(data.players);
    });

    socket.on('playerLeft', (data) => {
        updatePlayersList(data.players);
    });

    socket.on('difficultyChanged', (data) => {
        currentDifficulty = data.difficulty;
        updateDifficultyDisplay();
    });

    socket.on('gameStarting', (data) => {
        window.location.href = `multiplayer-game.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}&start=${encodeURIComponent(data.start)}&target=${encodeURIComponent(data.target)}&difficulty=${data.difficulty}&isHost=${isHost}`;
    });
}

document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    socket.emit('leaveRoom', { roomCode });
    window.location.href = 'multiplayer-lobby.html';
});

document.getElementById('startGameBtn').addEventListener('click', () => {
    socket.emit('startGame', { roomCode });
});

document.getElementById('viewLeaderboardBtn').addEventListener('click', () => {
    window.location.href = `multiplayer-leaderboard.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
});

document.getElementById('roomDifficulty').addEventListener('change', (e) => {
    const newDifficulty = e.target.value;
    socket.emit('changeDifficulty', { roomCode, difficulty: newDifficulty });
});

function updatePlayersList(players) {
    const list = document.getElementById('playersList');
    const count = document.getElementById('playerCount');
    
    count.textContent = players.length;
    
    list.innerHTML = '';
    players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'player-item';
        
        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = player.username;
        
        item.appendChild(name);
        
        if (index === 0) {
            const badge = document.createElement('span');
            badge.className = 'player-badge';
            badge.textContent = 'HOST';
            item.appendChild(badge);
        }
        
        list.appendChild(item);
    });
    
    if (isHost) {
        document.getElementById('startGameBtn').style.display = players.length >= 2 ? 'block' : 'none';
        document.getElementById('difficultyControl').style.display = 'block';
        document.getElementById('difficultyDisplay').style.display = 'none';
    } else {
        document.getElementById('difficultyControl').style.display = 'none';
        document.getElementById('difficultyDisplay').style.display = 'block';
    }
}

function updateDifficultyDisplay() {
    const capitalizedDifficulty = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
    document.getElementById('currentDifficulty').textContent = capitalizedDifficulty;
    document.getElementById('roomDifficulty').value = currentDifficulty;
}

connectWebSocket();
