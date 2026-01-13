import fetch from 'node-fetch';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'wikirun',
    password: 'postgres',
    port: 5432,
});

const API_BASE = 'https://en.wikipedia.org/w/api.php';
const DELAY_MS = 200;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCategoryMembers(category, namespace = 0) {
    const members = [];
    let cmcontinue = null;
    let attempts = 0;
    const maxAttempts = 3;

    do {
        try {
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: category,
                cmnamespace: namespace,
                cmlimit: 500
            });

            if (cmcontinue) {
                params.append('cmcontinue', cmcontinue);
            }

            const response = await fetch(`${API_BASE}?${params}`);
            const text = await response.text();
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.log(`  Warning: Failed to parse response for ${category}, retrying...`);
                attempts++;
                if (attempts >= maxAttempts) {
                    console.log(`  Skipping ${category} after ${maxAttempts} attempts`);
                    break;
                }
                await sleep(DELAY_MS * 3);
                continue;
            }

            if (data.query && data.query.categorymembers) {
                members.push(...data.query.categorymembers.map(m => m.title));
            }

            cmcontinue = data.continue?.cmcontinue;
            attempts = 0;
            await sleep(DELAY_MS);
        } catch (error) {
            console.log(`  Error fetching ${category}: ${error.message}`);
            attempts++;
            if (attempts >= maxAttempts) break;
            await sleep(DELAY_MS * 3);
        }
    } while (cmcontinue);

    return members;
}

async function fetchSubcategories(category, depth = 0, maxDepth = 1) {
    if (depth > maxDepth) return [];

    const subcats = [];
    let cmcontinue = null;

    try {
        do {
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: category,
                cmtype: 'subcat',
                cmlimit: 500
            });

            if (cmcontinue) {
                params.append('cmcontinue', cmcontinue);
            }

            const response = await fetch(`${API_BASE}?${params}`);
            const data = await response.json();

            if (data.query && data.query.categorymembers) {
                subcats.push(...data.query.categorymembers.map(m => m.title));
            }

            cmcontinue = data.continue?.cmcontinue;
            await sleep(DELAY_MS);
        } while (cmcontinue);
    } catch (error) {
        console.log(`  Error fetching subcategories for ${category}`);
    }

    return subcats;
}

async function generateAsianArticles() {
    console.log('Generating Asian articles...');
    
    const asianCategories = [
        'Category:India',
        'Category:Pakistan', 
        'Category:Bangladesh',
        'Category:Nepal',
        'Category:Sri Lanka',
        'Category:Bhutan',
        'Category:Myanmar',
        'Category:Afghanistan',
        'Category:People\'s Republic of China',
        'Category:Japan',
        'Category:South Korea',
        'Category:Thailand',
        'Category:Vietnam',
        'Category:Indonesia',
        'Category:Malaysia',
        'Category:Singapore',
        'Category:Philippines',
        'Category:Cambodia',
        'Category:Laos',
        'Category:Mongolia',
        'Category:Iran',
        'Category:Iraq',
        'Category:Saudi Arabia',
        'Category:United Arab Emirates',
        'Category:Israel',
        'Category:Turkey',
        'Category:Taiwan'
    ];

    const articles = new Set();

    for (const country of asianCategories) {
        console.log(`Processing ${country}...`);
        
        const mainArticles = await fetchCategoryMembers(country);
        mainArticles.forEach(a => articles.add(a));
        
        const subcats = await fetchSubcategories(country, 0, 1);
        
        const subcatsToProcess = subcats.slice(0, 15);
        for (const subcat of subcatsToProcess) {
            const subcatArticles = await fetchCategoryMembers(subcat);
            subcatArticles.forEach(a => articles.add(a));
        }
        
        console.log(`  Total articles so far: ${articles.size}`);
        
        await sleep(DELAY_MS);
    }

    console.log(`Total Asian articles: ${articles.size}`);
    return Array.from(articles);
}

async function generatePopularArticles() {
    console.log('\nGenerating popular articles...');
    
    const articles = new Set();

    console.log('Fetching Featured articles...');
    const featured = await fetchCategoryMembers('Category:Featured articles');
    featured.forEach(a => articles.add(a));
    console.log(`  Featured: ${featured.length}`);

    console.log('Fetching Good articles...');
    const good = await fetchCategoryMembers('Category:Good articles');
    good.forEach(a => articles.add(a));
    console.log(`  Good: ${good.length}`);

    console.log('Fetching Vital articles (Level 4)...');
    const vital4 = await fetchCategoryMembers('Category:Wikipedia level-4 vital articles');
    vital4.forEach(a => articles.add(a));
    console.log(`  Vital 4: ${vital4.length}`);

    console.log('Fetching Vital articles (Level 5)...');
    const vital5 = await fetchCategoryMembers('Category:Wikipedia level-5 vital articles');
    vital5.forEach(a => articles.add(a));
    console.log(`  Vital 5: ${vital5.length}`);

    console.log(`Total popular articles (unique): ${articles.size}`);
    return Array.from(articles);
}

async function insertArticles(articles, difficulty) {
    console.log(`\nInserting ${articles.length} articles for ${difficulty}...`);
    
    let inserted = 0;
    let skipped = 0;

    for (const title of articles) {
        try {
            const result = await pool.query(
                'INSERT INTO articles (title, difficulty) VALUES ($1, $2) ON CONFLICT (title) DO NOTHING RETURNING id',
                [title, difficulty]
            );
            
            if (result.rowCount > 0) {
                inserted++;
            } else {
                skipped++;
            }
            
            if (inserted % 1000 === 0 && inserted > 0) {
                console.log(`  Inserted ${inserted}/${articles.length}`);
            }
        } catch (error) {
            skipped++;
        }
    }

    console.log(`Inserted ${inserted}, skipped ${skipped} (duplicates or errors)`);
}

async function main() {
    try {
        console.log('Starting article generation...\n');
        
        await pool.query('DELETE FROM articles');
        console.log('Cleared existing articles\n');

        const asianArticles = await generateAsianArticles();
        await insertArticles(asianArticles, 'easy');

        const popularArticles = await generatePopularArticles();
        await insertArticles(popularArticles, 'medium');

        console.log('\n=== Generation complete! ===\n');
        
        const result = await pool.query('SELECT difficulty, COUNT(*) FROM articles GROUP BY difficulty ORDER BY difficulty');
        console.log('Final article counts:');
        result.rows.forEach(row => {
            console.log(`  ${row.difficulty}: ${row.count}`);
        });

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        await pool.end();
        process.exit(1);
    }
}

main();
