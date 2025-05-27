const API_BASE_URL = "https://fantasy-back-1.onrender.com";

let priceChart, financialBarChart, portfolioDoughnut;
let portfolio = [];
let financialTab = "income";
let financialPeriod = "5year";
let fundamentalsData = {};
let financialUnit = "billions";
let isGuestMode = false;
let guestId = null;

// Generate a unique guest ID if not already present
function generateGuestId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `guest_${timestamp}_${random}`;
}

// Initialize authentication
const token =
  localStorage.getItem("token") ||
  new URLSearchParams(window.location.search).get("token");

if (!token) {
  isGuestMode = true;
  localStorage.setItem("guestMode", "true");
  document.getElementById("guestNotice").style.display = "block";
  if (!localStorage.getItem("guestId")) {
    guestId = generateGuestId();
    localStorage.setItem("guestId", guestId);
  } else {
    guestId = localStorage.getItem("guestId");
  }
} else {
  isGuestMode = false;
  localStorage.setItem("token", token);
  localStorage.removeItem("guestMode");
  window.history.replaceState({}, document.title, "/dashboard.html");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("guestMode");
  localStorage.removeItem("guestPortfolioCount");
  localStorage.removeItem("guestAnalysisCount");
  localStorage.removeItem("guestId");
  window.location.href = "/login.html";
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function filterLastNYears(prices, years) {
  const currentDate = new Date("2025-04-23");
  const cutoffDate = new Date(currentDate);
  cutoffDate.setFullYear(currentDate.getFullYear() - years);
  return prices.filter((p) => new Date(p.date) >= cutoffDate);
}

function initPriceChart(data = [], labels = []) {
  if (priceChart) priceChart.destroy();
  const period = document.getElementById("pricePeriod").value;
  let labelStep;
  if (period === "1year") {
    labelStep = Math.ceil(labels.length / 12);
  } else if (period === "5year") {
    labelStep = Math.ceil(labels.length / 5);
  } else {
    labelStep = Math.ceil(labels.length / 10);
  }

  const filteredLabels = labels
    .filter((_, index) => index % labelStep === 0)
    .map((label) => formatDate(label));
  const filteredData = data.filter((_, index) => index % labelStep === 0);

  priceChart = new Chart(
    document.getElementById("priceChart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: filteredLabels,
        datasets: [
          {
            label: "Price ($)",
            data: filteredData,
            borderColor: "#F0B90B",
            backgroundColor: "rgba(240, 185, 11, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#D3D5DB" } } },
        scales: {
          x: {
            grid: { color: "#3A3E4A" },
            ticks: { color: "#D3D5DB", maxRotation: 45, minRotation: 45 },
          },
          y: {
            grid: { color: "#3A3E4A" },
            ticks: { color: "#D3D5DB" },
            beginAtZero: false,
          },
        },
      },
    }
  );
}

function initFinancialBarChart(data) {
  if (financialBarChart) financialBarChart.destroy();
  const scaleFactor = financialUnit === "billions" ? 1000 : 1;
  const unitLabel = financialUnit === "billions" ? "$B" : "$M";
  let datasets = [];

  if (financialTab === "income") {
    datasets = [
      {
        label: `Revenue (${unitLabel})`,
        data: data.revenue.map((val) => val / scaleFactor),
        backgroundColor: "#F0B90B",
      },
      {
        label: `Net Income (${unitLabel})`,
        data: data.netIncome.map((val) => val / scaleFactor),
        backgroundColor: "#28a745",
      },
      {
        label: `Net Debt (${unitLabel})`,
        data: data.netDebt.map((val) => val / scaleFactor),
        backgroundColor: "#dc3545",
      },
    ];
  } else if (financialTab === "balance") {
    datasets = [
      {
        label: `Total Assets (${unitLabel})`,
        data: data.totalAssets.map((val) => val / scaleFactor),
        backgroundColor: "#F0B90B",
      },
      {
        label: `Total Liabilities (${unitLabel})`,
        data: data.totalLiabilities.map((val) => val / scaleFactor),
        backgroundColor: "#dc3545",
      },
      {
        label: `Cash on Hand (${unitLabel})`,
        data: data.cashOnHand.map((val) => val / scaleFactor),
        backgroundColor: "#28a745",
      },
    ];
  } else {
    datasets = [
      {
        label: `Investing Cash Flow (${unitLabel})`,
        data: data.investingCashFlow.map((val) => val / scaleFactor),
        backgroundColor: "#F0B90B",
      },
      {
        label: `Financing Cash Flow (${unitLabel})`,
        data: data.financingCashFlow.map((val) => val / scaleFactor),
        backgroundColor: "#dc3545",
      },
      {
        label: `Free Cash Flow (${unitLabel})`,
        data: data.freeCashFlow.map((val) => val / scaleFactor),
        backgroundColor: "#28a745",
      },
    ];
  }

  financialBarChart = new Chart(
    document.getElementById("financialBarChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: data.labels,
        datasets,
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#D3D5DB" } } },
        scales: {
          y: { grid: { color: "#3A3E4A" }, ticks: { color: "white" } },
          x: { grid: { color: "#3A3E4A" }, ticks: { color: "white" } },
        },
      },
    }
  );
}

