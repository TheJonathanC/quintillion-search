// DOM elements
let searchInput;
let searchInputSmall;
let searchButton;
let searchButtonSmall;
let resultsContainer;
let homeView;
let resultsView;
let resultsMain;
let terminalPanel;
let terminalToggle;
let terminalClose;
let terminalOutput;
let contentArea;

// State
let isTerminalOpen = false;
let terminalLogs = [];

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    initializeTerminal();
    
    // Focus on main search input
    if (searchInput) {
        searchInput.focus();
    }
});

function initializeElements() {
    console.log('Initializing elements...');
    
    // Search elements
    searchInput = document.getElementById('search-input');
    searchInputSmall = document.getElementById('search-input-small');
    searchButton = document.getElementById('search-button');
    searchButtonSmall = document.getElementById('search-button-small');
    
    console.log('Search elements:', {
        searchInput: !!searchInput,
        searchInputSmall: !!searchInputSmall,
        searchButton: !!searchButton,
        searchButtonSmall: !!searchButtonSmall
    });
    
    // Layout elements
    resultsContainer = document.getElementById('results-container');
    homeView = document.getElementById('home-view');
    resultsView = document.getElementById('results-view');
    resultsMain = document.querySelector('.results-main');
    contentArea = document.querySelector('.content-area');
    
    console.log('Layout elements:', {
        resultsContainer: !!resultsContainer,
        homeView: !!homeView,
        resultsView: !!resultsView,
        resultsMain: !!resultsMain,
        contentArea: !!contentArea
    });
    
    // Terminal elements
    terminalPanel = document.getElementById('terminal-panel');
    terminalToggle = document.getElementById('terminal-toggle');
    terminalClose = document.getElementById('terminal-close');
    terminalOutput = document.getElementById('terminal-output');
    
    // Home debug button
    const homeTerminalToggle = document.getElementById('home-terminal-toggle');
    
    console.log('Terminal elements:', {
        terminalPanel: !!terminalPanel,
        terminalToggle: !!terminalToggle,
        terminalClose: !!terminalClose,
        terminalOutput: !!terminalOutput,
        homeTerminalToggle: !!homeTerminalToggle
    });
    
    console.log('Elements initialized');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Main search functionality
    if (searchButton) searchButton.addEventListener('click', performSearch);
    if (searchButtonSmall) searchButtonSmall.addEventListener('click', performSearch);
    
    // Enter key support
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    if (searchInputSmall) {
        searchInputSmall.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Terminal controls
    if (terminalToggle) {
        console.log('Terminal toggle button found, adding event listener');
        terminalToggle.addEventListener('click', function(e) {
            console.log('Terminal toggle clicked!');
            toggleTerminal();
        });
    } else {
        console.log('Terminal toggle button NOT found!');
    }
    
    // Home terminal toggle
    const homeTerminalToggle = document.getElementById('home-terminal-toggle');
    if (homeTerminalToggle) {
        console.log('Home terminal toggle button found, adding event listener');
        homeTerminalToggle.addEventListener('click', function(e) {
            console.log('Home terminal toggle clicked!');
            toggleTerminal();
        });
    } else {
        console.log('Home terminal toggle button NOT found!');
    }
    
    if (terminalClose) {
        console.log('Terminal close button found, adding event listener');
        terminalClose.addEventListener('click', function(e) {
            console.log('Terminal close clicked!');
            closeTerminal();
        });
    } else {
        console.log('Terminal close button NOT found!');
    }
    
    // Logo click to go home
    const logoSmall = document.querySelector('.logo-small');
    if (logoSmall) {
        logoSmall.addEventListener('click', goHome);
    }
    
    // Sync search inputs
    if (searchInput && searchInputSmall) {
        searchInput.addEventListener('input', function() {
            searchInputSmall.value = searchInput.value;
        });
        
        searchInputSmall.addEventListener('input', function() {
            searchInput.value = searchInputSmall.value;
        });
    }
    
    console.log('Event listeners setup complete');
}

function initializeTerminal() {
    addTerminalLog('Quintillion Search Engine initialized', 'info');
    addTerminalLog('Ready to process search queries', 'info');
}

function addTerminalLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        message,
        type
    };
    
    terminalLogs.push(logEntry);
    
    if (terminalOutput) {
        const logLine = document.createElement('div');
        logLine.className = 'terminal-line';
        
        logLine.innerHTML = `<span class="terminal-timestamp">[${timestamp}]</span> <span class="terminal-${type}">${message}</span>`;
        
        terminalOutput.appendChild(logLine);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
}

