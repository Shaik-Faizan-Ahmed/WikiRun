const BACKEND_URL = 'https://wikirun.onrender.com';

let currentSortColumn = 'rank';
let currentSortOrder = 'asc';
let currentDifficulty = 'easy';

window.leaderboardData = {};

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}.${String(milliseconds).padStart(3, '0')}s`;
    }
}

async function loadAllLeaderboards() {
    await loadLeaderboard('easy', 'easyLeaderboard');
    await loadLeaderboard('medium', 'mediumLeaderboard');
    await loadLeaderboard('hard', 'hardLeaderboard');
}

async function loadLeaderboard(difficulty, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard/${difficulty}`);
        const data = await response.json();
        
        displayLeaderboard(data, container, difficulty);
    } catch (error) {
        console.error(`Failed to load ${difficulty} leaderboard:`, error);
        container.innerHTML = '<div class="no-data">Failed to load leaderboard</div>';
    }
}

function sortLeaderboard(data, column, order) {
    const sorted = [...data];
    
    sorted.sort((a, b) => {
        let valA, valB;
        
        switch(column) {
            case 'rank':
                return 0;
            case 'nickname':
                valA = a.nickname.toLowerCase();
                valB = b.nickname.toLowerCase();
                break;
            case 'clicks':
                valA = a.clicks;
                valB = b.clicks;
                break;
            case 'time':
                valA = a.time;
                valB = b.time;
                break;
            case 'hint':
                valA = a.used_hint ? 1 : 0;
                valB = b.used_hint ? 1 : 0;
                break;
            default:
                return 0;
        }
        
        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
}

function displayLeaderboard(data, container, difficulty) {
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">No games played yet on this difficulty</div>';
        return;
    }
    
    window.leaderboardData[difficulty] = data;
    
    const sortedData = currentDifficulty === difficulty ? 
        sortLeaderboard(data, currentSortColumn, currentSortOrder) : data;
    
    const table = document.createElement('table');
    table.className = 'wiki-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="rank-cell sortable" onclick="sortTable('${difficulty}', 'rank')">
                Rank ${getSortIcon(difficulty, 'rank')}
            </th>
            <th class="sortable" onclick="sortTable('${difficulty}', 'nickname')">
                Player ${getSortIcon(difficulty, 'nickname')}
            </th>
            <th class="score-cell sortable" onclick="sortTable('${difficulty}', 'clicks')">
                Clicks ${getSortIcon(difficulty, 'clicks')}
            </th>
            <th class="time-cell sortable" onclick="sortTable('${difficulty}', 'time')">
                Time ${getSortIcon(difficulty, 'time')}
            </th>
            <th class="hint-cell sortable" onclick="sortTable('${difficulty}', 'hint')">
                Hint ${getSortIcon(difficulty, 'hint')}
            </th>
            <th>Path</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    sortedData.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        let rankDisplay = index + 1;
        if (index === 0) {
            rankDisplay = '🥇 ' + rankDisplay;
        } else if (index === 1) {
            rankDisplay = '🥈 ' + rankDisplay;
        } else if (index === 2) {
            rankDisplay = '🥉 ' + rankDisplay;
        }
        
        const originalIndex = data.indexOf(entry);
        
        row.innerHTML = `
            <td class="rank-cell">${rankDisplay}</td>
            <td><a class="player-link">${entry.nickname}</a></td>
            <td class="score-cell">${entry.clicks.toLocaleString()}</td>
            <td class="time-cell">${formatTime(entry.time)}</td>
            <td class="hint-cell">${entry.used_hint ? '✓' : '✗'}</td>
            <td><a class="path-link" href="#" onclick="event.preventDefault(); showPath('${difficulty}', ${originalIndex}); return false;">view</a></td>
        `;
        
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
}

function getSortIcon(difficulty, column) {
    if (currentDifficulty !== difficulty || currentSortColumn !== column) {
        return '';
    }
    return currentSortOrder === 'asc' ? '▲' : '▼';
}

function sortTable(difficulty, column) {
    if (currentDifficulty === difficulty && currentSortColumn === column) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentDifficulty = difficulty;
        currentSortColumn = column;
        currentSortOrder = 'asc';
    }
    
    const containerId = difficulty + 'Leaderboard';
    const data = window.leaderboardData[difficulty];
    const container = document.getElementById(containerId);
    
    displayLeaderboard(data, container, difficulty);
}

function showPath(difficulty, index) {
    const data = window.leaderboardData?.[difficulty];
    if (!data || !data[index]) {
        console.error('No data found for', difficulty, index);
        return;
    }
    
    const entry = data[index];
    const modal = document.getElementById('pathModal');
    
    document.getElementById('modalTitle').textContent = `${entry.nickname}'s Path`;
    
    let pathArray = entry.path;
    if (typeof pathArray === 'string') {
        try {
            pathArray = JSON.parse(pathArray);
        } catch (e) {
            console.error('Failed to parse path:', e);
            pathArray = [];
        }
    }
    
    if (!Array.isArray(pathArray)) {
        console.error('Path is not an array:', pathArray);
        pathArray = [];
    }
    
    const target = pathArray.length > 0 ? pathArray[pathArray.length - 1] : 'Unknown';
    document.getElementById('pathTarget').textContent = `Target: ${target}`;
    
    const pathContainer = document.getElementById('modalPath');
    pathContainer.innerHTML = '';
    
    pathArray.forEach((article, idx) => {
        const step = document.createElement('div');
        step.className = 'path-step';
        if (idx === pathArray.length - 1) {
            step.classList.add('target');
        }
        
        step.innerHTML = `
            <div class="step-number">${idx + 1}</div>
            <div class="step-article">${article}</div>
        `;
        
        pathContainer.appendChild(step);
    });
    
    const statsContainer = document.getElementById('modalStats');
    statsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">Clicks</div>
            <div class="stat-value">${entry.clicks}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Time</div>
            <div class="stat-value">${formatTime(entry.time)}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Hint Used</div>
            <div class="stat-value">${entry.used_hint ? 'Yes' : 'No'}</div>
        </div>
    `;
    
    modal.classList.add('active');
}

function closePathModal() {
    document.getElementById('pathModal').classList.remove('active');
}

window.onclick = function(event) {
    const modal = document.getElementById('pathModal');
    if (event.target === modal) {
        closePathModal();
    }
}

window.addEventListener('DOMContentLoaded', loadAllLeaderboards);
