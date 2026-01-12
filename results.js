const result = JSON.parse(localStorage.getItem('gameResult'));

if (!result) {
    window.location.href = 'index.html';
} else {
    document.getElementById('finalClicks').textContent = result.clicks;
    document.getElementById('finalTime').textContent = result.time + ' ms';
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
