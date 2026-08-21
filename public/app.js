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
  const sortEl = document.getElementById("sortFilter");
  const sort = sortEl ? sortEl.value : "rating";

  try {
    const params = new URLSearchParams({ q, state, lga, sort });
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
          <h3>${a.name} ${a.verified ? '<span class="verified-badge" title="Verified">✔️</span>' : ''}</h3>
          <p>${a.profession}</p>
        </div>
      </div>
      <div class="artisan-body">
        <div class="artisan-rating">⭐ ${a.rating}</div>
        <div class="artisan-meta">📍 ${a.location}${a.area ? ', ' + a.area : ''}${a.city ? ', ' + a.city : ''}, ${a.lga}, ${a.state}</div>
        <div class="artisan-meta">👤 ${a.experience} years experience</div>
        ${a.price_range ? `<div class="artisan-meta">💰 ${a.price_range}</div>` : ""}
        <div class="artisan-status ${a.available ? 'available' : 'unavailable'}">
          ${a.available ? '● Available' : '● Currently unavailable'}
        </div>
        <p class="artisan-bio">${a.bio}</p>
        <div class="artisan-actions">
          <button class="btn btn-primary" onclick="openBookingModal(${a.id}, '${a.name}')">Book</button>
          ${a.phone ? `<a href="https://wa.me/234${a.phone.replace(/^0/, '')}" target="_blank" class="btn btn-outline">WhatsApp</a>` : `<span class="btn btn-outline" style="opacity:0.5; cursor:default;" title="Available after booking">WhatsApp (after booking)</span>`}
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

  const messageEl = document.getElementById("bookingMessage");

  const booking = {
    artisan_id: selectedArtisan.id,
    service: document.getElementById("bookingService").value,
    message: messageEl ? messageEl.value : document.getElementById("bookingNotes").value,
    booking_date: document.getElementById("bookingDate").value,
    booking_time: document.getElementById("bookingTime").value,
    location: document.getElementById("bookingLocation").value,
    notes: document.getElementById("bookingNotes").value
  };

  if (!booking.message) {
    alert("Please add a short message for the artisan");
    return;
  }

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
      <div class="booking-meta">📅 ${b.booking_date || 'No date specified'} ${b.booking_time || ''}</div>
      <div class="booking-meta">📍 ${b.location}</div>
      <div class="booking-meta">🔧 ${b.service}</div>
      ${b.message ? `<div class="booking-meta">💬 ${b.message}</div>` : ""}
      ${b.notes ? `<div class="booking-meta">📝 ${b.notes}</div>` : ""}
      <span class="booking-status ${b.status.toLowerCase()}">${b.status}</span>
      ${currentUser.role === "artisan" && b.status === "Pending" ? `
        <div class="booking-actions">
          <button class="btn btn-primary" onclick="updateBookingStatus(${b.id}, 'Accepted')">Accept</button>
          <button class="btn btn-outline" onclick="updateBookingStatus(${b.id}, 'Declined')">Decline</button>
        </div>
      ` : ""}
      ${currentUser.role === "artisan" && b.status === "Accepted" ? `
        <div class="booking-actions">
          <button class="btn btn-primary" onclick="updateBookingStatus(${b.id}, 'Completed')">Mark Completed</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

async function updateBookingStatus(bookingId, status) {
  try {
    const response = await fetch(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Update failed");
      return;
    }

    loadBookings();
  } catch (error) {
    alert("Update failed: " + error.message);
  }
}

// Close modal when clicking outside
window.onclick = (event) => {
  const modal = document.getElementById("bookingModal");
  if (event.target === modal) {
    closeModal();
  }
};
