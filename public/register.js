 async function register() {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        try {
          const response = await fetch("https://fantasy-back-1.onrender.com/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Registration failed");
          localStorage.setItem("token", data.token);
          window.location.href = "/dashboard.html";
        } catch (error) {
          alert("Error: " + error.message);
        }
      }

