let selectedDifficulty = null;

const nicknameInput = document.getElementById('nickname');
const startBtn = document.getElementById('startBtn');
const difficultyCards = document.querySelectorAll('.difficulty-card');

const savedNickname = localStorage.getItem('wikirun_nickname');
if (savedNickname) {
    nicknameInput.value = savedNickname;
}

difficultyCards.forEach(card => {
    card.addEventListener('click', () => {
        difficultyCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDifficulty = card.getAttribute('data-difficulty');
        checkStartButton();
    });
});

nicknameInput.addEventListener('input', () => {
    checkStartButton();
});

function checkStartButton() {
    const hasNickname = nicknameInput.value.trim().length > 0;
    const hasDifficulty = selectedDifficulty !== null;
    
    startBtn.disabled = !(hasNickname && hasDifficulty);
}

startBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    
    localStorage.setItem('wikirun_nickname', nickname);
    
    window.location.href = `singleplayer.html?difficulty=${selectedDifficulty}&nickname=${encodeURIComponent(nickname)}`;
});
