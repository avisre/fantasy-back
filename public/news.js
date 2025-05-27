let allNews = [];
let selectedTopics = new Set();

function truncateText(text, maxLength = 300) {
  if (text && text.length <= maxLength) return text;
  return text ? text.slice(0, maxLength) + "..." : "";
}

function formatPublishedTime(time) {
  if (!time) return "Unknown time";
  const year = time.substring(0, 4);
  const month = time.substring(4, 6);
  const day = time.substring(6, 8);
  const hour = time.substring(9, 11);
  const minute = time.substring(11, 13);
  const second = time.substring(13, 15);
  const isoTime = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const date = new Date(isoTime);
  if (isNaN(date)) return "Invalid time";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function fetchNews() {
  const tickers = document.getElementById("tickers").value.trim();
  const topics = Array.from(selectedTopics).join(",");
  let url = "/api/news";
  const params = new URLSearchParams();
  if (tickers) params.append("tickers", tickers);
  if (topics) params.append("topics", topics);
  if (tickers || topics) url += `?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || "guest_" + Math.random().toString(36).substring(2)}`,
      },
    });
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.feed)
      throw new Error(
        data["Error Message"] ||
          data["Information"] ||
          "Failed to fetch news"
      );
    allNews = data.feed;
    displayNews(allNews);
  } catch (error) {
    console.error("Error fetching news:", error);
    document.getElementById("newsList").innerHTML =
      "<p>Failed to load news. Please try again later.</p>";
    document.getElementById("heroArticle").innerHTML =
      "<p>Failed to load latest news.</p>";
  }
}

function displayNews(newsData) {
  const heroArticle = document.getElementById("heroArticle");
  const newsList = document.getElementById("newsList");
  heroArticle.innerHTML = "";
  newsList.innerHTML = "";

  if (newsData.length > 0) {
    const hero = newsData[0];
    const formattedTime = formatPublishedTime(hero.time_published);
    heroArticle.innerHTML = `
      <div class="hero-image-container">
        <img src="${
          hero.banner_image || "https://via.placeholder.com/600x400"
        }" alt="${hero.title || "News Image"}" loading="lazy">
      </div>
      <div class="hero-content">
        <h3><a href="${
          hero.url || "#"
        }" target="_blank" rel="noopener noreferrer">${
          hero.title || "No Title"
        }</a></h3>
        <p>${truncateText(hero.summary)}</p>
        <a href="${
          hero.url || "#"
        }" target="_blank" rel="noopener noreferrer">Read more</a>
        <div class="news-time">Published: ${formattedTime}</div>
      </div>
    `;

    newsData.slice(1).forEach((article) => {
      const formattedTime = formatPublishedTime(article.time_published);
      const newsItem = document.createElement("div");
      newsItem.classList.add("news-item");
      newsItem.innerHTML = `
        <div class="image-container">
          <img src="${
            article.banner_image || "https://via.placeholder.com/300x200"
          }" alt="${article.title || "News Image"}" loading="lazy">
        </div>
        <div class="content">
          <h3><a href="${
            article.url || "#"
          }" target="_blank" rel="noopener noreferrer">${
            article.title || "No Title"
          }</a></h3>
          <p>${truncateText(article.summary)}</p>
          <a href="${
            article.url || "#"
          }" target="_blank" rel="noopener noreferrer">Read more</a>
          <div class="news-time">Published: ${formattedTime}</div>
        </div>
      `;
      newsList.appendChild(newsItem);
    });
  } else {
    heroArticle.innerHTML = "<p>No news found.</p>";
    newsList.innerHTML = "<p>No news found.</p>";
  }
}

function navigateTo(page) {
  alert(`Navigating to ${page}`);
}

function toggleTopic(event) {
  const topic = event.target.dataset.topic;
  if (selectedTopics.has(topic)) {
    selectedTopics.delete(topic);
    event.target.classList.remove("active");
  } else {
    selectedTopics.add(topic);
    event.target.classList.add("active");
  }
}

document.querySelectorAll(".topic").forEach((button) => {
  button.addEventListener("click", toggleTopic);
});

document
  .getElementById("apply-filters")
  .addEventListener("click", fetchNews);
document.addEventListener("DOMContentLoaded", fetchNews);
