const API_BASE_URL = 'https://fantasy-back-1.onrender.com';

document.addEventListener('DOMContentLoaded', loadPortfolio);

async function loadPortfolio() {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/api/portfolio`);
    if (!response) return; // fetchWithToken handles token expiry
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load portfolio');
    const portfolioList = document.getElementById('portfolioList');
    portfolioList.innerHTML = '';
    data.forEach(stock => {
      const li = document.createElement('li');
      li.textContent = `${stock.symbol} - ${stock.quantity} shares @ $${stock.price}`;
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => deleteStock(stock._id);
      li.appendChild(deleteBtn);
      portfolioList.appendChild(li);
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function addStock() {
  const symbol = document.getElementById('symbol').value;
  const quantity = document.getElementById('quantity').value;
  const price = document.getElementById('price').value;
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/api/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, quantity, price }),
    });
    if (!response) return; // fetchWithToken handles token expiry
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to add stock');
    loadPortfolio();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteStock(id) {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/api/portfolio/${id}`, {
      method: 'DELETE',
    });
    if (!response) return; // fetchWithToken handles token expiry
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete stock');
    loadPortfolio();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Note: fetchWithToken should be defined in a shared utility file or included here if not already available
async function fetchWithToken(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 403) {
    const data = await response.json();
    if (data.error === 'Invalid or expired token') {
      alert('Your session has expired. Please log in again.');
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return null;
    }
  }
  return response;
}
