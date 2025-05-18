document.addEventListener('DOMContentLoaded', () => {
  console.log('Landing page loaded');

  // Add handler for Google OAuth login
  const googleLoginButton = document.getElementById('googleLoginButton');
  if (googleLoginButton) {
    googleLoginButton.addEventListener('click', () => {
      window.location.href = 'https://fantasy-back.onrender.com/auth/google';
    });
  }

  // Add handler for guest mode
  const guestModeButton = document.getElementById('guestModeButton');
  if (guestModeButton) {
    guestModeButton.addEventListener('click', enterGuestMode);
  }

  // Add handler for logout
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
