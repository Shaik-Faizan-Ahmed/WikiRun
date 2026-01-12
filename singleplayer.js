let startTime;
let timerInterval;
let clicks = 0;
let currentArticle = '';
let targetArticle = '';
let path = [];
let gameActive = false;

const BACKEND_URL = 'http://localhost:3001';

async function fetchRandomArticle() {
    const response = await fetch(`${BACKEND_URL}/api/random`);
    const data = await response.json();
    return data.title;
}

function createArticleIframe(title) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.src = `${BACKEND_URL}/api/article/${encodeURIComponent(title)}`;
    return iframe;
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        document.getElementById('timer').textContent = elapsed;
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
        if (index === path.length - 1) {
            item.classList.add('current');
        }
        item.textContent = article;
        item.onclick = () => goToPathArticle(index);
        pathList.appendChild(item);
    });
}

async function goToPathArticle(index) {
    if (!gameActive || index === path.length - 1) return;
    
    clicks++;
    document.getElementById('clicks').textContent = clicks;
    
    path = path.slice(0, index + 1);
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
    
    await loadArticle(title);
    updatePath();
}

function checkWinCondition() {
    if (currentArticle === targetArticle) {
        gameActive = false;
        stopTimer();
        
        const elapsed = Date.now() - startTime;
        
        setTimeout(() => {
            const result = {
                clicks: clicks,
                time: elapsed,
                target: targetArticle,
                path: path
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
    
    document.getElementById('targetTitle').textContent = target;
    
    await loadArticle(start);
    updatePath();
    
    gameActive = true;
    startTimer();
    
    document.getElementById('loading').classList.remove('show');
}

document.getElementById('quitBtn').onclick = () => {
    if (confirm('Are you sure you want to quit? Your progress will be lost.')) {
        stopTimer();
        window.location.href = 'index.html';
    }
};

initGame();
