import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = 3001;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'wikirun',
    password: 'postgres',
    port: 5432,
});

app.use(cors());
app.use(express.json());

const API_BASE = 'https://en.wikipedia.org/w/api.php';

app.get('/api/random/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;

        if (difficulty === 'hard') {
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'random',
                rnnamespace: 0,
                rnlimit: 1
            });
            
            const response = await fetch(`${API_BASE}?${params}`);
            const data = await response.json();
            return res.json({ title: data.query.random[0].title });
        }

        const result = await pool.query(
            'SELECT title FROM articles WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 1',
            [difficulty]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No articles found for this difficulty' });
        }

        res.json({ title: result.rows[0].title });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/article/:title', async (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        
        const response = await fetch(wikiUrl, {
            headers: {
                'User-Agent': 'WikiRun/1.0'
            }
        });
        const html = await response.text();
        
        const $ = cheerio.load(html);
        
        $('head').prepend('<base href="https://en.wikipedia.org/">');
        
        $('#mw-panel').remove();
        $('.vector-column-start').remove();
        $('.vector-column-end').remove();
        $('#vector-toc-pinned-container').remove();
        $('.vector-page-toolbar').remove();
        $('#p-lang').remove();
        $('#footer').remove();
        $('#mw-navigation').remove();
        $('.mw-jump-link').remove();
        $('#siteNotice').remove();
        $('#centralNotice').remove();
        $('.vector-header').remove();
        $('#vector-user-links-dropdown').remove();
        $('.vector-search-box').remove();
        
        $('.mw-page-container').css({
            'margin-left': '0',
            'margin-right': '0',
            'padding-left': '0',
            'padding-right': '0'
        });
        
        $('.mw-page-container-inner').css({
            'grid-template-columns': '0 minmax(0, 1fr) 0',
            'margin-left': '0',
            'margin-right': '0'
        });
        
        $('.mw-content-container').css({
            'max-width': '100%',
            'margin': '0'
        });
        
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.startsWith('/wiki/') && !href.includes(':') && !href.includes('#')) {
                $(elem).attr('data-wiki-link', href.replace('/wiki/', ''));
                $(elem).attr('onclick', 'return false;');
            } else if (href && (href.startsWith('/') || href.startsWith('#'))) {
                $(elem).attr('onclick', 'return false;');
            }
        });
        
        $('body').append(`
            <script>
                document.addEventListener('click', function(e) {
                    const link = e.target.closest('a[data-wiki-link]');
                    if (link) {
                        e.preventDefault();
                        const title = link.getAttribute('data-wiki-link');
                        window.parent.postMessage({ type: 'navigate', title: decodeURIComponent(title) }, '*');
                        return false;
                    }
                    
                    const otherLink = e.target.closest('a');
                    if (otherLink) {
                        e.preventDefault();
                        return false;
                    }
                });
            </script>
        `);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send($.html());
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leaderboard', async (req, res) => {
    try {
        const { nickname, difficulty, clicks, time, path, usedHint } = req.body;

        const result = await pool.query(
            'INSERT INTO leaderboard (nickname, difficulty, clicks, time, path, used_hint) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [nickname, difficulty, clicks, time, JSON.stringify(path), usedHint || false]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leaderboard/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;
        const { sortBy = 'clicks' } = req.query;

        const orderBy = sortBy === 'time' ? 'time ASC, clicks ASC' : 'clicks ASC, time ASC';

        const result = await pool.query(
            `SELECT nickname, clicks, time, path, used_hint, created_at 
             FROM leaderboard 
             WHERE difficulty = $1 
             ORDER BY ${orderBy} 
             LIMIT 10`,
            [difficulty]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`WikiRun backend running on http://localhost:${PORT}`);
});
