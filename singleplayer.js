let startTime;
let timerInterval;
let clicks = 0;
let currentArticle = '';
let targetArticle = '';
let path = [];
let pathTimes = [];
let gameActive = false;
let difficulty = 'hard';
let nickname = '';
let usedHint = false;

const BACKEND_URL = 'https://wikirun.onrender.com';

const urlParams = new URLSearchParams(window.location.search);
difficulty = urlParams.get('difficulty') || 'hard';
nickname = urlParams.get('nickname') || 'Player';

async function fetchRandomArticle() {
    const response = await fetch(`${BACKEND_URL}/api/random/${difficulty}`);
    const data = await response.json();
    return data.title;
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
        articleSpan.className = 'path-item-article';
        articleSpan.textContent = article;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'path-item-time';
        timeSpan.textContent = formatTime(pathTimes[index]);
        
        item.appendChild(articleSpan);
        item.appendChild(timeSpan);
        
        item.onclick = () => goToPathArticle(index);
        pathList.appendChild(item);
    });
}

async function goToPathArticle(index) {
    if (!gameActive || index === path.length - 1) return;
    
    clicks++;
    document.getElementById('clicks').textContent = clicks;
    
    path = path.slice(0, index + 1);
    pathTimes = pathTimes.slice(0, index + 1);
    currentArticle = path[index];
    
    await loadArticle(currentArticle);
    updatePath();
}

async function loadArticle(title) {
    const content = document.getElementById('articleContent');
    const loading = document.getElementById('loading');
    
    loading.classList.add('show');
    content.innerHTML = '';
    
    const iframe = createArticleIframe(title);
    
    iframe.onload = () => {
        loading.classList.remove('show');
        checkWinCondition();
    };
    
    content.appendChild(iframe);
}

async function navigateToArticle(title) {
    if (!gameActive) return;
    
    clicks++;
    document.getElementById('clicks').textContent = clicks;
    
    currentArticle = title;
    path.push(title);
    pathTimes.push(Date.now() - startTime);
    
    await loadArticle(title);
    updatePath();
}

function checkWinCondition() {
    if (currentArticle.toLowerCase().replace(/_/g, ' ') === targetArticle.toLowerCase().replace(/_/g, ' ')) {
        gameActive = false;
        stopTimer();
        
        const elapsed = Date.now() - startTime;
        
        setTimeout(async () => {
            try {
                await fetch(`${BACKEND_URL}/api/leaderboard`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nickname: nickname,
                        difficulty: difficulty,
                        clicks: clicks,
                        time: elapsed,
                        path: path,
                        usedHint: usedHint
                    })
                });
            } catch (error) {
                console.error('Failed to submit to leaderboard:', error);
            }
            
            const result = {
                clicks: clicks,
                time: elapsed,
                target: targetArticle,
                path: path,
                difficulty: difficulty,
                nickname: nickname
            };
            localStorage.setItem('gameResult', JSON.stringify(result));
            window.location.href = 'results.html';
        }, 500);
    }
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'navigate') {
        navigateToArticle(event.data.title);
    }
});

async function initGame() {
    document.getElementById('loading').classList.add('show');
    
    const [start, target] = await Promise.all([
        fetchRandomArticle(),
        fetchRandomArticle()
    ]);
    
    currentArticle = start;
    targetArticle = target;
    path = [start];
    pathTimes = [0];
    
    document.getElementById('targetTitle').textContent = target;
    
    await loadArticle(start);
    updatePath();
    
    gameActive = true;
    startTimer();
    
    document.getElementById('loading').classList.remove('show');
}

document.getElementById('quitBtn').onclick = () => {
    document.getElementById('quitModal').classList.add('show');
};

document.getElementById('cancelQuit').onclick = () => {
    document.getElementById('quitModal').classList.remove('show');
};

document.getElementById('confirmQuit').onclick = () => {
    stopTimer();
    window.location.href = 'index.html';
};

document.getElementById('hintBtn').onclick = async () => {
    const hintContent = document.getElementById('hintContent');
    const hintBtn = document.getElementById('hintBtn');
    const hintText = document.getElementById('hintText');
    
    if (hintContent.style.display === 'none') {
        if (!usedHint) {
            usedHint = true;
            hintText.textContent = 'Loading...';
            const description = await fetchArticleDescription(targetArticle);
            hintText.textContent = description;
        }
        hintContent.style.display = 'block';
        hintBtn.textContent = '▲ Hide description';
    } else {
        hintContent.style.display = 'none';
        hintBtn.textContent = '▼ Show description';
    }
};

initGame();
