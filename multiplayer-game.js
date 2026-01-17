let socket;
let startTime;
let timerInterval;
let clicks = 0;
let currentArticle = '';
let targetArticle = '';
let path = [];
let pathTimes = [];
let gameActive = false;
let username = '';
let roomCode = '';
let difficulty = 'hard';
let usedHint = false;
let hasFinished = false;
let isHost = false;

const BACKEND_URL = 'http://localhost:3001';

const urlParams = new URLSearchParams(window.location.search);
username = urlParams.get('username') || 'Player';
roomCode = urlParams.get('roomCode') || '';
const startArticle = urlParams.get('start');
targetArticle = urlParams.get('target');
difficulty = urlParams.get('difficulty') || 'hard';
isHost = urlParams.get('isHost') === 'true';

async function init() {
    document.getElementById('targetTitle').textContent = targetArticle;
    
    const description = await fetchArticleDescription(targetArticle);
    document.getElementById('hintText').textContent = description;
    
    currentArticle = startArticle;
    path.push(startArticle);
    pathTimes.push(0);
    
    await loadArticle(startArticle);
    updatePath();
    startTimer();
    gameActive = true;
    
    if (isHost) {
        document.getElementById('hostControls').style.display = 'block';
    }
    
    connectWebSocket();
}

function connectWebSocket() {
    socket = io(BACKEND_URL);
    
    socket.emit('joinGameSession', { roomCode, username });
    
    socket.on('standingsUpdate', (data) => {
        updateStandings(data.standings);
    });
    
    socket.on('gameEnded', (data) => {
        if (!hasFinished) {
            endGame(true);
        }
    });
    
    socket.on('roundEnded', () => {
        console.log('🔴 ROUND ENDED EVENT RECEIVED');
        gameActive = false;
        stopTimer();
        socket.emit('leaveGameSession', { roomCode });
        alert('Host ended the round. Returning to lobby...');
        setTimeout(() => {
            window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
        }, 1000);
    });
}

async function fetchArticleDescription(title) {
    try {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: title,
            prop: 'extracts',
            exintro: true,
            explaintext: true,
            origin: '*'
        });
        
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
        const data = await response.json();
        const pages = data.query.pages;
        const page = pages[Object.keys(pages)[0]];
        
        if (page.extract) {
            const sentences = page.extract.split('. ');
            return sentences.slice(0, 2).join('. ') + '.';
        }
        return 'No description available.';
    } catch (error) {
        console.error('Failed to fetch description:', error);
        return 'Failed to load description.';
    }
}

function createArticleIframe(title) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.src = `${BACKEND_URL}/api/article/${encodeURIComponent(title)}`;
    return iframe;
}

async function loadArticle(title) {
    const content = document.getElementById('articleContent');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'block';
    content.innerHTML = '';
    
    const iframe = createArticleIframe(title);
    
    iframe.onload = () => {
        loading.style.display = 'none';
    };
    
    content.appendChild(iframe);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    const msStr = String(milliseconds).padStart(3, '0');
    const secStr = String(seconds).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');
    const hrStr = String(hours).padStart(2, '0');
    
    if (hours > 0) {
        return `${hrStr}:${minStr}:${secStr}.${msStr}`;
    } else if (minutes > 0) {
        return `${minStr}:${secStr}.${msStr}`;
    } else {
        return `${secStr}.${msStr}`;
    }
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        document.getElementById('timer').textContent = formatTime(elapsed);
    }, 10);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updatePath() {
    const pathList = document.getElementById('pathList');
    pathList.innerHTML = '';
    
    path.forEach((article, index) => {
        const item = document.createElement('div');
        item.className = 'path-item';
        
        const articleSpan = document.createElement('span');
        articleSpan.className = 'path-article';
        articleSpan.textContent = article;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'path-time';
        timeSpan.textContent = formatTime(pathTimes[index]);
        
        item.appendChild(articleSpan);
        item.appendChild(timeSpan);
        pathList.appendChild(item);
    });
}