async function performSearch() {
    const query = getCurrentQuery();
    
    if (!query) {
        showMessage('Please enter a search term', 'error');
        return;
    }
    
    // Show results view
    showResultsView();
    
    // Add terminal logs
    addTerminalLog(`Search query: "${query}"`, 'debug');
    addTerminalLog('Processing search request...', 'info');
    
    // Show loading state
    showLoading();
    
    try {
        addTerminalLog('Sending API request to /search endpoint', 'debug');
        
        const startTime = Date.now();
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        const endTime = Date.now();
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const searchTime = endTime - startTime;
        
        addTerminalLog(`Search completed in ${searchTime}ms`, 'info');
        addTerminalLog(`Found ${data.results ? data.results.length : 0} results`, 'info');
        
        if (data.results && data.results.length > 0) {
            data.results.forEach((result, index) => {
                addTerminalLog(`Result ${index + 1}: ${result.filename} (score: ${result.totalScore})`, 'debug');
            });
        }
        
        // Display results
        displayResults(data.results || [], query, searchTime);
        
    } catch (error) {
        console.error('Search error:', error);
        addTerminalLog(`Search error: ${error.message}`, 'error');
        showMessage('An error occurred while searching. Please try again.', 'error');
    }
}

function getCurrentQuery() {
    if (isResultsViewVisible()) {
        return searchInputSmall ? searchInputSmall.value.trim() : '';
    } else {
        return searchInput ? searchInput.value.trim() : '';
    }
}

function isResultsViewVisible() {
    return resultsView && !resultsView.classList.contains('hidden');
}

function showResultsView() {
    if (homeView) homeView.classList.add('hidden');
    if (resultsView) resultsView.classList.remove('hidden');
    
    // Sync search input values
    if (searchInput && searchInputSmall) {
        searchInputSmall.value = searchInput.value;
    }
}

function goHome() {
    if (resultsView) resultsView.classList.add('hidden');
    if (homeView) homeView.classList.remove('hidden');
    if (searchInput) searchInput.focus();
    
    // Clear results
    if (resultsContainer) resultsContainer.innerHTML = '';
    
    addTerminalLog('Returned to home page', 'info');
}

function displayResults(results, query, searchTime) {
    if (!resultsContainer) return;
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Show results info
    const resultsInfo = document.querySelector('.results-info');
    if (resultsInfo) {
        const resultCount = results.length;
        resultsInfo.textContent = `About ${resultCount} results (${(searchTime / 1000).toFixed(2)} seconds)`;
    }
    
    if (results.length === 0) {
        showNoResults(query);
        return;
    }
    
    // Create result elements
    results.forEach((result, index) => {
        const resultElement = createResultElement(result, index + 1);
        resultsContainer.appendChild(resultElement);
    });
}

function createResultElement(result, rank) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    const titleElement = document.createElement('h3');
    titleElement.className = 'result-title';
    titleElement.textContent = result.title || 'Untitled';
    
    const urlElement = document.createElement('div');
    urlElement.className = 'result-url';
    urlElement.textContent = `sample-pages/${result.filename}`;
    
    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'result-description';
    descriptionElement.textContent = result.metaDescription || 'No description available.';
    
    const scoreContainer = document.createElement('div');
    scoreContainer.className = 'result-score';
    
    const scoreMain = document.createElement('span');
    scoreMain.className = 'score-main';
    scoreMain.textContent = `Total Score: ${result.totalScore}`;
    
    const scoreBreakdown = document.createElement('div');
    scoreBreakdown.className = 'score-breakdown';
    
    if (result.breakdown) {
        const breakdown = result.breakdown;
        scoreBreakdown.innerHTML = `
            <span class="score-item">Title: +${breakdown.titleScore}</span>
            <span class="score-item">Description: +${breakdown.descriptionScore}</span>
            <span class="score-item">Content: +${breakdown.frequencyScore}</span>
            <span class="score-item">Authority: +${breakdown.backlinkScore}</span>
        `;
    }
    
    scoreContainer.appendChild(scoreMain);
    scoreContainer.appendChild(scoreBreakdown);
    
    // Assemble the result element
    resultDiv.appendChild(titleElement);
    resultDiv.appendChild(urlElement);
    resultDiv.appendChild(descriptionElement);
    resultDiv.appendChild(scoreContainer);
    
    return resultDiv;
}