function initPortfolioDoughnut(companies, values) {
  if (portfolioDoughnut) portfolioDoughnut.destroy();
  portfolioDoughnut = new Chart(
    document.getElementById("portfolioDoughnut").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels: companies,
        datasets: [
          {
            data: values,
            backgroundColor: [
              "#F0B90B",
              "#28a745",
              "#dc3545",
              "#17a2b8",
              "#ffc107",
            ],
            borderColor: "#2c2f3a",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#D3D5DB", font: { size: 14 } } },
          tooltip: {
            backgroundColor: "#2c2f3a",
            titleColor: "#D3D5DB",
            bodyColor: "#D3D5DB",
            borderColor: "#3A3E4A",
            borderWidth: 1,
          },
        },
      },
    }
  );
}

async function fetchSuggestions(inputId, suggestionsId) {
  const query = document.getElementById(inputId).value;
  const suggestionsDiv = document.getElementById(suggestionsId);
  suggestionsDiv.style.display = "none";
  suggestionsDiv.innerHTML = "";

  if (query.length <= 2) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/stock/symbol-search?keywords=${query}`
    );
    if (response.status === 401 || response.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const data = await response.json();
    if (data["bestMatches"] && data["bestMatches"].length > 0) {
      const suggestions = data["bestMatches"]
        .slice(0, 5)
        .map((match) => ({
          symbol: match["1. symbol"],
          name: match["2. name"],
        }));
      suggestionsDiv.innerHTML = suggestions
        .map(
          (s) => `
        <div class="suggestion-item" onclick="selectSuggestion('${s.symbol}', '${inputId}', '${suggestionsId}')">${s.symbol} - ${s.name}</div>
      `
        )
        .join("");
      suggestionsDiv.style.display = "block";
    }
  } catch (error) {
    console.error("Error fetching suggestions:", error);
  }
}

function selectSuggestion(symbol, inputId, suggestionsId) {
  document.getElementById(inputId).value = symbol;
  document.getElementById(suggestionsId).style.display = "none";
}

async function fetchFundamentals() {
  if (isGuestMode) {
    let analysisCount = parseInt(localStorage.getItem("guestAnalysisCount") || "0");
    if (analysisCount >= 5) {
      alert("Guest mode limit reached: You can only analyze 5 companies.");
      return;
    }
    analysisCount++;
    localStorage.setItem("guestAnalysisCount", analysisCount);
  }

  const symbol = document
    .getElementById("companySearch")
    .value.toUpperCase();
  if (!symbol) return alert("Enter a company symbol");

  try {
    const overviewRes = await fetch(
      `${API_BASE_URL}/api/stock/overview?symbol=${symbol}`
    );
    if (overviewRes.status === 401 || overviewRes.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const overview = await overviewRes.json();
    if (overview["Error Message"] || !overview["Symbol"])
      throw new Error("Invalid symbol");

    const incomeRes = await fetch(
      `${API_BASE_URL}/api/stock/income-statement?symbol=${symbol}`
    );
    if (incomeRes.status === 401 || incomeRes.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const incomeData = await incomeRes.json();

    const balanceRes = await fetch(
      `${API_BASE_URL}/api/stock/balance-sheet?symbol=${symbol}`
    );
    if (balanceRes.status === 401 || balanceRes.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const balanceData = await balanceRes.json();

    const cashFlowRes = await fetch(
      `${API_BASE_URL}/api/stock/cash-flow?symbol=${symbol}`
    );
    if (cashFlowRes.status === 401 || cashFlowRes.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const cashFlowData = await cashFlowRes.json();

    fundamentalsData = {
      price: overview["50DayMovingAverage"] || "N/A",
      pe: overview["PERatio"] || "N/A",
      eps: overview["EPS"] || "N/A",
      marketCap: overview["MarketCapitalization"]
        ? (overview["MarketCapitalization"] / 1e6).toFixed(2) + "M"
        : "N/A",
      dividendYield: overview["DividendYield"] || "N/A",
      financials: {
        yearly: {
          income: {},
          balance: {},
          cashflow: {},
        },
        quarterly: {
          income: {},
          balance: {},
          cashflow: {},
        },
      },
    };

    if (
      incomeData.annualReports &&
      balanceData.annualReports &&
      cashFlowData.annualReports
    ) {
      incomeData.annualReports.forEach((incomeReport) => {
        const year = incomeReport.fiscalDateEnding.split("-")[0];
        const balanceReport = balanceData.annualReports.find(
          (b) => b.fiscalDateEnding === incomeReport.fiscalDateEnding
        );
        const cashFlowReport = cashFlowData.annualReports.find(
          (c) => c.fiscalDateEnding === incomeReport.fiscalDateEnding
        );
        if (balanceReport && cashFlowReport) {
          const revenue = parseFloat(incomeReport.totalRevenue) / 1e6;
          const netIncome = parseFloat(incomeReport.netIncome) / 1e6;
          const totalDebt =
            parseFloat(balanceReport.totalLiabilities) / 1e6;
          const cash =
            parseFloat(
              balanceReport.cashAndCashEquivalentsAtCarryingValue
            ) / 1e6;
          const netDebt = totalDebt - cash;

          const totalAssets = parseFloat(balanceReport.totalAssets) / 1e6;
          const totalLiabilities =
            parseFloat(balanceReport.totalLiabilities) / 1e6;
          const cashOnHand =
            parseFloat(
              balanceReport.cashAndCashEquivalentsAtCarryingValue
            ) / 1e6;

          const investingCashFlow =
            parseFloat(cashFlowReport.cashflowFromInvestment) / 1e6;
          const financingCashFlow =
            parseFloat(cashFlowReport.cashflowFromFinancing) / 1e6;
          const operatingCashFlow =
            parseFloat(cashFlowReport.operatingCashflow) / 1e6;
          const capitalExpenditures =
            parseFloat(cashFlowReport.capitalExpenditures) / 1e6;
          const freeCashFlow = operatingCashFlow - capitalExpenditures;

          fundamentalsData.financials.yearly.income[year] = {
            revenue,
            netIncome,
            netDebt,
          };
          fundamentalsData.financials.yearly.balance[year] = {
            totalAssets,
            totalLiabilities,
            cashOnHand,
          };
          fundamentalsData.financials.yearly.cashflow[year] = {
            investingCashFlow,
            financingCashFlow,
            freeCashFlow,
          };
        }
      });
    }

    if (
      incomeData.quarterlyReports &&
      balanceData.quarterlyReports &&
      cashFlowData.quarterlyReports
    ) {
      const cutoffDate = new Date("2025-04-23");
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
      incomeData.quarterlyReports.forEach((incomeReport) => {
        const quarterDate = new Date(incomeReport.fiscalDateEnding);
        if (quarterDate >= cutoffDate) {
          const quarter = incomeReport.fiscalDateEnding;
          const balanceReport = balanceData.quarterlyReports.find(
            (b) => b.fiscalDateEnding === incomeReport.fiscalDateEnding
          );
          const cashFlowReport = cashFlowData.quarterlyReports.find(
            (c) => c.fiscalDateEnding === incomeReport.fiscalDateEnding
          );
          if (balanceReport && cashFlowReport) {
            const revenue = parseFloat(incomeReport.totalRevenue) / 1e6;
            const netIncome = parseFloat(incomeReport.netIncome) / 1e6;
            const totalDebt =
              parseFloat(balanceReport.totalLiabilities) / 1e6;
            const cash =
              parseFloat(
                balanceReport.cashAndCashEquivalentsAtCarryingValue
              ) / 1e6;
            const netDebt = totalDebt - cash;

            const totalAssets =
              parseFloat(balanceReport.totalAssets) / 1e6;
            const totalLiabilities =
              parseFloat(balanceReport.totalLiabilities) / 1e6;
            const cashOnHand =
              parseFloat(
                balanceReport.cashAndCashEquivalentsAtCarryingValue
              ) / 1e6;

            const investingCashFlow =
              parseFloat(cashFlowReport.cashflowFromInvestment) / 1e6;
            const financingCashFlow =
              parseFloat(cashFlowReport.cashflowFromFinancing) / 1e6;
            const operatingCashFlow =
              parseFloat(cashFlowReport.operatingCashflow) / 1e6;
            const capitalExpenditures =
              parseFloat(cashFlowReport.capitalExpenditures) / 1e6;
            const freeCashFlow = operatingCashFlow - capitalExpenditures;

            fundamentalsData.financials.quarterly.income[quarter] = {
              revenue,
              netIncome,
              netDebt,
            };
            fundamentalsData.financials.quarterly.balance[quarter] = {
              totalAssets,
              totalLiabilities,
              cashOnHand,
            };
            fundamentalsData.financials.quarterly.cashflow[quarter] = {
              investingCashFlow,
              financingCashFlow,
              freeCashFlow,
            };
          }
        }
      });
    }

    if (incomeData.annualReports && incomeData.annualReports.length > 0) {
      const latestIncome = incomeData.annualReports[0];
      fundamentalsData.revenue = (
        parseFloat(latestIncome.totalRevenue) / 1e6
      ).toFixed(2);
      fundamentalsData.netIncome = (
        parseFloat(latestIncome.netIncome) / 1e6
      ).toFixed(2);
    } else {
      fundamentalsData.revenue = "N/A";
      fundamentalsData.netIncome = "N/A";
    }

    if (
      balanceData.annualReports &&
      balanceData.annualReports.length > 0
    ) {
      const latestBalance = balanceData.annualReports[0];
      const totalDebt = parseFloat(latestBalance.totalLiabilities) / 1e6;
      const cash =
        parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) /
        1e6;
      fundamentalsData.netDebt = (totalDebt - cash).toFixed(2);
      fundamentalsData.totalAssets = (
        parseFloat(latestBalance.totalAssets) / 1e6
      ).toFixed(2);
      fundamentalsData.totalLiabilities = (
        parseFloat(latestBalance.totalLiabilities) / 1e6
      ).toFixed(2);
      fundamentalsData.cashOnHand = (
        parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) /
        1e6
      ).toFixed(2);
    } else {
      fundamentalsData.netDebt = "N/A";
      fundamentalsData.totalAssets = "N/A";
      fundamentalsData.totalLiabilities = "N/A";
      fundamentalsData.cashOnHand = "N/A";
    }

    if (
      cashFlowData.annualReports &&
      cashFlowData.annualReports.length > 0
    ) {
      const latestCashFlow = cashFlowData.annualReports[0];
      fundamentalsData.investingCashFlow = (
        parseFloat(latestCashFlow.cashflowFromInvestment) / 1e6
      ).toFixed(2);
      fundamentalsData.financingCashFlow = (
        parseFloat(latestCashFlow.cashflowFromFinancing) / 1e6
      ).toFixed(2);
      const operatingCashFlow =
        parseFloat(latestCashFlow.operatingCashflow) / 1e6;
      const capitalExpenditures =
        parseFloat(latestCashFlow.capitalExpenditures) / 1e6;
      fundamentalsData.freeCashFlow = (
        operatingCashFlow - capitalExpenditures
      ).toFixed(2);
    } else {
      fundamentalsData.investingCashFlow = "N/A";
      fundamentalsData.financingCashFlow = "N/A";
      fundamentalsData.freeCashFlow = "N/A";
    }

    updateFinancialTable();
    updateFinancialChart();
    await fetchPriceHistory(
      symbol,
      document.getElementById("pricePeriod").value
    );
    document.getElementById("fundamentalsResult").style.display = "block";
  } catch (error) {
    alert("Error fetching fundamentals: " + error.message);
    console.error(error);
  }
}

function updateFinancialTable() {
  const scaleFactor = financialUnit === "billions" ? 1000 : 1;
  const unit = financialUnit === "billions" ? "$B" : "$M";
  const tableBody = document.querySelector("#financialTable tbody");
  let rows = `
    <tr><td>Price ($)</td><td>${fundamentalsData.price}</td></tr>
    <tr><td>P/E Ratio</td><td>${fundamentalsData.pe}</td></tr>
    <tr><td>EPS ($)</td><td>${fundamentalsData.eps}</td></tr>
    <tr><td>Market Cap</td><td>${fundamentalsData.marketCap}</td></tr>
    <tr><td>Dividend Yield</td><td>${fundamentalsData.dividendYield}</td></tr>
  `;

  if (financialTab === "income") {
    rows += `
      <tr><td>Revenue (${unit})</td><td>${
      fundamentalsData.revenue === "N/A"
        ? "N/A"
        : (parseFloat(fundamentalsData.revenue) / scaleFactor).toFixed(2)
    }</td></tr>
      <tr><td>Net Income (${unit})</td><td>${
      fundamentalsData.netIncome === "N/A"
        ? "N/A"
        : (parseFloat(fundamentalsData.netIncome) / scaleFactor).toFixed(
            2
          )
    }</td></tr>
      <tr><td>Net Debt (${unit})</td><td>${
      fundamentalsData.netDebt === "N/A"
        ? "N/A"
        : (parseFloat(fundamentalsData.netDebt) / scaleFactor).toFixed(2)
    }</td></tr>
    `;
  } else if (financialTab === "balance") {
    rows += `
      <tr><td>Total Assets (${unit})</td><td>${
      fundamentalsData.totalAssets === "N/A"
        ? "N/A"
        : (
            parseFloat(fundamentalsData.totalAssets) / scaleFactor
          ).toFixed(2)
    }</td></tr>
      <tr><td>Total Liabilities (${unit})</td><td>${
      fundamentalsData.totalLiabilities === "N/A"
        ? "N/A"
        : (
            parseFloat(fundamentalsData.totalLiabilities) / scaleFactor
          ).toFixed(2)
    }</td></tr>
      <tr><td>Cash on Hand (${unit})</td><td>${
      fundamentalsData.cashOnHand === "N/A"
        ? "N/A"
        : (parseFloat(fundamentalsData.cashOnHand) / scaleFactor).toFixed(
            2
          )
    }</td></tr>
    `;
  } else {
    rows += `
      <tr><td>Investing Cash Flow (${unit})</td><td>${
      fundamentalsData.investingCashFlow === "N/A"
        ? "N/A"
        : (
            parseFloat(fundamentalsData.investingCashFlow) / scaleFactor
          ).toFixed(2)
    }</td></tr>
      <tr><td>Financing Cash Flow (${unit})</td><td>${
      fundamentalsData.financingCashFlow === "N/A"
        ? "N/A"
        : (
            parseFloat(fundamentalsData.financingCashFlow) / scaleFactor
          ).toFixed(2)
    }</td></tr>
      <tr><td>Free Cash Flow (${unit})</td><td>${
      fundamentalsData.freeCashFlow === "N/A"
        ? "N/A"
        : (
            parseFloat(fundamentalsData.freeCashFlow) / scaleFactor
          ).toFixed(2)
    }</td></tr>
    `;
  }

  tableBody.innerHTML = rows;
}

async function fetchPriceHistory(symbol, period) {
  let prices = [];
  let labels = [];
  let priceData = [];

  if (period === "1year") {
    try {
      const intradayRes = await fetch(
        `${API_BASE_URL}/api/stock/time-series-intraday?symbol=${symbol}&interval=5min`
      );
      if (intradayRes.status === 401 || intradayRes.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      const intradayData = await intradayRes.json();
      if (intradayData["Error Message"] || !intradayData["Meta Data"])
        throw new Error("Invalid symbol for intraday");

      const intradayPrices = Object.entries(
        intradayData["Time Series (5min)"]
      ).map(([, values]) => ({
        date: new Date().toISOString().split("T")[0],
        price: parseFloat(values["4. close"]),
      }));
      const last30Days = filterLastNYears(intradayPrices, 1 / 12);
      prices.push(...last30Days);

      const dailyRes = await fetch(
        `${API_BASE_URL}/api/stock/time-series-daily?symbol=${symbol}`
      );
      if (dailyRes.status === 401 || dailyRes.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      const dailyData = await dailyRes.json();
      if (dailyData["Error Message"] || !dailyData["Time Series (Daily)"])
        throw new Error("Invalid symbol for daily");

      const dailyPrices = Object.entries(
        dailyData["Time Series (Daily)"]
      ).map(([date, values]) => ({
        date,
        price: parseFloat(values["4. close"]),
      }));
      const lastYearDaily = filterLastNYears(dailyPrices, 1).filter(
        (p) => new Date(p.date) < new Date(last30Days[0].date)
      );
      prices.push(...lastYearDaily);
    } catch (error) {
      alert("Error fetching 1-year price history: " + error.message);
      console.error(error);
      return;
    }
  } else {
    const timeSeries =
      period === "5year" ? "time-series-weekly" : "time-series-monthly";
    const interval = period === "5year" ? "weekly" : "monthly";
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/stock/${timeSeries}?symbol=${symbol}`
      );
      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      const data = await response.json();
      if (data["Error Message"] || !data["Meta Data"])
        throw new Error("Invalid symbol");

      const key =
        interval === "weekly"
          ? "Weekly Time Series"
          : "Monthly Time Series";
      prices = Object.entries(data[key]).map(([date, values]) => ({
        date,
        price: parseFloat(values["4. close"]),
      }));
      if (period === "5year") {
        prices = filterLastNYears(prices, 5);
      }
    } catch (error) {
      alert("Error fetching price history: " + error.message);
      console.error(error);
      return;
    }
  }

  labels = prices.map((p) => p.date).reverse();
  priceData = prices.map((p) => p.price).reverse();
  initPriceChart(priceData, labels);
}

