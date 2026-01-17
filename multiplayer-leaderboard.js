let socket;
const BACKEND_URL = 'http://localhost:3001';

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('roomCode');
const username = urlParams.get('username');

if (!roomCode) {
    window.location.href = 'multiplayer-lobby.html';
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

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function getPositionSuffix(position) {
    const j = position % 10;
    const k = position % 100;
    if (j === 1 && k !== 11) return position + 'st';
    if (j === 2 && k !== 12) return position + 'nd';
    if (j === 3 && k !== 13) return position + 'rd';
    return position + 'th';
}

async function init() {
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    
    socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
        socket.emit('getRoomLeaderboard', { roomCode });
    });
    
    socket.on('roomLeaderboard', (data) => {
        if (data.difficulty) {
            const difficultyBadge = document.getElementById('difficultyBadge');
            difficultyBadge.textContent = data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1);
        }
        
        displayOverallLeaderboard(data.leaderboard);
        displayPodiumLeaderboard(data.leaderboard);
        displayMatchHistory(data.matches);
    });
    
    socket.on('roomError', (data) => {
        alert(data.message);
        window.location.href = 'multiplayer-lobby.html';
    });
}

function displayOverallLeaderboard(leaderboard) {
    const list = document.getElementById('overallLeaderboard');
    list.innerHTML = '';
    
    if (!leaderboard || leaderboard.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'loading';
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
        emptyMsg.className = 'loading';
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

function displayMatchHistory(matches) {
    const list = document.getElementById('matchHistory');
    list.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'loading';
        emptyMsg.textContent = 'No match history yet';
        list.appendChild(emptyMsg);
        return;
    }
    
    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'match-item';
        
        const header = document.createElement('div');
        header.className = 'match-header';
        
        const date = document.createElement('div');
        date.className = 'match-date';
        date.textContent = formatDate(match.timestamp);
        
        const target = document.createElement('div');
        target.className = 'match-target';
        target.textContent = `Target: ${match.target}`;
        
        header.appendChild(date);
        header.appendChild(target);
        
        const results = document.createElement('div');
        results.className = 'match-results';
        
        match.results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'match-result-item';
            
            const position = document.createElement('div');
            position.className = 'match-position';
            position.textContent = getPositionSuffix(index + 1);
            
            const player = document.createElement('div');
            player.className = 'match-player';
            player.textContent = result.username;
            
            const stats = document.createElement('div');
            stats.className = 'match-stats';
            
            const clicks = document.createElement('span');
            clicks.textContent = `${result.clicks} clicks`;
            
            const time = document.createElement('span');
            time.textContent = formatTime(result.time);
            
            stats.appendChild(clicks);
            stats.appendChild(time);
            
            resultItem.appendChild(position);
            resultItem.appendChild(player);
            resultItem.appendChild(stats);
            results.appendChild(resultItem);
        });
        
        item.appendChild(header);
        item.appendChild(results);
        list.appendChild(item);
    });
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
    if (roomCode && username) {
        window.location.href = `multiplayer-room.html?roomCode=${roomCode}&username=${encodeURIComponent(username)}`;
    } else {
        window.location.href = 'multiplayer-lobby.html';
    }
});

init();
