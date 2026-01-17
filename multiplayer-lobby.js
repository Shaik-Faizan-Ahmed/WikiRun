let socket;
let username = '';
let roomCode = '';
let currentDifficulty = 'hard';

const BACKEND_URL = 'https://wikirun.onrender.com';

const screens = {
    menu: document.getElementById('menuScreen'),
    createSetup: document.getElementById('createSetupScreen'),
    joinSetup: document.getElementById('joinSetupScreen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function connectWebSocket() {
    if (socket && socket.connected) {
        return socket;
    }
    
    socket = io(BACKEND_URL, {
        transports: ['websocket'],
        upgrade: false
    });

    socket.on('connect', () => {
        console.log('WebSocket connected');
    });

    socket.on('roomCreated', (data) => {
        console.log('Room created:', data);
        roomCode = data.roomCode;
        
        setTimeout(() => {
            window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}&creator=true`;
        }, 100);
    });

    socket.on('joinedRoom', (data) => {
        console.log('Joined room:', data);
        roomCode = data.roomCode;
        window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}&joiner=true`;
    });

    socket.on('roomError', (data) => {
        alert(data.message);
    });
    
    return socket;
}

document.getElementById('createRoomBtn').addEventListener('click', () => {
    console.log('Create room button clicked');
    showScreen('createSetup');
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    console.log('Join room button clicked');
    showScreen('joinSetup');
});

document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('confirmCreate').addEventListener('click', () => {
    const usernameInput = document.getElementById('createUsername').value.trim();
    const difficulty = document.getElementById('createDifficulty').value;
    
    console.log('Confirm create clicked:', usernameInput, difficulty);
    
    if (usernameInput.length < 2) {
        alert('Username must be at least 2 characters');
        return;
    }
    
    username = usernameInput;
    currentDifficulty = difficulty;
    
    const ws = connectWebSocket();
    
    if (ws.connected) {
        console.log('Emitting createRoom');
        ws.emit('createRoom', { username, difficulty });
    } else {
        ws.on('connect', () => {
            console.log('Connected, now emitting createRoom');
            ws.emit('createRoom', { username, difficulty });
        });
    }
});

document.getElementById('cancelCreate').addEventListener('click', () => {
    document.getElementById('createUsername').value = '';
    showScreen('menu');
});

document.getElementById('confirmJoin').addEventListener('click', () => {
    const usernameInput = document.getElementById('joinUsername').value.trim();
    const code = document.getElementById('roomCodeInput').value.trim();
    
    if (usernameInput.length < 2) {
        alert('Username must be at least 2 characters');
        return;
    }
    
    if (code.length !== 4) {
        alert('Room code must be 4 digits');
        return;
    }
    
    username = usernameInput;
    
    const ws = connectWebSocket();
    
    if (ws.connected) {
        ws.emit('joinRoom', { roomCode: code, username });
    } else {
        ws.on('connect', () => {
            ws.emit('joinRoom', { roomCode: code, username });
        });
    }
});

document.getElementById('cancelJoin').addEventListener('click', () => {
    document.getElementById('joinUsername').value = '';
    document.getElementById('roomCodeInput').value = '';
    showScreen('menu');
});
