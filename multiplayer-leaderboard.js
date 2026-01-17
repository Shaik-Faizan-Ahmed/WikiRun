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

function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
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
        
        displayRankingsTable(data.leaderboard);
        displayMatchHistory(data.matches);
    });
    
    socket.on('roomError', (data) => {
        alert(data.message);
        window.location.href = 'multiplayer-lobby.html';
    });
}

function displayRankingsTable(leaderboard) {
    const container = document.getElementById('rankingsTable');
    container.innerHTML = '';
    
    if (!leaderboard || leaderboard.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'loading';
        emptyMsg.textContent = 'No matches played yet';
        container.appendChild(emptyMsg);
        return;
    }
    
    // Sort players by most 1st place finishes, then 2nd, then 3rd as tiebreakers
    const sorted = [...leaderboard].sort((a, b) => {
        if ((b.first || 0) !== (a.first || 0)) return (b.first || 0) - (a.first || 0);
        if ((b.second || 0) !== (a.second || 0)) return (b.second || 0) - (a.second || 0);
        return (b.third || 0) - (a.third || 0);
    });
    
    // Create table
    const table = document.createElement('table');
    table.className = 'rankings-table-element';
    
    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Rank', 'Name/Username', '1st Place', '2nd Place', '3rd Place', 'Total Matches'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    sorted.forEach((player, index) => {
        const row = document.createElement('tr');
        
        // Rank
        const rankCell = document.createElement('td');
        rankCell.className = 'rank-cell';
        rankCell.textContent = index + 1;
        
        // Name
        const nameCell = document.createElement('td');
        nameCell.className = 'name-cell';
        nameCell.textContent = player.username;
        
        // 1st Place with medal
        const firstCell = document.createElement('td');
        firstCell.className = 'medal-cell';
        firstCell.innerHTML = `<span class="medal">🥇</span> ${player.first || 0}`;
        
        // 2nd Place with medal
        const secondCell = document.createElement('td');
        secondCell.className = 'medal-cell';
        secondCell.innerHTML = `<span class="medal">🥈</span> ${player.second || 0}`;
        
        // 3rd Place with medal
        const thirdCell = document.createElement('td');
        thirdCell.className = 'medal-cell';
        thirdCell.innerHTML = `<span class="medal">🥉</span> ${player.third || 0}`;
        
        // Total Matches
        const totalCell = document.createElement('td');
        totalCell.className = 'total-cell';
        const total = (player.first || 0) + (player.second || 0) + (player.third || 0);
        totalCell.textContent = total;
        
        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(firstCell);
        row.appendChild(secondCell);
        row.appendChild(thirdCell);
        row.appendChild(totalCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
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
    
    // Sort matches by most recent first
    const sortedMatches = [...matches].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedMatches.forEach((match, matchIndex) => {
        const item = document.createElement('div');
        item.className = 'match-item';
        
        const header = document.createElement('div');
        header.className = 'match-header';
        
        const matchInfo = document.createElement('div');
        matchInfo.className = 'match-info';
        
        const matchNumber = document.createElement('div');
        matchNumber.className = 'match-number';
        matchNumber.textContent = `Match #${matches.length - matchIndex}`;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'match-timestamp';
        timestamp.textContent = getRelativeTime(match.timestamp);
        
        matchInfo.appendChild(matchNumber);
        matchInfo.appendChild(timestamp);
        
        const target = document.createElement('div');
        target.className = 'match-target';
        target.textContent = `Target: ${match.target || 'Unknown'}`;
        
        const difficulty = document.createElement('div');
        difficulty.className = 'match-difficulty';
        difficulty.textContent = match.difficulty ? match.difficulty.charAt(0).toUpperCase() + match.difficulty.slice(1) : 'Unknown';
        
        const players = document.createElement('div');
        players.className = 'match-players-count';
        players.textContent = `${match.playerCount || 0} player${match.playerCount !== 1 ? 's' : ''}`;
        
        header.appendChild(matchInfo);
        header.appendChild(target);
        header.appendChild(difficulty);
        header.appendChild(players);
        
        const results = document.createElement('div');
        results.className = 'match-results';
        
        if (match.abandoned) {
            const abandonedMsg = document.createElement('div');
            abandonedMsg.className = 'match-abandoned';
            abandonedMsg.style.color = '#ff4444';
            abandonedMsg.style.fontWeight = 'bold';
            abandonedMsg.style.textAlign = 'center';
            abandonedMsg.style.padding = '15px';
            abandonedMsg.style.fontSize = '1.1em';
            abandonedMsg.textContent = 'ROUND ABANDONED';
            results.appendChild(abandonedMsg);
        } else {
            // Only show top 3 finishers
            const topThree = match.results.slice(0, 3);
            
            topThree.forEach((result, index) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'match-result-item';
                
                const position = document.createElement('div');
                position.className = 'match-position';
                const positionNum = index + 1;
                const medals = ['🥇', '🥈', '🥉'];
                position.innerHTML = `<span class="position-medal">${medals[index]}</span> ${positionNum}${positionNum === 1 ? 'st' : positionNum === 2 ? 'nd' : 'rd'}`;
                
                const player = document.createElement('div');
                player.className = 'match-player';
                player.textContent = result.username;
                
                const stats = document.createElement('div');
                stats.className = 'match-stats';
                
                const clicks = document.createElement('span');
                clicks.className = 'stat-item';
                clicks.innerHTML = `<strong>${result.clicks}</strong> clicks`;
                
                const time = document.createElement('span');
                time.className = 'stat-item';
                time.innerHTML = `<strong>${formatTime(result.time)}</strong>`;
                
                stats.appendChild(clicks);
                stats.appendChild(time);
                
                resultItem.appendChild(position);
                resultItem.appendChild(player);
                resultItem.appendChild(stats);
                results.appendChild(resultItem);
            });
        }
        
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
