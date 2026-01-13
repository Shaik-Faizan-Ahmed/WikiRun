CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL UNIQUE,
    difficulty VARCHAR(10) NOT NULL,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_difficulty ON articles(difficulty);

CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(100) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    clicks INTEGER NOT NULL,
    time INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaderboard_difficulty ON leaderboard(difficulty);
CREATE INDEX idx_leaderboard_clicks ON leaderboard(clicks);
CREATE INDEX idx_leaderboard_time ON leaderboard(time);
