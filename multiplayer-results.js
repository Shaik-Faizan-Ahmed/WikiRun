let socket;
const BACKEND_URL = 'https://wikirun.onrender.com';

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const roomCode = urlParams.get('roomCode');

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

async function init() {
    socket = io(BACKEND_URL);
    
    socket.emit('getResults', { roomCode, username });
    
    socket.on('resultsData', (data) => {
        displayYourStats(data.yourStats);
        displayLeaderboard(data.leaderboard);
    });
}

function displayYourStats(stats) {
    if (!stats) {
        document.getElementById('yourClicks').textContent = 'DNF';
        document.getElementById('yourTime').textContent = 'DNF';
        document.getElementById('yourPosition').textContent = '-';
        return;
    }
    
    document.getElementById('yourClicks').textContent = stats.clicks;
    document.getElementById('yourTime').textContent = formatTime(stats.time);
    
    if (stats.position) {
        document.getElementById('yourPosition').textContent = getPositionSuffix(stats.position);
    } else {
        document.getElementById('yourPosition').textContent = 'DNF';
    }
    
    const pathDisplay = document.getElementById('yourPath');
    pathDisplay.innerHTML = '';
    
    if (stats.path && stats.path.length > 0) {
        stats.path.forEach((article, index) => {
            const item = document.createElement('div');
            item.className = 'path-item';
            
            const articleSpan = document.createElement('span');
            articleSpan.className = 'path-article';
            articleSpan.textContent = `${index + 1}. ${article}`;
            
            item.appendChild(articleSpan);
            
            if (index < stats.path.length - 1) {
                const arrow = document.createElement('span');
                arrow.className = 'path-arrow';
                arrow.textContent = '→';
                item.appendChild(arrow);
            }
            
            pathDisplay.appendChild(item);
        });
    }
}

function displayLeaderboard(leaderboard) {
    displayOverallLeaderboard(leaderboard);
    displayPodiumLeaderboard(leaderboard);
}

function displayOverallLeaderboard(leaderboard) {
    const list = document.getElementById('overallLeaderboard');
    list.innerHTML = '';
    
    if (!leaderboard || leaderboard.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.color = '#54595d';
        emptyMsg.textContent = 'No matches played yet';
        list.appendChild(emptyMsg);
        return;
    }
    
    const sorted = [...leaderboard].sort((a, b) => {
        const aTotal = (a.first || 0) + (a.second || 0) + (a.third || 0);
        const bTotal = (b.first || 0) + (b.second || 0) + (b.third || 0);
        if (bTotal !== aTotal) return bTotal - aTotal;
        return (b.first || 0) - (a.first || 0);
    });
    
    sorted.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        const rank = document.createElement('div');
        rank.className = 'leaderboard-rank';
        rank.textContent = `#${index + 1}`;
        
        const name = document.createElement('div');
        name.className = 'leaderboard-player';
        name.textContent = player.username;
        
        const stats = document.createElement('div');
        stats.className = 'leaderboard-stats';
        const total = (player.first || 0) + (player.second || 0) + (player.third || 0);
        stats.textContent = `${total} total win${total !== 1 ? 's' : ''}`;
        
        item.appendChild(rank);
        item.appendChild(name);
        item.appendChild(stats);
        list.appendChild(item);
    });
}

function displayPodiumLeaderboard(leaderboard) {
    const list = document.getElementById('podiumLeaderboard');
    list.innerHTML = '';
    
    if (!leaderboard || leaderboard.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.color = '#54595d';
        emptyMsg.textContent = 'No matches played yet';
        list.appendChild(emptyMsg);
        return;
    }
    
    const sorted = [...leaderboard].sort((a, b) => {
        if ((b.first || 0) !== (a.first || 0)) return (b.first || 0) - (a.first || 0);
        if ((b.second || 0) !== (a.second || 0)) return (b.second || 0) - (a.second || 0);
        return (b.third || 0) - (a.third || 0);
    });
    
    sorted.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        const rank = document.createElement('div');
        rank.className = 'leaderboard-rank';
        rank.textContent = `#${index + 1}`;
        
        const name = document.createElement('div');
        name.className = 'leaderboard-player';
        name.textContent = player.username;
        
        const stats = document.createElement('div');
        stats.className = 'podium-stats';
        
        const first = document.createElement('div');
        first.className = 'podium-stat';
        first.innerHTML = `<div class="podium-medal">🥇</div><div class="podium-count">${player.first || 0}</div>`;
        
        const second = document.createElement('div');
        second.className = 'podium-stat';
        second.innerHTML = `<div class="podium-medal">🥈</div><div class="podium-count">${player.second || 0}</div>`;
        
        const third = document.createElement('div');
        third.className = 'podium-stat';
        third.innerHTML = `<div class="podium-medal">🥉</div><div class="podium-count">${player.third || 0}</div>`;
        
        stats.appendChild(first);
        stats.appendChild(second);
        stats.appendChild(third);
        
        item.appendChild(rank);
        item.appendChild(name);
        item.appendChild(stats);
        list.appendChild(item);
    });
}

function getPositionSuffix(position) {
    if (!position) return '-';
    const j = position % 10;
    const k = position % 100;
    if (j === 1 && k !== 11) return position + 'st';
    if (j === 2 && k !== 12) return position + 'nd';
    if (j === 3 && k !== 13) return position + 'rd';
    return position + 'th';
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tab + 'Tab').classList.add('active');
    });
});

document.getElementById('backToLobbyBtn').addEventListener('click', () => {
    window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
});

document.getElementById('mainMenuBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

init();