function updateFinancialChart() {
  let financialData;
  const yearlyData = fundamentalsData.financials.yearly[financialTab];
  const quarterlyData =
    fundamentalsData.financials.quarterly[financialTab];

  if (financialPeriod === "10year") {
    const years = Object.keys(yearlyData).sort();
    if (financialTab === "income") {
      financialData = {
        labels: years,
        revenue: years.map((year) => yearlyData[year].revenue),
        netIncome: years.map((year) => yearlyData[year].netIncome),
        netDebt: years.map((year) => yearlyData[year].netDebt),
      };
    } else if (financialTab === "balance") {
      financialData = {
        labels: years,
        totalAssets: years.map((year) => yearlyData[year].totalAssets),
        totalLiabilities: years.map(
          (year) => yearlyData[year].totalLiabilities
        ),
        cashOnHand: years.map((year) => yearlyData[year].cashOnHand),
      };
    } else {
      financialData = {
        labels: years,
        investingCashFlow: years.map(
          (year) => yearlyData[year].investingCashFlow
        ),
        financingCashFlow: years.map(
          (year) => yearlyData[year].financingCashFlow
        ),
        freeCashFlow: years.map((year) => yearlyData[year].freeCashFlow),
      };
    }
  } else if (financialPeriod === "5year") {
    const years = Object.keys(yearlyData).slice(-5).sort();
    if (financialTab === "income") {
      financialData = {
        labels: years,
        revenue: years.map((year) => yearlyData[year].revenue),
        netIncome: years.map((year) => yearlyData[year].netIncome),
        netDebt: years.map((year) => yearlyData[year].netDebt),
      };
    } else if (financialTab === "balance") {
      financialData = {
        labels: years,
        totalAssets: years.map((year) => yearlyData[year].totalAssets),
        totalLiabilities: years.map(
          (year) => yearlyData[year].totalLiabilities
        ),
        cashOnHand: years.map((year) => yearlyData[year].cashOnHand),
      };
    } else {
      financialData = {
        labels: years,
        investingCashFlow: years.map(
          (year) => yearlyData[year].investingCashFlow
        ),
        financingCashFlow: years.map(
          (year) => yearlyData[year].financingCashFlow
        ),
        freeCashFlow: years.map((year) => yearlyData[year].freeCashFlow),
      };
    }
  } else {
    const quarters = Object.keys(quarterlyData).sort();
    const cutoffDate = new Date("2025-04-23");
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
    const filteredQuarters = quarters.filter(
      (q) => new Date(q) >= cutoffDate
    );
    if (financialTab === "income") {
      financialData = {
        labels: filteredQuarters,
        revenue: filteredQuarters.map((q) => quarterlyData[q].revenue),
        netIncome: filteredQuarters.map(
          (q) => quarterlyData[q].netIncome
        ),
        netDebt: filteredQuarters.map((q) => quarterlyData[q].netDebt),
      };
    } else if (financialTab === "balance") {
      financialData = {
        labels: filteredQuarters,
        totalAssets: filteredQuarters.map(
          (q) => quarterlyData[q].totalAssets
        ),
        totalLiabilities: filteredQuarters.map(
          (q) => quarterlyData[q].totalLiabilities
        ),
        cashOnHand: filteredQuarters.map(
          (q) => quarterlyData[q].cashOnHand
        ),
      };
    } else {
      financialData = {
        labels: filteredQuarters,
        investingCashFlow: filteredQuarters.map(
          (q) => quarterlyData[q].investingCashFlow
        ),
        financingCashFlow: filteredQuarters.map(
          (q) => quarterlyData[q].financingCashFlow
        ),
        freeCashFlow: filteredQuarters.map(
          (q) => quarterlyData[q].freeCashFlow
        ),
      };
    }
  }
  initFinancialBarChart(financialData);
}

