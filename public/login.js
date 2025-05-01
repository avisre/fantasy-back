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

function enterGuestMode() {
  localStorage.setItem("guestMode", "true");
  localStorage.setItem("guestPortfolioCount", "0");
  localStorage.setItem("guestAnalysisCount", "0");
  window.location.href = "/index.html";
}