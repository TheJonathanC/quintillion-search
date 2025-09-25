const express = require('express');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// In-memory storage for our search index and page data
let invertedIndex = {};
let pageData = {};

// Simulate backlinks (Off-Page SEO)
const backlinkScores = {
    "healthy-recipes.html": 10,
    "quick-meals.html": 2,
    "fitness-guide.html": 5,
    "about-us.html": 1
};

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
            
            // Build inverted index
            const allText = `${title} ${metaDescription} ${bodyText}`;
            const words = extractWords(allText);
            
            // Add words to inverted index
            words.forEach(word => {
                if (word.length > 0) {
                    if (!invertedIndex[word]) {
                        invertedIndex[word] = [];
                    }
                    if (!invertedIndex[word].includes(filename)) {
                        invertedIndex[word].push(filename);
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

// Function to calculate search scores
function calculateScore(filename, searchTerm, pageInfo) {
    let titleScore = 0;
    let descriptionScore = 0;
    let frequencyScore = 0;
    let backlinkScore = backlinkScores[filename] || 0;
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Title score: 15 points if term is in title
    if (pageInfo.title.toLowerCase().includes(searchTermLower)) {
        titleScore = 15;
    }
    
    // Description score: 10 points if term is in meta description
    if (pageInfo.metaDescription.toLowerCase().includes(searchTermLower)) {
        descriptionScore = 10;
    }
    
    // Frequency score: 1 point for each occurrence in body text
    const bodyTextLower = pageInfo.bodyText.toLowerCase();
    const matches = bodyTextLower.match(new RegExp(searchTermLower, 'g'));
    frequencyScore = matches ? matches.length : 0;
    
    const totalScore = titleScore + descriptionScore + frequencyScore + backlinkScore;
    
    return {
        titleScore,
        descriptionScore,
        frequencyScore,
        backlinkScore,
        totalScore
    };
}

// Search API endpoint
app.get('/search', (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.json({ error: 'Query parameter "q" is required' });
    }
    
    console.log(`Search query received: "${query}"`);
    
    const searchTerm = sanitizeWord(query);
    
    if (!searchTerm) {
        return res.json({ results: [] });
    }
    
    // Find pages that contain the search term
    const matchingPages = invertedIndex[searchTerm] || [];
    
    console.log(`Found ${matchingPages.length} pages matching "${searchTerm}"`);
    
    // Calculate scores for each matching page
    const results = matchingPages.map(filename => {
        const pageInfo = pageData[filename];
        const scores = calculateScore(filename, query, pageInfo);
        
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
            }
        };
    });
    
    // Sort by total score (descending)
    results.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log('Search results:', results.map(r => `${r.filename}: ${r.totalScore}`));
    
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

// Start crawling and indexing when server starts
crawlAndIndex();

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Search engine ready for queries!');
});