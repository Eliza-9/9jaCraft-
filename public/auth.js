let authToken = localStorage.getItem("authToken");
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (authToken && currentUser) {
  showApp();
}

function switchToLogin() {
  document.getElementById("loginPage").classList.add("active");
  document.getElementById("signupPage").classList.remove("active");
}

function switchToSignup() {
  document.getElementById("signupPage").classList.add("active");
  document.getElementById("loginPage").classList.remove("active");
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      showResponseModal(data.error || "Login failed", "error");
      return;
    }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("authToken", authToken);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    showApp();
  } catch (error) {
    showResponseModal("Login failed: " + error.message, "error");
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const phone = document.getElementById("signupPhone").value;
  const password = document.getElementById("signupPassword").value;
  const role = document.getElementById("signupRole").value;
  if (!role) {
    showResponseModal("Please select a role", "error");
    return;
  }
  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password, role })
    });
    const data = await response.json();
    if (!response.ok) {
      showResponseModal(data.error || "Signup failed", "error");
      return;
    }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("authToken", authToken);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    showApp();
  } catch (error) {
    showResponseModal("Signup failed: " + error.message, "error");
  }
});

function showApp() {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("mainApp").style.display = "block";

  const welcomeText = document.getElementById("welcomeText");
  const userEmail = document.getElementById("userEmail");
  welcomeText.textContent = `Welcome, ${currentUser.name}!`;
  userEmail.textContent = currentUser.email;

  const profileNavLink = document.getElementById("profileNavLink");
  if (profileNavLink) {
    profileNavLink.style.display = currentUser.role === "artisan" ? "flex" : "none";
  }

  loadUserInfo();
}

function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  authToken = null;
  currentUser = null;
  location.reload();
}

async function loadUserInfo() {
  try {
    const response = await fetch("/api/me", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (response.ok) {
      const user = await response.json();
      const userInfo = document.getElementById("userInfo");
      userInfo.innerHTML = `
        <p><strong>Role:</strong> ${user.role === "artisan" ? "Artisan" : "Customer"}</p>
        <p><strong>Phone:</strong> ${user.phone || "Not provided"}</p>
      `;
    }
  } catch (error) {
    console.error("Failed to load user info");
  }
  }
