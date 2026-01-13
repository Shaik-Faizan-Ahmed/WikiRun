const result = JSON.parse(localStorage.getItem('gameResult'));

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

if (!result) {
    window.location.href = 'index.html';
} else {
    document.getElementById('finalClicks').textContent = result.clicks;
    document.getElementById('finalTime').textContent = formatTime(result.time);
    document.getElementById('targetArticle').textContent = result.target;
    
    const pathDisplay = document.getElementById('pathDisplay');
    result.path.forEach((article, index) => {
        const step = document.createElement('div');
        step.className = 'path-step';
        
        const number = document.createElement('div');
        number.className = 'path-number';
        number.textContent = index + 1;
        
        const title = document.createElement('div');
        title.className = 'path-title';
        title.textContent = article;
        
        step.appendChild(number);
        step.appendChild(title);
        pathDisplay.appendChild(step);
    });
    
    localStorage.removeItem('gameResult');
}
