const API_BASE_URL = "https://fantasy-back-1.onrender.com"; // Replace with your backend URL

async function fetchNews() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/news`, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token") || guestId}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
      }
      throw new Error("Failed to fetch news");
    }
    const newsData = await response.json();
    displayNews(newsData);
  } catch (error) {
    console.error("Error fetching news:", error);
    document.getElementById("newsList").innerHTML =
      "<p>Failed to load news. Please try again later.</p>";
  }
}

// Existing displayNews function remains unchanged

function displayNews(newsData) {
  const newsList = document.getElementById("newsList");
  newsList.innerHTML = "";
  newsData.forEach((article) => {
    const newsItem = document.createElement("div");
    newsItem.classList.add("news-item");
    newsItem.innerHTML = `
      <h3>${article.title}</h3>
      <p>${article.summary}</p>
      <a href="${article.url}" target="_blank">Read more</a>
      <div class="news-date">${new Date(article.time_published).toLocaleDateString()}</div>
    `;
    newsList.appendChild(newsItem);
  });
}

fetchNews();
