<div align="center">
  <img src="assets/logo.png" alt="WikiRun Logo" width="200"/>
  
  # 🎮 WikiRun
  
  **A fast-paced Wikipedia racing game where speed meets knowledge!**
  
  Race from one Wikipedia article to another using only the links within articles. Challenge yourself in single-player mode or compete against friends in real-time multiplayer matches!
  
  **[🎮 Play WikiRun Now →](https://wiki-run.vercel.app/)**
  
  [📖 About](#-about-the-game) | [✨ Features](#-features) | [🎯 How to Play](#-how-to-play) | [🛠️ Technologies](#️-technologies-used) | [🔧 Technical Highlights](#-technical-highlights) | [🚀 Setup](#-setup--installation) | [🎯 Future Plans](#-future-enhancements) | [🤝 Contributing](#-contributing)
</div>

---

## 📖 About the Game

WikiRun is a competitive Wikipedia navigation game inspired by the classic "Wikipedia game" (also known as "Wikirace"). Players start on a random Wikipedia article and must reach a target article by clicking only on links within the articles themselves.

**Why the minimal UI?** The interface is intentionally designed to mirror Wikipedia's authentic look and feel. This isn't a limitation—it's a deliberate design choice that keeps players immersed in the Wikipedia environment while maintaining focus on the core gameplay: strategic link navigation and quick decision-making.

---

## ✨ Features

### 🎲 Game Modes
- **Single Player**: Race against time to find the shortest path between articles
- **Multiplayer**: Compete with up to 6 players in real-time matches
- **Three Difficulty Levels**: 
  - Easy: Asian-focused topics with regional connectivity
  - Medium: Globally popular and well-connected articles
  - Hard: Completely random Wikipedia articles

### 🏆 Competitive Features
- **Global Leaderboards**: Track top performances by difficulty level
- **Room-Based Leaderboards**: See who's the best in your friend group
- **Live Standings**: Watch your position update in real-time during multiplayer matches
- **Match History**: Review past games and performances
- **Hint System**: Get help when you're stuck (displays the opening paragraph from the target article)

### 🌐 Real-Time Multiplayer
- Create private rooms with 4-digit codes
- Host controls for difficulty selection and game start
- Live player progress tracking
- Smart game ending (doesn't require all players to finish)
- Persistent room stats across multiple rounds

---

## 🎯 How to Play

### Objective
Navigate from the **start article** to the **target article** using only Wikipedia links in the fewest clicks possible.

### Rules
1. You can only click on blue Wikipedia links within article content
2. Each link click increases your click counter
3. External links, citation links, and navigation elements are disabled
4. The fastest player with the fewest clicks wins!

### Multiplayer Specifics
- **2 players**: First to finish wins
- **3 players**: Top 2 finishers are ranked
- **4-6 players**: Top 3 finishers are ranked
- Game ends automatically when enough players finish (you don't have to wait for everyone!)

### Tips
- Look for highly connected "hub" articles (countries, dates, broad topics)
- The hint reveals the introduction of your target article, giving you context clues
- In Easy/Medium mode, articles are curated for better connectivity
- In Hard mode, expect wild randomness paths!

---

## 🛠️ Technologies Used

### Frontend
- **HTML5, CSS3, JavaScript** - Pure vanilla JS, no frameworks
- **Socket.IO Client** - Real-time bidirectional communication
- **Wikipedia Integration** - Live article fetching and rendering

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **Socket.IO** - WebSocket server for real-time multiplayer
- **PostgreSQL** - Database for leaderboards and article curation
- **Cheerio** - Server-side HTML parsing and manipulation

### Security & Performance
- **Validator.js** - Input sanitization and validation
- **Express Rate Limit** - API abuse prevention
- **Parameterized Queries** - SQL injection protection
- **CORS** - Cross-origin resource sharing control

---

## 🔧 Technical Highlights

### 🌐 Wikipedia Integration
WikiRun fetches real Wikipedia pages and makes them playable:
- **Server-side scraping** using Cheerio to parse Wikipedia HTML
- **Intelligent sanitization** - Removes navigation, sidebars, footers, and external elements
- **Link transformation** - Converts Wikipedia links to in-game navigation
- **PostMessage API** - Secure communication between iframe and parent window
- **Base URL injection** - Ensures all Wikipedia resources load correctly

```javascript
// Links are transformed to prevent actual navigation
$('a').each((i, elem) => {
    if (href.startsWith('/wiki/') && !href.includes(':')) {
        $(elem).attr('data-wiki-link', href.replace('/wiki/', ''));
        $(elem).attr('onclick', 'return false;');
    }
});
```

### 🎮 Real-Time Multiplayer System
Built from scratch using Socket.IO:
- **Room-based architecture** - Each game creates an isolated room with a 4-digit code
- **Event-driven gameplay** - Player progress, standings, and game state sync in real-time
- **Smart game logic** - Automatically ends games when enough players finish (no waiting for stragglers)
- **Persistent sessions** - Players can rejoin if disconnected
- **Dual leaderboard system** - Global leaderboards + room-specific stats

```javascript
// Real-time standings update
socket.on('playerProgress', ({ roomCode, username, clicks }) => {
    // Update session state
    // Calculate new standings
    // Broadcast to all players in room
    io.to(`game-${roomCode}`).emit('standingsUpdate', { standings });
});
```

### 🎲 Smart Difficulty System
- **Easy (7,398 articles)**: Asian-focused topics (India, China, Japan, Southeast Asia, Middle East) - regional connectivity for familiar navigation
- **Medium (49,966 articles)**: Featured articles, Good articles, and Wikipedia's Vital articles - globally recognized topics with high link density
- **Hard Mode**: Uses Wikipedia's random article API for completely unpredictable challenges
- **Database-driven selection** - PostgreSQL stores 7.4K Easy and 50K Medium curated articles

### 🔒 Security Measures
- **Input validation** on all user inputs (usernames, room codes, paths)
- **SQL injection prevention** using parameterized queries
- **XSS protection** with Validator.js escaping
- **Rate limiting** on API endpoints and leaderboard submissions
- **Length restrictions** on all text inputs to prevent abuse
- **Room code sanitization** - Only 4-digit numeric codes accepted

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** (comes with Node.js)

### Step-by-Step Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wikirun.git
   cd wikirun
   ```

2. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb wikirun
   
   # Run database setup script
   psql -d wikirun -f backend/db-setup.sql
   
   # (Optional) Add hint column if needed
   psql -d wikirun -f backend/add-hint-column.sql
   ```

3. **Configure backend**
   ```bash
   cd backend
   
   # Install dependencies
   npm install
   
   # Create .env file (see Environment Variables section below)
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Generate article lists** (Optional - for Easy/Medium modes)
   ```bash
   # This populates the database with curated articles
   npm run generate-lists
   ```

5. **Start the backend server**
   ```bash
   npm start
   # Server runs on http://localhost:3001
   ```

6. **Open the frontend**
   - Open `index.html` in your browser, or
   - Use a local server (Live Server extension in VS Code, Python's `http.server`, etc.)
   ```bash
   # Example with Python
   python -m http.server 5500
   # Then open http://localhost:5500
   ```

### Environment Variables

Create a `backend/.env` file with the following:

```env
# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=wikirun
DB_PASSWORD=your_password_here
DB_PORT=5432

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (update for production deployment)
FRONTEND_URL=http://localhost:5500
```

**Important**: Never commit your `.env` file! It contains sensitive credentials.

---

## 🎯 Future Enhancements

- **Category-Based Games**: Add themed challenges (Movies, Sports, Science, History, Geography) instead of just random articles
- **Tournament Mode**: Bracket-style competitions with multiple rounds
- **Achievements System**: Unlock badges for milestones (speed records, win streaks, difficult paths)
- **Custom Rooms**: Allow players to set their own start/target articles
- **Mobile App**: Native mobile version for on-the-go racing
- **AI Opponent**: Practice against a bot that uses shortest-path algorithms

---

## 🤝 Contributing

PRs welcome. Please test locally before submitting.

---
