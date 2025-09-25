// DOM elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const resultsContainer = document.getElementById('results-container');

// Add event listeners
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Focus on search input when page loads
document.addEventListener('DOMContentLoaded', function() {
    searchInput.focus();
});

// Perform search function
async function performSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        showMessage('Please enter a search term', 'error');
        return;
    }
    
    // Show loading state
    showLoading();
    
    try {
        // Make API request
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display results
        displayResults(data.results || [], query);
        
    } catch (error) {
        console.error('Search error:', error);
        showMessage('An error occurred while searching. Please try again.', 'error');
    }
}

// Display search results
function displayResults(results, query) {
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        showNoResults(query);
        return;
    }
    
    // Show search info if variations were found
    if (results.length > 0 && results[0].matchedVariations) {
        showSearchInfo(query, results);
    }
    
    // Create result elements
    results.forEach((result, index) => {
        const resultElement = createResultElement(result, index + 1);
        resultsContainer.appendChild(resultElement);
    });
}

// Create individual result element
function createResultElement(result, rank) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    const titleElement = document.createElement('h3');
    titleElement.className = 'result-title';
    titleElement.textContent = result.title || 'Untitled';
    
    const filenameElement = document.createElement('div');
    filenameElement.className = 'result-filename';
    filenameElement.textContent = `📄 ${result.filename}`;
    
    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'result-description';
    descriptionElement.textContent = result.metaDescription || 'No description available.';
    
    // Show matched variations if available
    if (result.matchedVariations && result.matchedVariations.length > 0) {
        const variationsElement = document.createElement('div');
        variationsElement.className = 'matched-variations';
        variationsElement.innerHTML = `
            <small><strong>Matched terms:</strong> ${result.matchedVariations.join(', ')}</small>
        `;
        descriptionElement.appendChild(variationsElement);
    }
    
    const scoreContainer = document.createElement('div');
    scoreContainer.className = 'result-score';
    
    const scoreMain = document.createElement('span');
    scoreMain.className = 'score-main';
    scoreMain.textContent = `Rank #${rank} - Total Score: ${result.totalScore}`;
    
    const scoreBreakdown = document.createElement('div');
    scoreBreakdown.className = 'score-breakdown';
    
    if (result.breakdown) {
        const breakdown = result.breakdown;
        scoreBreakdown.innerHTML = `
            <span class="score-item">Title: +${breakdown.titleScore}</span>
            <span class="score-item">Description: +${breakdown.descriptionScore}</span>
            <span class="score-item">Frequency: +${breakdown.frequencyScore}</span>
            <span class="score-item">Backlinks: +${breakdown.backlinkScore}</span>
        `;
    }
    
    scoreContainer.appendChild(scoreMain);
    scoreContainer.appendChild(scoreBreakdown);
    
    // Assemble the result element
    resultDiv.appendChild(titleElement);
    resultDiv.appendChild(filenameElement);
    resultDiv.appendChild(descriptionElement);
    resultDiv.appendChild(scoreContainer);
    
    return resultDiv;
}

// Show search info with variations
function showSearchInfo(query, results) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'search-info-results';
    infoDiv.innerHTML = `
        <p><strong>Search results for:</strong> "${query}" 
        <small>(including related forms like plurals, past tense, etc.)</small></p>
        <p><strong>Found ${results.length} matching pages</strong></p>
    `;
    resultsContainer.appendChild(infoDiv);
}

// Show loading state
function showLoading() {
    resultsContainer.innerHTML = `
        <div class="loading">
            <p>🔍 Searching...</p>
        </div>
    `;
}

// Show no results message
function showNoResults(query) {
    resultsContainer.innerHTML = `
        <div class="no-results">
            <h3>No Results Found</h3>
            <p>Sorry, no pages were found for "${query}". Try different keywords like "healthy", "recipes", "fitness", or "exercise".</p>
        </div>
    `;
}

// Show general message
function showMessage(message, type = 'info') {
    const messageClass = type === 'error' ? 'no-results' : 'loading';
    resultsContainer.innerHTML = `
        <div class="${messageClass}">
            <p>${message}</p>
        </div>
    `;
}

// Add some example searches for demonstration
document.addEventListener('DOMContentLoaded', function() {
    // You could add example search buttons here if desired
    console.log('Search engine demo ready!');
    console.log('Try searching for: healthy, recipes, fitness, exercise, nutrition, quick');
});