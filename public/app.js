let selectedArtisan = null;

// Navigation
function showDashboard() {
  switchPage("dashboardPage");
}

function showArtisans() {
  switchPage("artisansPage");
  searchArtisans();
}

function showBookings() {
  switchPage("bookingsPage");
  loadBookings();
}

function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

// Search Artisans
async function searchArtisans() {
  const q = document.getElementById("searchQuery").value;
  const state = document.getElementById("stateFilter").value;
  const lga = document.getElementById("lgaFilter").value;
  
  try {
    const params = new URLSearchParams({ q, state, lga });
    const response = await fetch(`/api/artisans?${params}`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    
    const artisans = await response.json();
    renderArtisans(artisans);
  } catch (error) {
    console.error("Search failed", error);
    document.getElementById("artisansList").innerHTML = "<p>Failed to load artisans</p>";
  }
}

function renderArtisans(artisans) {
  const container = document.getElementById("artisansList");
  
  if (artisans.length === 0) {
    container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 40px;'>No artisans found. Try different search terms.</p>";
    return;
  }
  
  container.innerHTML = artisans.map(a => `
    <div class="artisan-card">
      <div class="artisan-header">
        <div class="artisan-avatar">${a.profession.charAt(0).toUpperCase()}</div>
        <div class="artisan-title">
          <h3>${a.name}</h3>
          <p>${a.profession}</p>
        </div>
      </div>
      <div class="artisan-body">
        <div class="artisan-rating">⭐ ${a.rating}</div>
        <div class="artisan-meta">📍 ${a.location}, ${a.lga}, ${a.state}</div>
        <div class="artisan-meta">👤 ${a.experience} years experience</div>
        <div class="artisan-status ${a.available ? 'available' : 'unavailable'}">
          ${a.available ? '● Available' : '● Currently unavailable'}
        </div>
        <p class="artisan-bio">${a.bio}</p>
        <div class="artisan-actions">
          <button class="btn btn-primary" onclick="openBookingModal(${a.id}, '${a.name}')">Book</button>
          <a href="https://wa.me/234${a.phone.replace(/^0/, '')}" target="_blank" class="btn btn-outline">WhatsApp</a>
        </div>
      </div>
    </div>
  `).join("");
}

// Booking Modal
function openBookingModal(artisanId, artisanName) {
  selectedArtisan = { id: artisanId, name: artisanName };
  document.getElementById("bookingModal").classList.add("active");
}

function closeModal() {
  document.getElementById("bookingModal").classList.remove("active");
  document.getElementById("bookingForm").reset();
}

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const booking = {
    artisan_id: selectedArtisan.id,
    service: document.getElementById("bookingService").value,
    booking_date: document.getElementById("bookingDate").value,
    booking_time: document.getElementById("bookingTime").value,
    location: document.getElementById("bookingLocation").value,
    notes: document.getElementById("bookingNotes").value
  };
  
  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(booking)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      alert(data.error || "Booking failed");
      return;
    }
    
    alert(`✅ Booking #${data.bookingId} submitted! Status: ${data.status}`);
    closeModal();
    loadBookings();
  } catch (error) {
    alert("Booking failed: " + error.message);
  }
});

// Load Bookings
async function loadBookings() {
  try {
    const response = await fetch("/api/bookings", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    
    const bookings = await response.json();
    renderBookings(bookings);
  } catch (error) {
    console.error("Failed to load bookings", error);
    document.getElementById("bookingsList").innerHTML = "<p>Failed to load bookings</p>";
  }
}

function renderBookings(bookings) {
  const container = document.getElementById("bookingsList");
  
  if (bookings.length === 0) {
    container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 40px;'>No bookings yet.</p>";
    return;
  }
  
  container.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <h3>${currentUser.role === "customer" ? b.profession : b.customer_name}</h3>
      <div class="booking-meta">📅 ${b.booking_date} at ${b.booking_time}</div>
      <div class="booking-meta">📍 ${b.location}</div>
      <div class="booking-meta">🔧 ${b.service}</div>
      ${b.notes ? `<div class="booking-meta">📝 ${b.notes}</div>` : ""}
      <span class="booking-status ${b.status.toLowerCase()}">${b.status}</span>
    </div>
  `).join("");
}

// Close modal when clicking outside
window.onclick = (event) => {
  const modal = document.getElementById("bookingModal");
  if (event.target === modal) {
    closeModal();
  }
};
