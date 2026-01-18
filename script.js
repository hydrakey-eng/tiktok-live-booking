// --- FIREBASE CONFIGURATION ---
// TODO: Replace with your own project config from Firebase Console -> Project Settings
// 1. Go to firebase.google.com -> Create Project
// 2. Add Web App -> Copy keys here
// 3. Enable Firestore Database in "Test Mode"
const firebaseConfig = {
    apiKey: "AIzaSyD-YOUR-API-KEY-HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Initialized");
} catch (e) {
    console.error("Firebase init failed (expected if keys are missing):", e);
}

const db = firebase.firestore();
const COLLECTION_NAME = 'bookings';

// --- STATE MANAGEMENT ---
let allBookings = [];
let salesChartInstance = null;
let currentView = 'staff';

// --- UTILS ---
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Notifications
function showToast(msg, type = 'info') {
    let bg = "#3b82f6"; // info blue
    if (type === 'success') bg = "linear-gradient(to right, #00b09b, #96c93d)";
    if (type === 'error') bg = "linear-gradient(to right, #ff5f6d, #ffc371)";
    if (type === 'warning') bg = "#f59e0b";

    Toastify({
        text: msg,
        duration: 3000,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        backgroundColor: bg,
        stopOnFocus: true,
    }).showToast();
}

// Check for Firebase Connection (Simple Mock if Config is Placeholder)
function isConfigured() {
    return firebaseConfig.projectId !== "your-project-id";
}

// --- REAL-TIME DATA LISTENER ---
function initRealtimeListener() {
    if (!isConfigured()) {
        showToast("⚠️ Firebase Config Missing! Using local mock mode.", "warning");
        // Fallback to localStorage logic for demo purposes if user hasn't configured key yet
        allBookings = JSON.parse(localStorage.getItem('tiktok_live_bookings') || '[]');
        updateUI();
        return;
    }

    // Subscribe to Firestore updates
    db.collection(COLLECTION_NAME).onSnapshot((snapshot) => {
        const bookings = [];
        snapshot.forEach((doc) => {
            bookings.push({ id: doc.id, ...doc.data() });
        });
        allBookings = bookings;
        updateUI();
    }, (error) => {
        console.error("Firestore Error:", error);
        showToast("Error syncing data: " + error.message, "error");
    });
}

// --- CORE ACTIONS (Supports both Firestore & Local Fallback) ---

async function addBooking(bookingData) {
    if (isConfigured()) {
        try {
            await db.collection(COLLECTION_NAME).add(bookingData);
            showToast("Booking requested successfully!", "success");
        } catch (e) {
            showToast("Failed to request booking.", "error");
            console.error(e);
        }
    } else {
        // Fallback
        bookingData.id = Date.now().toString();
        allBookings.push(bookingData);
        localStorage.setItem('tiktok_live_bookings', JSON.stringify(allBookings));
        updateUI();
        showToast("Booking requested (Local Mode)", "success");
    }
}

async function updateBookingStatus(id, status) {
    if (isConfigured()) {
        try {
            await db.collection(COLLECTION_NAME).doc(id).update({ status: status });
            showToast(`Booking ${status.toLowerCase()}`, "success");
        } catch (e) {
            showToast("Update failed", "error");
        }
    } else {
        // Fallback
        const idx = allBookings.findIndex(b => b.id === id);
        if (idx !== -1) {
            allBookings[idx].status = status;
            localStorage.setItem('tiktok_live_bookings', JSON.stringify(allBookings));
            updateUI();
            showToast(`Booking ${status.toLowerCase()} (Local)`, "success");
        }
    }
}

async function updateBookingStats(id, viewers, sales) {
    const data = {
        actualViewers: viewers,
        salesAmount: sales
    };

    if (isConfigured()) {
        try {
            await db.collection(COLLECTION_NAME).doc(id).update(data);
            showToast("Stats reported successfully!", "success");
        } catch (e) {
            showToast("Failed to report stats", "error");
        }
    } else {
        // Fallback
        const idx = allBookings.findIndex(b => b.id === id);
        if (idx !== -1) {
            allBookings[idx].actualViewers = viewers;
            allBookings[idx].salesAmount = sales;
            localStorage.setItem('tiktok_live_bookings', JSON.stringify(allBookings));
            updateUI();
            showToast("Stats reported (Local)", "success");
        }
    }
}

// --- UI LOGIC ---

// View Switching
function switchView(viewName) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) btn.classList.add('active');
    });

    // Update Main Content
    document.querySelectorAll('.view-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    const activeSection = document.getElementById(`${viewName}-view`);
    activeSection.style.display = 'block';

    setTimeout(() => {
        activeSection.classList.add('active');
    }, 10);

    // Profile Text
    const userRole = document.querySelector('.user-info .role');
    const userName = document.querySelector('.user-info .name');
    if (viewName === 'staff') {
        userRole.textContent = 'Staff';
        userName.textContent = 'Staff Member';
    } else {
        userRole.textContent = 'Manager';
        userName.textContent = 'Admin User';
    }

    currentView = viewName;
    updateUI();

    // Resize chart if needed
    if (viewName === 'manager' && salesChartInstance) {
        salesChartInstance.resize();
    }
}

// Staff: Submit Booking
document.getElementById('bookingForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const title = document.getElementById('bookingTitle').value;

    if (!date || !time || !title) return;

    // Overlap Check
    const isOverlap = allBookings.some(b =>
        b.date === date &&
        b.time === time &&
        b.status !== 'REJECTED'
    );

    if (isOverlap) {
        showToast('This time slot is already booked!', 'error');
        return;
    }

    const newBooking = {
        staffName: 'Staff Member', // Mock user
        title: title,
        date,
        time,
        status: 'PENDING',
        actualViewers: null,
        salesAmount: null,
        createdAt: new Date().toISOString()
    };

    addBooking(newBooking);
    e.target.reset();
});