function showLoading() {
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="loading">
            <p>Searching...</p>
        </div>
    `;
    
    // Clear results info
    const resultsInfo = document.querySelector('.results-info');
    if (resultsInfo) {
        resultsInfo.textContent = '';
    }
}

function showNoResults(query) {
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="no-results">
            <h3>No results found</h3>
            <p>Your search - <strong>${query}</strong> - did not match any documents.</p>
            <p>Try different keywords or check your spelling.</p>
        </div>
    `;
}

function showMessage(message, type = 'info') {
    if (!resultsContainer) return;
    
    const messageClass = type === 'error' ? 'no-results' : 'loading';
    resultsContainer.innerHTML = `
        <div class="${messageClass}">
            <p>${message}</p>
        </div>
    `;
}

// Terminal functionality
function toggleTerminal() {
    console.log('toggleTerminal called, isTerminalOpen:', isTerminalOpen);
    console.log('terminalPanel:', terminalPanel);
    console.log('resultsMain:', resultsMain);
    
    if (isTerminalOpen) {
        closeTerminal();
    } else {
        openTerminal();
    }
}

function openTerminal() {
    console.log('openTerminal called');
    
    if (!terminalPanel || !resultsMain) {
        console.error('Missing terminal elements:', { terminalPanel: !!terminalPanel, resultsMain: !!resultsMain });
        return;
    }
    
    console.log('Opening terminal panel...');
    // Remove hidden class first to make element visible for animation
    terminalPanel.classList.remove('hidden');
    // Use setTimeout to ensure the element is rendered before starting animation
    setTimeout(() => {
        terminalPanel.classList.add('visible');
    }, 10);
    
    resultsMain.classList.add('terminal-open');
    isTerminalOpen = true;
    
    addTerminalLog('Debug terminal opened', 'info');
    
    // Adjust content area margin
    setTimeout(() => {
        if (contentArea && terminalPanel) {
            const terminalWidth = terminalPanel.offsetWidth;
            contentArea.style.marginRight = terminalWidth + 'px';
            console.log('Set content margin to:', terminalWidth + 'px');
        }
    }, 50);
}

function closeTerminal() {
    console.log('closeTerminal called');
    
    if (!terminalPanel || !resultsMain) {
        console.error('Missing terminal elements for close:', { terminalPanel: !!terminalPanel, resultsMain: !!resultsMain });
        return;
    }
    
    console.log('Closing terminal panel...');
    terminalPanel.classList.remove('visible');
    resultsMain.classList.remove('terminal-open');
    isTerminalOpen = false;
    
    // Reset content area margin
    if (contentArea) {
        contentArea.style.marginRight = '0';
    }
    
    // Add hidden class after animation completes
    setTimeout(() => {
        if (!isTerminalOpen) {
            terminalPanel.classList.add('hidden');
        }
    }, 300); // Match the CSS transition duration
    
    addTerminalLog('Debug terminal closed', 'info');
}

// Handle terminal resizing
let isResizing = false;

if (terminalPanel) {
    const resizeHandle = terminalPanel.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', initResize);
    }
}

function initResize(e) {
    isResizing = true;
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
}

function doResize(e) {
    if (!isResizing || !terminalPanel || !contentArea) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 300;
    const maxWidth = window.innerWidth * 0.6;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
        terminalPanel.style.width = newWidth + 'px';
        contentArea.style.marginRight = newWidth + 'px';
    }
}

function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

// Debug: Add some sample terminal logs on startup
setTimeout(() => {
    addTerminalLog('Sample pages indexed: 19 files', 'debug');
    addTerminalLog('Inverted index contains 408+ unique terms', 'debug');
    addTerminalLog('Stemming algorithm active for word variations', 'debug');
}, 1000);