function toggleFinancialUnit() {
  financialUnit = financialUnit === "millions" ? "billions" : "millions";
  document.querySelector(".unit-toggle").textContent = `Switch to ${
    financialUnit === "millions" ? "Billions" : "Millions"
  }`;
  updateFinancialTable();
  updateFinancialChart();
}

function setFinancialTab(tab) {
  financialTab = tab;
  document
    .querySelectorAll(".tab[onclick^='setFinancialTab']")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="setFinancialTab('${tab}')"]`)
    .classList.add("active");
  updateFinancialTable();
  updateFinancialChart();
}

function setFinancialPeriod(period) {
  financialPeriod = period;
  document
    .querySelectorAll(".tab[onclick^='setFinancialPeriod']")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="setFinancialPeriod('${period}')"]`)
    .classList.add("active");
  updateFinancialChart();
}

async function migrateGuestPortfolio() {
  if (token && localStorage.getItem("guestMode") === "true") {
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Guest-Id": guestId,
      };
      const response = await fetch(`${API_BASE_URL}/api/portfolio/migrate`, {
        method: "POST",
        headers,
      });
      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log("Migration result:", result);
      localStorage.removeItem("guestMode");
      localStorage.removeItem("guestPortfolioCount");
      localStorage.removeItem("guestAnalysisCount");
      localStorage.removeItem("guestId");
      guestId = null;
      isGuestMode = false;
    } catch (error) {
      console.error("Error migrating guest portfolio:", error);
      alert("Failed to migrate guest portfolio: " + error.message);
    }
  }
}

