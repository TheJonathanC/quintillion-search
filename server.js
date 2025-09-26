const express = require('express');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public', {
    maxAge: '1y',
    etag: false
}));

// Explicitly serve CSS and JS files
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

// Root route - serve the main index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory storage for our search index and page data
let invertedIndex = {};
let pageData = {};

// Simulate backlinks (Off-Page SEO)
const backlinkScores = {
    "healthy-recipes.html": 10,
    "quick-meals.html": 2,
    "fitness-guide.html": 5,
    "about-us.html": 1,
    "photography-guide.html": 8,
    "gardening-guide.html": 7,
    "budget-travel.html": 6,
    "web-development.html": 12,
    "home-baking.html": 4,
    "personal-finance.html": 9,
    "dog-training.html": 3,
    "renewable-energy.html": 8,
    "coffee-brewing.html": 5,
    "meditation-guide.html": 6,
    "home-organization.html": 4,
    "woodworking-projects.html": 3,
    "urban-beekeeping.html": 2,
    "vintage-car-restoration.html": 5,
    // Biryani pages
    "deion-bhai-biryani.html": 15,          // Highest authority - excellent SEO
    "hyderabadi-biryani-history.html": 6,   // Moderate SEO
    "biryani-restaurant-review.html": 2,    // Poor SEO
    "biryani-recipe.html": 1                // Very poor SEO
};

// Simple stemming rules for common word variations
const stemmingRules = {
    // Plural forms
    'plants': 'plant',
    'gardens': 'garden',
    'flowers': 'flower',
    'recipes': 'recipe',
    'foods': 'food',
    'meals': 'meal',
    'exercises': 'exercise',
    'workouts': 'workout',
    'techniques': 'technique',
    'methods': 'method',
    'tips': 'tip',
    'ideas': 'idea',
    'photos': 'photo',
    'images': 'image',
    'books': 'book',
    'tools': 'tool',
    'skills': 'skill',
    'projects': 'project',
    'homes': 'home',
    'houses': 'house',
    'cars': 'car',
    'systems': 'system',
    'solutions': 'solution',
    
    // -ing forms (gerunds)
    'cooking': 'cook',
    'baking': 'bake',
    'gardening': 'garden',
    'planting': 'plant',
    'growing': 'grow',
    'training': 'train',
    'learning': 'learn',
    'building': 'build',
    'working': 'work',
    'traveling': 'travel',
    'running': 'run',
    'walking': 'walk',
    'eating': 'eat',
    'drinking': 'drink',
    'reading': 'read',
    'writing': 'write',
    'planning': 'plan',
    'organizing': 'organize',
    'cleaning': 'clean',
    'decorating': 'decorate',
    
    // -ed forms (past tense)
    'cooked': 'cook',
    'baked': 'bake',
    'planted': 'plant',
    'trained': 'train',
    'learned': 'learn',
    'worked': 'work',
    'traveled': 'travel',
    'planned': 'plan',
    'organized': 'organize',
    'cleaned': 'clean',
    'decorated': 'decorate',
    
    // -er forms (comparative/agent)
    'bigger': 'big',
    'smaller': 'small',
    'faster': 'fast',
    'slower': 'slow',
    'better': 'good',
    'worker': 'work',
    'trainer': 'train',
    'baker': 'bake',
    'cooker': 'cook',
    'gardener': 'garden',
    'photographer': 'photo',
    'developer': 'develop',
    
    // -ly forms (adverbs)
    'quickly': 'quick',
    'easily': 'easy',
    'slowly': 'slow',
    'carefully': 'care',
    'properly': 'proper',
    'naturally': 'natural',
    'healthy':'health',
    
    // -tion/-sion forms
    'preparation': 'prepare',
    'organization': 'organize',
    'information': 'inform',
    'education': 'educate',
    'nutrition': 'nutrient',
    'meditation': 'meditate',
    'restoration': 'restore',
    'creation': 'create',
    'decoration': 'decorate',
    'installation': 'install'
};

