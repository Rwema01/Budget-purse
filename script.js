const apiKey = "KT6TU4ZRLONF8KVR"; // Alpha Vantage API key
let refreshInterval; // Store the interval reference

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const financialData = document.getElementById('financial-data');
    const descriptionInput = document.getElementById('description');
    const amountInput = document.getElementById('amount');

    // Initialize app
    loadExpenses();
    fetchRealTimeFinancialData();
    
    // Start periodic refresh (every 5 minutes)
    startAutoRefresh(300000); // 300000ms = 5 minutes

    // Event Listeners
    expenseForm.addEventListener('submit', handleFormSubmit);

    // Functions
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const description = descriptionInput.value.trim();
        const amount = parseFloat(amountInput.value).toFixed(2);
        
        if (!description.match(/^[A-Za-z ]+$/)) {
            alert('Payment Note can only contain letters and spaces');
            return;
        }
        
        if (!description || isNaN(amount)) {
            alert('Please enter valid description and amount');
            return;
        }
        
        addExpense(description, amount);
        expenseForm.reset();
        descriptionInput.focus();
        
        // Refresh financial data after adding expense
        fetchRealTimeFinancialData();
    }

    function addExpense(description, amount) {
        const expenseItem = document.createElement('li');
        expenseItem.className = 'expense-item';
        expenseItem.innerHTML = `
            <span class="expense-description">${description}</span>
            <span class="expense-amount">$${amount}</span>
            <button class="delete-btn" aria-label="Delete expense">×</button>
        `;

        const deleteBtn = expenseItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete "${description}" expense?`)) {
                expenseItem.classList.add('fade-out');
                setTimeout(() => {
                    expenseItem.remove();
                    saveExpenses();
                }, 200);
            }
        });

        expenseList.appendChild(expenseItem);
        saveExpenses();
    }

    function saveExpenses() {
        const expenses = [];
        document.querySelectorAll('#expense-list li').forEach(li => {
            expenses.push({
                description: li.querySelector('.expense-description').textContent,
                amount: li.querySelector('.expense-amount').textContent.replace('$', '')
            });
        });
        localStorage.setItem('expenses', JSON.stringify(expenses));
    }

    function loadExpenses() {
        const saved = JSON.parse(localStorage.getItem('expenses')) || [];
        saved.forEach(exp => {
            addExpense(exp.description, exp.amount);
        });
    }

    // Auto-refresh functionality
    function startAutoRefresh(interval) {
        // Clear any existing interval
        if (refreshInterval) clearInterval(refreshInterval);
        
        // Set new interval
        refreshInterval = setInterval(fetchRealTimeFinancialData, interval);
        
        // Also refresh when window gains focus
        window.addEventListener('focus', fetchRealTimeFinancialData);
    }

    async function fetchRealTimeFinancialData() {
        try {
            financialData.innerHTML = '<div class="loading">Loading market data...</div>';
            
            const { cachedData, shouldUseCache } = checkFinancialDataCache();
            if (shouldUseCache) {
                displayFinancialData(cachedData);
            }
            
            // Always try to fetch fresh data but fall back to cache if needed
            try {
                const data = await fetchStockData();
                cacheFinancialData(data);
                displayFinancialData(data);
            } catch (fetchError) {
                console.error("Fetch error:", fetchError);
                if (!shouldUseCache) throw fetchError;
                // Otherwise we'll use the cached data we already displayed
            }
            
        } catch (error) {
            handleFinancialDataError(error);
        }
    }

    function checkFinancialDataCache() {
        const cachedData = localStorage.getItem('msftStockData');
        const cachedTime = localStorage.getItem('msftStockDataTime');
        const isCacheValid = cachedData && cachedTime && 
                           (Date.now() - parseInt(cachedTime)) < 300000; // 5 minutes
        
        return {
            cachedData: isCacheValid ? JSON.parse(cachedData) : null,
            shouldUseCache: isCacheValid
        };
    }

    async function fetchStockData() {
        const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${apiKey}`
        );
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        
        if (data.Note) throw new Error("API rate limit reached");
        if (data['Error Message']) throw new Error(data['Error Message']);
        if (!data['Global Quote']?.['05. price']) throw new Error("Invalid data format");
        
        return data;
    }

    function cacheFinancialData(data) {
        localStorage.setItem('msftStockData', JSON.stringify(data));
        localStorage.setItem('msftStockDataTime', Date.now().toString());
    }

    function displayFinancialData(data) {
        const quote = data['Global Quote'];
        const price = parseFloat(quote['05. price']).toFixed(4);
        const change = parseFloat(quote['09. change']).toFixed(4);
        const changePercent = quote['10. change percent'];
        const timestamp = new Date().toLocaleString();
        
        const changeColor = change >= 0 ? 'positive' : 'negative';
        
        financialData.innerHTML = `
            <div class="stock-info">
                <h3>MSFT Stock</h3>
                <p class="stock-price">$${price}</p>
                <p class="stock-change ${changeColor}">
                    ${change >= 0 ? '+' : ''}${change} (${changePercent})
                </p>
                <p class="stock-update">Updated: ${timestamp}</p>
            </div>
        `;
    }

    function handleFinancialDataError(error) {
        console.error("Financial data error:", error);
        
        const cachedData = localStorage.getItem('msftStockData');
        if (cachedData) {
            displayFinancialData(JSON.parse(cachedData));
            financialData.innerHTML = `
                <div class="warning">
                    <p>⚠️ Using cached data (last updated: ${new Date(parseInt(localStorage.getItem('msftStockDataTime'))).toLocaleString()})</p>
                    ${financialData.innerHTML}
                </div>
            `;
        } else {
            financialData.innerHTML = `
                <div class="error">
                    <p>⚠️ Could not load financial data</p>
                    <p class="error-detail">${error.message}</p>
                    <button onclick="fetchRealTimeFinancialData()">Retry</button>
                </div>
            `;
        }
    }
});

// Make refresh function available globally for manual refresh
function manualRefresh() {
    fetchRealTimeFinancialData();
}