async function addToPortfolio() {
  let portfolioCount = parseInt(localStorage.getItem("guestPortfolioCount") || "0");
  if (isGuestMode && portfolioCount >= 5) {
    alert("Guest mode limit reached: You can only add 5 stocks to your portfolio.");
    return;
  }

  const symbol = document
    .getElementById("portfolioCompany")
    .value.toUpperCase();
  const quantity = parseInt(document.getElementById("quantity").value);
  const priceType = document.getElementById("priceType").value;
  let price;

  if (!symbol || !quantity || quantity <= 0) {
    return alert("Enter a valid company symbol and quantity");
  }

  if (priceType === "manual") {
    price = parseFloat(document.getElementById("manualPrice").value);
    if (!price || price <= 0) {
      return alert("Enter a valid purchase price greater than 0");
    }
  } else {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/stock/global-quote?symbol=${symbol}`
      );
      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      const data = await response.json();
      if (data["Error Message"] || !data["Global Quote"]) {
        throw new Error("Invalid symbol");
      }
      price = parseFloat(data["Global Quote"]["05. price"]);
    } catch (error) {
      alert("Error fetching current price: " + error.message);
      return;
    }
  }

  const stock = {
    symbol,
    quantity,
    price,
    timestamp: new Date().toISOString(),
  };

  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${isGuestMode ? guestId : token}`,
    };
    const response = await fetch(`${API_BASE_URL}/api/portfolio`, {
      method: "POST",
      headers,
      body: JSON.stringify(stock),
    });
    if (response.status === 401 || response.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    portfolio.push({ ...stock, _id: result.id });
    if (isGuestMode) {
      portfolioCount++;
      localStorage.setItem("guestPortfolioCount", portfolioCount);
    }
    updatePortfolio();
    alert(result.message || "Stock added to portfolio");
  } catch (error) {
    alert("Error adding to portfolio: " + error.message);
    console.error("Portfolio add error:", error);
  }
}