// Function to get the stem (root form) of a word
function getStem(word) {
    const lowerWord = word.toLowerCase();
    
    // Check if we have a specific stemming rule
    if (stemmingRules[lowerWord]) {
        return stemmingRules[lowerWord];
    }
    
    // Apply simple suffix removal rules
    let stem = lowerWord;
    
    // Remove common suffixes
    if (stem.endsWith('ies') && stem.length > 4) {
        stem = stem.slice(0, -3) + 'y';
    } else if (stem.endsWith('ied') && stem.length > 4) {
        stem = stem.slice(0, -3) + 'y';
    } else if (stem.endsWith('ing') && stem.length > 4) {
        stem = stem.slice(0, -3);
        // Handle double consonants (running -> run, not runn)
        if (stem.length > 2 && stem[stem.length-1] === stem[stem.length-2]) {
            const lastChar = stem[stem.length-1];
            if ('bdfgklmnprtv'.includes(lastChar)) {
                stem = stem.slice(0, -1);
            }
        }
    } else if (stem.endsWith('ed') && stem.length > 3) {
        stem = stem.slice(0, -2);
        // Handle double consonants
        if (stem.length > 2 && stem[stem.length-1] === stem[stem.length-2]) {
            const lastChar = stem[stem.length-1];
            if ('bdfgklmnprtv'.includes(lastChar)) {
                stem = stem.slice(0, -1);
            }
        }
    } else if (stem.endsWith('s') && stem.length > 3 && !stem.endsWith('ss')) {
        stem = stem.slice(0, -1);
    }
    
    return stem;
}

// Function to get all possible variations of a word
function getWordVariations(word) {
    const stem = getStem(word);
    const variations = new Set([word.toLowerCase(), stem]);
    
    // Add known variations from our stemming rules
    Object.entries(stemmingRules).forEach(([variant, root]) => {
        if (root === stem || variant === word.toLowerCase()) {
            variations.add(variant);
            variations.add(root);
        }
    });
    
    return Array.from(variations);
}

// Function to sanitize and normalize words
function sanitizeWord(word) {
    return word.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();
}

// Function to extract words from text
function extractWords(text) {
    if (!text) return [];
    return text.split(/\s+/)
        .map(sanitizeWord)
        .filter(word => word.length > 0);
}

// Function to crawl and index all files in sample-pages directory
function crawlAndIndex() {
    console.log('Starting crawling and indexing process...');
    
    const samplePagesDir = path.join(__dirname, 'sample-pages');
    
    try {
        const files = fs.readdirSync(samplePagesDir);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        
        console.log(`Found ${htmlFiles.length} HTML files to index`);
        
        htmlFiles.forEach(filename => {
            const filePath = path.join(samplePagesDir, filename);
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            
            // Parse HTML with Cheerio
            const $ = cheerio.load(htmlContent);
            
            // Extract page data
            const title = $('title').text() || '';
            const metaDescription = $('meta[name="description"]').attr('content') || '';
            const bodyText = $('body').text() || '';
            
            // Store page data
            pageData[filename] = {
                title: title,
                metaDescription: metaDescription,
                bodyText: bodyText
            };
            
            console.log(`Indexed: ${filename} - Title: "${title}"`);
            
            // Build inverted index with stemming support
            const allText = `${title} ${metaDescription} ${bodyText}`;
            const words = extractWords(allText);
            
            // Add words and their stems to inverted index
            words.forEach(word => {
                if (word.length > 0) {
                    // Add the original word
                    if (!invertedIndex[word]) {
                        invertedIndex[word] = [];
                    }
                    if (!invertedIndex[word].includes(filename)) {
                        invertedIndex[word].push(filename);
                    }
                    
                    // Add the stem of the word
                    const stem = getStem(word);
                    if (stem !== word) {
                        if (!invertedIndex[stem]) {
                            invertedIndex[stem] = [];
                        }
                        if (!invertedIndex[stem].includes(filename)) {
                            invertedIndex[stem].push(filename);
                        }
                    }
                }
            });
        });
        
        console.log('Indexing completed successfully');
        console.log(`Total unique words indexed: ${Object.keys(invertedIndex).length}`);
        
    } catch (error) {
        console.error('Error during crawling and indexing:', error);
    }
}

