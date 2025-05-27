document.addEventListener('DOMContentLoaded', () => {
  console.log('Login page loaded');

  // Add handler for Google OAuth login
  const googleLoginButton = document.getElementById('googleLoginButton');
  if (googleLoginButton) {
    googleLoginButton.addEventListener('click', () => {
      window.location.href = 'https://fantasy-back-1.onrender.com/auth/google';
    });
  }

  // Add handler for Twitter OAuth login
  const twitterLoginButton = document.getElementById('twitterLoginButton');
  if (twitterLoginButton) {
    twitterLoginButton.addEventListener('click', () => {
      window.location.href = 'https://fantasy-back-1.onrender.com/auth/twitter';
    });
  }

  // Add handler for guest mode
  const guestModeButton = document.getElementById('guestModeButton');
  if (guestModeButton) {
    guestModeButton.addEventListener('click', enterGuestMode);
  }

  // Add handler for logout (if present)
  const logoutButton = document.querySelector('.logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem("token");
      localStorage.removeItem("guestMode");
      localStorage.removeItem("guestPortfolioCount");
      localStorage.removeItem("guestAnalysisCount");
      localStorage.removeItem("guestId");
      window.location.href = "/login.html";
    });
  }
});

// Global fetch wrapper to handle token expiry
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

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const response = await fetch("https://fantasy-back-1.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }
    localStorage.setItem("token", data.token);
    window.location.href = "/dashboard.html";
  } catch (error) {
    alert("Error: " + error.message);
  }
}

function enterGuestMode() {
  localStorage.setItem("guestMode", "true");
  localStorage.setItem("guestPortfolioCount", "0");
  localStorage.setItem("guestAnalysisCount", "0");
  window.location.href = "/dashboard.html";
}