function updateStandings(standings) {
    const list = document.getElementById('standingsList');
    list.innerHTML = '';
    
    if (!standings || standings.length === 0) {
        return;
    }
    
    standings.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'standing-item';
        
        const playerSpan = document.createElement('span');
        playerSpan.className = 'standing-player';
        playerSpan.textContent = `${index + 1}. ${player.username}`;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = 'standing-status';
        
        if (player.finished) {
            statusSpan.textContent = `Finished - ${player.clicks} clicks`;
            statusSpan.classList.add('finished');
        } else {
            statusSpan.textContent = `${player.clicks} clicks`;
        }
        
        item.appendChild(playerSpan);
        item.appendChild(statusSpan);
        list.appendChild(item);
    });
}

window.addEventListener('message', async (event) => {
    if (event.data.type === 'navigate') {
        if (!gameActive) return;
        
        const newTitle = event.data.title;
        clicks++;
        document.getElementById('clicks').textContent = clicks;
        
        currentArticle = newTitle;
        path.push(newTitle);
        pathTimes.push(Date.now() - startTime);
        updatePath();
        
        await loadArticle(newTitle);
        
        socket.emit('playerProgress', {
            roomCode,
            username,
            clicks,
            currentArticle: newTitle
        });
        
        if (newTitle.toLowerCase().replace(/_/g, ' ') === targetArticle.toLowerCase().replace(/_/g, ' ')) {
            finishGame();
        }
    }
});

async function finishGame() {
    if (!gameActive || hasFinished) return;
    
    gameActive = false;
    hasFinished = true;
    stopTimer();
    
    const finalTime = Date.now() - startTime;
    
    socket.emit('playerFinished', {
        roomCode,
        username,
        clicks,
        time: finalTime,
        path,
        usedHint
    });
    
    socket.emit('leaveGameSession', { roomCode });
    
    setTimeout(() => {
        window.location.href = `multiplayer-results.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
    }, 1000);
}

function endGame(forfeit = false) {
    gameActive = false;
    stopTimer();
    
    socket.emit('leaveGameSession', { roomCode });
    
    if (forfeit) {
        alert('Game has ended. Moving to results...');
    }
    
    setTimeout(() => {
        window.location.href = `multiplayer-results.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
    }, forfeit ? 2000 : 1000);
}

document.getElementById('hintBtn').addEventListener('click', () => {
    const content = document.getElementById('hintContent');
    const btn = document.getElementById('hintBtn');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '▲ Hide description';
        usedHint = true;
    } else {
        content.style.display = 'none';
        btn.textContent = '▼ Show description';
    }
});

document.getElementById('quitBtn').addEventListener('click', () => {
    document.getElementById('quitModal').classList.add('active');
});

document.getElementById('cancelQuit').addEventListener('click', () => {
    document.getElementById('quitModal').classList.remove('active');
});

document.getElementById('confirmQuit').addEventListener('click', () => {
    socket.emit('playerQuit', { roomCode, username });
    socket.emit('leaveGameSession', { roomCode });
    window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
});

document.getElementById('endRoundBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to end this round? All players will return to the lobby.')) {
        socket.emit('endRound', { roomCode, username });
        socket.emit('leaveGameSession', { roomCode });
        window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
    }
});

document.getElementById('toggleStandings').addEventListener('click', (e) => {
    e.stopPropagation();
    const standingsList = document.getElementById('standingsList');
    const toggleBtn = document.getElementById('toggleStandings');
    
    if (standingsList.style.display === 'none') {
        standingsList.style.display = 'flex';
        toggleBtn.classList.add('expanded');
    } else {
        standingsList.style.display = 'none';
        toggleBtn.classList.remove('expanded');
    }
});

document.getElementById('standingsHeader').addEventListener('click', () => {
    document.getElementById('toggleStandings').click();
});

init();