async function deleteFromPortfolio(stockId, symbol) {
  try {
    const headers = {
      Authorization: `Bearer ${isGuestMode ? guestId : token}`,
    };
    const response = await fetch(
      `${API_BASE_URL}/api/portfolio/${stockId}`,
      {
        method: "DELETE",
        headers,
      }
    );
    if (response.status === 401 || response.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    portfolio = portfolio.filter((stock) => stock._id !== stockId);
    if (isGuestMode) {
      let portfolioCount = parseInt(localStorage.getItem("guestPortfolioCount") || "0");
      if (portfolioCount > 0) portfolioCount--;
      localStorage.setItem("guestPortfolioCount", portfolioCount);
    }
    updatePortfolio();
    alert(`Removed ${symbol} from portfolio`);
  } catch (error) {
    alert("Error removing from portfolio: " + error.message);
    console.error("Portfolio delete error:", error);
  }
}

async function updatePortfolio() {
  const list = document.getElementById("portfolioList");
  const metricsDiv = document.getElementById("portfolioMetrics");
  const performanceDiv = document.getElementById("portfolioPerformance");
  list.innerHTML = "";
  metricsDiv.innerHTML = "";
  performanceDiv.innerHTML = "";

  if (portfolio.length === 0) {
    initPortfolioDoughnut([], []);
    performanceDiv.innerHTML = `<span>Portfolio Performance: $0.00 (0.00%)</span>`;
    return;
  }

  let companies = [];
  let values = [];
  let totalPurchaseValue = 0;
  let totalCurrentValue = 0;

  for (const stock of portfolio) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/stock/global-quote?symbol=${stock.symbol}`
      );
      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please log in again.");
        logout();
        return;
      }
      const data = await response.json();
      if (data["Error Message"] || !data["Global Quote"]) continue;

      const currentPrice = parseFloat(data["Global Quote"]["05. price"]);
      const value = currentPrice * stock.quantity;
      const purchaseValue = stock.price * stock.quantity;

      totalPurchaseValue += purchaseValue;
      totalCurrentValue += value;

      const percentGainLoss =
        ((currentPrice - stock.price) / stock.price) * 100;
      const numericalGainLoss =
        (currentPrice - stock.price) * stock.quantity;
      const gainLossClass =
        percentGainLoss >= 0 ? "gain-positive" : "gain-negative";

      companies.push(stock.symbol);
      values.push(value);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${stock.symbol}</td>
        <td>${stock.quantity}</td>
        <td>$${stock.price.toFixed(2)}</td>
        <td>$${currentPrice.toFixed(2)}</td>
        <td class="${gainLossClass}">
          $${numericalGainLoss.toFixed(2)} (${percentGainLoss.toFixed(2)}%)
        </td>
        <td>
          <button class="delete-btn" onclick="deleteFromPortfolio('${stock._id}', '${stock.symbol}')">Delete</button>
        </td>
      `;
      list.appendChild(row);
    } catch (error) {
      console.error(`Error updating portfolio for ${stock.symbol}:`, error);
    }
  }

  const portfolioPercentGainLoss =
    totalPurchaseValue > 0
      ? ((totalCurrentValue - totalPurchaseValue) / totalPurchaseValue) * 100
      : 0;
  const portfolioNumericalGainLoss = totalCurrentValue - totalPurchaseValue;
  const portfolioGainLossClass =
    portfolioPercentGainLoss >= 0 ? "gain-positive" : "gain-negative";

  metricsDiv.innerHTML = `
    Total Portfolio Value: $${totalCurrentValue.toFixed(2)}
    (Purchase: $${totalPurchaseValue.toFixed(2)})
  `;
  performanceDiv.innerHTML = `
    <span class="${portfolioGainLossClass}">
      Portfolio Performance: $${portfolioNumericalGainLoss.toFixed(2)} (${portfolioPercentGainLoss.toFixed(2)}%)
    </span>
  `;

  initPortfolioDoughnut(companies, values);
}