// Staff: Report Form
document.getElementById('reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('reportBookingId').value;
    const viewers = document.getElementById('actualViewers').value;
    const sales = document.getElementById('salesAmount').value;

    updateBookingStats(id, viewers, sales);
    closeReportModal();
    e.target.reset();
});

// Render Loop
function updateUI() {
    renderStaffBookings();
    renderManagerDashboard();
}

function renderStaffBookings() {
    const list = document.getElementById('staffBookingsList');
    list.innerHTML = '';

    // In real app, filter by User ID. Here we assume all mocks are ours + filter
    const myBookings = allBookings.filter(b => b.staffName === 'Staff Member');
    myBookings.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    if (myBookings.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No bookings found.</p></div>';
        return;
    }

    myBookings.forEach(b => {
        const item = document.createElement('div');
        item.className = 'booking-item';

        let actionItem = '';
        if (b.status === 'APPROVED') {
            if (b.actualViewers !== null) {
                // Already reported
                actionItem = `<span class="item-details"><i class="ri-bar-chart-line"></i> $${b.salesAmount} | 👁️ ${b.actualViewers}</span>`;
            } else {
                // Pending Report
                actionItem = `<button class="btn-sm btn-report" onclick="openReportModal('${b.id}')"><i class="ri-edit-line"></i> Updates Stats</button>`;
            }
        }

        item.innerHTML = `
            <div class="item-header">
                <span class="item-title">${b.title}</span>
                <span class="item-status status-${b.status.toLowerCase()}">${b.status}</span>
            </div>
            <div class="item-details">
                <span><i class="ri-calendar-line"></i> ${formatDate(b.date)}</span>
                <span><i class="ri-time-line"></i> ${b.time}</span>
            </div>
            <div class="item-actions">
                ${actionItem}
            </div>
        `;
        list.appendChild(item);
    });
}

function renderManagerDashboard() {
    // Stats
    document.getElementById('statPending').textContent = allBookings.filter(b => b.status === 'PENDING').length;
    document.getElementById('statApproved').textContent = allBookings.filter(b => b.status === 'APPROVED').length;

    const totalSales = allBookings.reduce((sum, b) => sum + (Number(b.salesAmount) || 0), 0);
    document.getElementById('statSales').textContent = '$' + totalSales.toLocaleString();

    // Pending List
    const pendingList = document.getElementById('pendingRequestsList');
    pendingList.innerHTML = '';
    const pending = allBookings.filter(b => b.status === 'PENDING');

    if (pending.length === 0) {
        pendingList.innerHTML = '<div class="empty-state"><p>No pending requests.</p></div>';
    } else {
        pending.forEach(b => {
            const item = document.createElement('div');
            item.className = 'booking-item';
            item.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${b.title} <small style="color:var(--text-muted)">by ${b.staffName}</small></span>
                </div>
                <div class="item-details">
                    <span><i class="ri-calendar-line"></i> ${formatDate(b.date)}</span>
                    <span><i class="ri-time-line"></i> ${b.time}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-sm btn-approve" onclick="updateBookingStatus('${b.id}', 'APPROVED')">Approve</button>
                    <button class="btn-sm btn-reject" onclick="updateBookingStatus('${b.id}', 'REJECTED')">Reject</button>
                </div>
            `;
            pendingList.appendChild(item);
        });
    }

    // Approved List
    const calendarList = document.getElementById('approvedCalendarList');
    calendarList.innerHTML = '';
    const approved = allBookings.filter(b => b.status === 'APPROVED')
        .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));

    if (approved.length === 0) {
        calendarList.innerHTML = '<div class="empty-state"><p>No approved sessions.</p></div>';
    } else {
        approved.forEach(b => {
            const item = document.createElement('div');
            item.className = 'booking-item';
            item.style.borderLeft = '3px solid var(--success)';

            let stats = '';
            if (b.actualViewers !== null) {
                stats = `<div style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-muted)">
                    Results: ${b.actualViewers} viewers, $${b.salesAmount} sales
                </div>`;
            }

            item.innerHTML = `
                <div class="item-header">
                    <span class="item-title">${b.title}</span>
                    <small>${b.staffName}</small>
                </div>
                <div class="item-details">
                    <span>${formatDate(b.date)}</span>
                    <span>${b.time}</span>
                </div>
                ${stats}
            `;
            calendarList.appendChild(item);
        });
    }

    updateChart();
}

// --- CHART.JS INTEGRATION ---
function updateChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Aggregate sales by date (last 7 days logic simplified for demo)
    // We will just group by Date string for all available data to show something nice
    const salesByDate = {};

    // Sort bookings by date
    const sorted = [...allBookings].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(b => {
        if (b.status === 'APPROVED' && b.salesAmount) {
            const d = formatDate(b.date);
            salesByDate[d] = (salesByDate[d] || 0) + Number(b.salesAmount);
        }
    });

    const labels = Object.keys(salesByDate);
    const data = Object.values(salesByDate);

    // Initial Chart Data (if empty)
    if (labels.length === 0) {
        // Show empty placeholder or just leave empty
    }

    if (salesChartInstance) {
        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = data;
        salesChartInstance.update();
    } else {
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales ($)',
                    data: data,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ec4899'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

// Modal Helpers
function openReportModal(id) {
    document.getElementById('reportBookingId').value = id;
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

// Startup
document.addEventListener('DOMContentLoaded', initRealtimeListener);
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.switchView = switchView;
window.updateBookingStatus = updateBookingStatus;