// Enhanced function to calculate search scores with stemming
function calculateScore(filename, searchTerm, pageInfo, searchVariations = null) {
    let titleScore = 0;
    let descriptionScore = 0;
    let frequencyScore = 0;
    let backlinkScore = backlinkScores[filename] || 0;
    
    // Use provided variations or calculate them
    const variations = searchVariations || getWordVariations(searchTerm.toLowerCase());
    
    // Title score: 15 points if any variation of term is in title
    const titleLower = pageInfo.title.toLowerCase();
    if (variations.some(variation => titleLower.includes(variation))) {
        titleScore = 15;
    }
    
    // Description score: 10 points if any variation of term is in meta description
    const descriptionLower = pageInfo.metaDescription.toLowerCase();
    if (variations.some(variation => descriptionLower.includes(variation))) {
        descriptionScore = 10;
    }
    
    // Frequency score: 1 point for each occurrence of any variation in body text
    const bodyTextLower = pageInfo.bodyText.toLowerCase();
    variations.forEach(variation => {
        const matches = bodyTextLower.match(new RegExp(variation, 'g'));
        if (matches) {
            frequencyScore += matches.length;
        }
    });
    
    const totalScore = titleScore + descriptionScore + frequencyScore + backlinkScore;
    
    return {
        titleScore,
        descriptionScore,
        frequencyScore,
        backlinkScore,
        totalScore,
        matchedVariations: variations.filter(variation => 
            titleLower.includes(variation) || 
            descriptionLower.includes(variation) || 
            bodyTextLower.includes(variation)
        )
    };
}

// Route to serve individual sample pages
app.get('/page/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'sample-pages', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Page not found');
    }
    
    // Serve the HTML file
    res.sendFile(filePath);
});

// Search API endpoint with stemming support
app.get('/search', (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.json({ error: 'Query parameter "q" is required' });
    }
    
    console.log(`🔍 Search query received: "${query}"`);
    
    const searchTerm = sanitizeWord(query);
    
    if (!searchTerm) {
        console.log('❌ Empty search term after sanitization');
        return res.json({ results: [] });
    }
    
    // Get all variations of the search term
    const searchVariations = getWordVariations(searchTerm);
    console.log(`📝 Search variations: [${searchVariations.join(', ')}]`);
    
    // Find pages that contain any variation of the search term
    const matchingPagesSet = new Set();
    
    searchVariations.forEach(variation => {
        const pages = invertedIndex[variation] || [];
        pages.forEach(page => matchingPagesSet.add(page));
        if (pages.length > 0) {
            console.log(`   "${variation}" found in: ${pages.join(', ')}`);
        }
    });
    
    const matchingPages = Array.from(matchingPagesSet);
    
    console.log(`📄 Found ${matchingPages.length} pages matching search variations`);
    
    // Calculate scores for each matching page
    const results = matchingPages.map(filename => {
        const pageInfo = pageData[filename];
        const scores = calculateScore(filename, query, pageInfo, searchVariations);
        
        console.log(`   ${filename}: ${scores.totalScore} points (T:${scores.titleScore} D:${scores.descriptionScore} F:${scores.frequencyScore} B:${scores.backlinkScore})`);
        
        return {
            filename: filename,
            title: pageInfo.title,
            metaDescription: pageInfo.metaDescription,
            totalScore: scores.totalScore,
            breakdown: {
                titleScore: scores.titleScore,
                descriptionScore: scores.descriptionScore,
                frequencyScore: scores.frequencyScore,
                backlinkScore: scores.backlinkScore
            },
            matchedVariations: scores.matchedVariations
        };
    });
    
    // Sort by total score (descending)
    results.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log(`🏆 Final rankings: ${results.map((r, i) => `#${i+1} ${r.filename} (${r.totalScore})`).join(', ')}`);
    console.log('─'.repeat(60));
    
    res.json({ results: results });
});

// API endpoint to get indexing information (for debugging)
app.get('/api/index-info', (req, res) => {
    res.json({
        totalPages: Object.keys(pageData).length,
        totalWords: Object.keys(invertedIndex).length,
        pages: Object.keys(pageData),
        sampleWords: Object.keys(invertedIndex).slice(0, 20)
    });
});

// Route to serve individual sample pages
app.get('/page/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'sample-pages', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Page not found');
    }
    
    try {
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        res.send(htmlContent);
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).send('Error loading page');
    }
});

// Start crawling and indexing when server starts
crawlAndIndex();

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Search engine ready for queries!');
});