async function loadPortfolio() {
  try {
    await migrateGuestPortfolio();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${isGuestMode ? guestId : token}`,
    };
    const response = await fetch(`${API_BASE_URL}/api/portfolio`, {
      method: "GET",
      headers,
    });
    if (response.status === 401 || response.status === 403) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    portfolio = await response.json();
    updatePortfolio();
  } catch (error) {
    alert("Error loading portfolio: " + error.message);
    console.error("Portfolio load error:", error);
  }
}

// Toggle manual price input visibility
function toggleManualPriceInput() {
  const priceType = document.getElementById("priceType").value;
  const manualPriceInput = document.getElementById("manualPrice");
  manualPriceInput.style.display = priceType === "manual" ? "block" : "none";
}

document.getElementById("pricePeriod").addEventListener("change", () => {
  const symbol = document
    .getElementById("companySearch")
    .value.toUpperCase();
  if (symbol)
    fetchPriceHistory(
      symbol,
      document.getElementById("pricePeriod").value
    );
});

// Attach event listener for priceType select
document.getElementById("priceType").addEventListener("change", toggleManualPriceInput);

async function init() {
  toggleManualPriceInput();
  await loadPortfolio();
  initPriceChart();
  initFinancialBarChart({
    labels: [],
    revenue: [],
    netIncome: [],
    netDebt: [],
    totalAssets: [],
    totalLiabilities: [],
    cashOnHand: [],
    investingCashFlow: [],
    financingCashFlow: [],
    freeCashFlow: [],
  });
  initPortfolioDoughnut([], []);
  setFinancialTab("income");
  setFinancialPeriod("5year");
}

init();
