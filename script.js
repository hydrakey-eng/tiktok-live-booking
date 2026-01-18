// --- FIREBASE CONFIGURATION ---
// TODO: Replace with your own project config
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
} catch (e) {
    console.error("Firebase init failed:", e);
}

const db = firebase.firestore();
const COLL_BOOKINGS = 'bookings';
const COLL_USERS = 'users'; // New collection for users

// --- STATE MANAGEMENT ---
let allBookings = [];
let allUsers = [];
let salesChartInstance = null;
let currentUser = null; // { username, role, name, id }

// --- AUTH UTILS ---
function initData() {
    // Check Config
    const isMock = firebaseConfig.projectId === "your-project-id";

    // Listen to Bookings
    if (!isMock) {
        db.collection(COLL_BOOKINGS).onSnapshot(snap => {
            allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            updateUI();
        });
        db.collection(COLL_USERS).onSnapshot(snap => {
            allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // If current user is deleted, logout? (Skip for now)
            updateUI();
        });
    } else {
        // Mock
        allBookings = JSON.parse(localStorage.getItem('tiktok_bookings_v3') || '[]');
        allUsers = JSON.parse(localStorage.getItem('tiktok_users_v3') || '[]');

        // Seed Admin if empty
        if (allUsers.length === 0) {
            allUsers.push({
                username: 'admin',
                password: 'admin123', // In real app, hash this!
                role: 'manager',
                name: 'Admin User',
                id: 'admin_1'
            });
            localStorage.setItem('tiktok_users_v3', JSON.stringify(allUsers));
        }
        updateUI();
    }
}

// LOGIN
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;

    const user = allUsers.find(user => user.username === u && user.password === p);

    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-main').style.display = 'flex';

        // Setup User Profile in Sidebar
        document.getElementById('currentUserName').textContent = user.name;
        document.getElementById('currentUserRole').textContent = user.role;
        document.getElementById('currentUserAvatar').textContent = user.name[0];

        // Build Sidebar
        renderSidebar();

        // Default View
        if (user.role === 'manager') switchView('manager');
        else switchView('staff');

        showToast(`Welcome, ${user.name}!`, "success");
    } else {
        showToast("Invalid Credentials", "error");
    }
});

function logout() {
    currentUser = null;
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('loginForm').reset();
    showToast("Logged Out");
}

function renderSidebar() {
    const nav = document.getElementById('navMenu');
    nav.innerHTML = '<div class="nav-label">Menu</div>';

    if (currentUser.role === 'staff') {
        nav.innerHTML += `
            <button class="nav-item active" onclick="switchView('staff')">
                <i class="ri-calendar-check-line"></i> <span>My Bookings</span>
            </button>
        `;
    } else {
        nav.innerHTML += `
            <button class="nav-item" onclick="switchView('manager')">
                <i class="ri-dashboard-line"></i> <span>Dashboard</span>
            </button>
            <button class="nav-item" onclick="switchView('team')">
                <i class="ri-team-line"></i> <span>Team</span>
            </button>
        `;
    }
}

// CREATE USER (Manager Only)
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'manager') return;

    const name = document.getElementById('newUserName').value;
    const username = document.getElementById('newUserUsername').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    // Check unique
    if (allUsers.some(u => u.username === username)) {
        showToast("Username already exists", "error");
        return;
    }

    const newUser = { name, username, password, role };

    const isMock = firebaseConfig.projectId === "your-project-id";
    if (!isMock) {
        await db.collection(COLL_USERS).add(newUser);
    } else {
        newUser.id = Date.now().toString();
        allUsers.push(newUser);
        localStorage.setItem('tiktok_users_v3', JSON.stringify(allUsers));
        updateUI(); // Trigger UI update for Team List
    }

    e.target.reset();
    showToast("User created successfully", "success");
});

// --- BOOKING LOGIC ---

// Add Booking (Updated for Room)
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const room = document.getElementById('bookingRoom').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const title = document.getElementById('bookingTitle').value;

    // Overlap Check: Date + Time + Room
    const isOverlap = allBookings.some(b =>
        b.date === date &&
        b.time === time &&
        b.room === room &&
        b.status !== 'REJECTED'
    );

    if (isOverlap) {
        showToast(`'${room}' is already booked at this time!`, 'error');
        return;
    }

    const newBooking = {
        staffName: currentUser.name,
        staffId: currentUser.id,
        room,
        date,
        time,
        title,
        status: 'PENDING',
        actualViewers: null,
        salesAmount: null,
        createdAt: new Date().toISOString()
    };

    const isMock = firebaseConfig.projectId === "your-project-id";
    if (!isMock) {
        await db.collection(COLL_BOOKINGS).add(newBooking);
    } else {
        newBooking.id = Date.now().toString();
        allBookings.push(newBooking);
        localStorage.setItem('tiktok_bookings_v3', JSON.stringify(allBookings));
        updateUI();
    }

    e.target.reset();
    showToast("Booking requested!", "success");
});

async function updateStatus(id, newStatus) {
    const isMock = firebaseConfig.projectId === "your-project-id";
    if (!isMock) {
        await db.collection(COLL_BOOKINGS).doc(id).update({ status: newStatus });
    } else {
        const idx = allBookings.findIndex(b => b.id === id);
        if (idx !== -1) {
            allBookings[idx].status = newStatus;
            localStorage.setItem('tiktok_bookings_v3', JSON.stringify(allBookings));
            updateUI();
        }
    }
    showToast(`Booking ${newStatus}`, "success");
}

async function updateStats(id, viewers, sales) {
    const isMock = firebaseConfig.projectId === "your-project-id";
    if (!isMock) {
        await db.collection(COLL_BOOKINGS).doc(id).update({ actualViewers: viewers, salesAmount: sales });
    } else {
        const idx = allBookings.findIndex(b => b.id === id);
        if (idx !== -1) {
            allBookings[idx].actualViewers = viewers;
            allBookings[idx].salesAmount = sales;
            localStorage.setItem('tiktok_bookings_v3', JSON.stringify(allBookings));
            updateUI();
        }
    }
    showToast("Stats updated", "success");
}

document.getElementById('reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    updateStats(
        document.getElementById('reportBookingId').value,
        document.getElementById('actualViewers').value,
        document.getElementById('salesAmount').value
    );
    closeReportModal();
});

// --- UI HELPERS ---
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    const target = document.getElementById(`${view}-view`);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }

    // Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Simple check to highlight based on onclick attr match
    // (In robust app, use dataset)

    if (view === 'manager') updateChart();
}

function updateUI() {
    if (!currentUser) return;

    if (currentUser.role === 'staff') {
        renderStaffBookings();
    } else {
        renderManagerDashboard();
        renderTeamList();
    }
}

function renderStaffBookings() {
    const list = document.getElementById('staffBookingsList');
    list.innerHTML = '';

    // Filter by own ID if possible, else name (fallback)
    const myBookings = allBookings.filter(b => b.staffId === currentUser.id || b.staffName === currentUser.name);
    myBookings.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (myBookings.length === 0) list.innerHTML = '<div class="empty-state"><p>No bookings.</p></div>';

    myBookings.forEach(b => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-title">${b.title}</span>
                <span class="item-status status-${b.status.toLowerCase()}">${b.status}</span>
            </div>
            <div class="item-details">
                <span><i class="ri-map-pin-line"></i> ${b.room}</span>
                <span><i class="ri-calendar-line"></i> ${b.date}</span>
                <span><i class="ri-time-line"></i> ${b.time}</span>
            </div>
            <div class="item-actions">
               ${b.status === 'APPROVED' ? `<button class="btn-sm btn-report" onclick="openReportModal('${b.id}')">Report</button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });
}

function renderManagerDashboard() {
    // Stats ... same as before
    const approved = allBookings.filter(b => b.status === 'APPROVED');
    document.getElementById('statApproved').textContent = approved.length;
    document.getElementById('statPending').textContent = allBookings.filter(b => b.status === 'PENDING').length;
    document.getElementById('statSales').textContent = '$' + allBookings.reduce((acc, b) => acc + (Number(b.salesAmount) || 0), 0);

    // Pending
    const pendingList = document.getElementById('pendingRequestsList');
    pendingList.innerHTML = '';
    const pending = allBookings.filter(b => b.status === 'PENDING');
    if (pending.length === 0) pendingList.innerHTML = '<div class="empty-state">No pending</div>';

    pending.forEach(b => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.innerHTML = `
            <div class="item-header"><span class="item-title">${b.title}</span></div>
             <div class="item-details">
                <span>${b.staffName}</span>
                <span>${b.room}</span>
                <span>${b.date} @ ${b.time}</span>
            </div>
            <div class="item-actions">
                <button class="btn-sm btn-approve" onclick="updateStatus('${b.id}', 'APPROVED')">Approve</button>
                <button class="btn-sm btn-reject" onclick="updateStatus('${b.id}', 'REJECTED')">Reject</button>
            </div>
        `;
        pendingList.appendChild(div);
    });

    // Calendar logic ...
    const calList = document.getElementById('approvedCalendarList');
    calList.innerHTML = '';
    if (approved.length === 0) calList.innerHTML = '<div class="empty-state">No sessions</div>';
    approved.forEach(b => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.style.borderLeft = '3px solid var(--success)';
        div.innerHTML = `
            <div class="item-header"><span class="item-title">${b.title}</span></div>
            <div class="item-details">
                <span>${b.room}</span>
                <span>${b.date} ${b.time}</span>
            </div>
        `;
        calList.appendChild(div);
    });
}

function renderTeamList() {
    const list = document.getElementById('teamList');
    list.innerHTML = '';
    allUsers.forEach(u => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-title">${u.name}</span>
                <span style="font-size:0.8rem; opacity:0.7">@${u.username}</span>
            </div>
            <div class="item-details">
                <span class="item-status" style="background:rgba(255,255,255,0.1)">${u.role}</span>
                 <span><i class="ri-key-line"></i> ${u.password}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

// Chart ...
function updateChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx || !Chart) return;

    // Simple Aggregation
    const salesByDate = {};
    allBookings.filter(b => b.status === 'APPROVED' && b.salesAmount).forEach(b => {
        salesByDate[b.date] = (salesByDate[b.date] || 0) + Number(b.salesAmount);
    });

    if (salesChartInstance) {
        salesChartInstance.data.labels = Object.keys(salesByDate);
        salesChartInstance.data.datasets[0].data = Object.values(salesByDate);
        salesChartInstance.update();
    } else {
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(salesByDate),
                datasets: [{
                    label: 'Sales',
                    data: Object.values(salesByDate),
                    borderColor: '#8b5cf6',
                    tension: 0.4
                }]
            }
        });
    }
}


function showToast(msg, type = 'info') {
    if (typeof Toastify === 'undefined') { alert(msg); return; }
    let bg = "#3b82f6";
    if (type === 'success') bg = "#10b981";
    if (type === 'error') bg = "#ef4444";
    Toastify({ text: msg, backgroundColor: bg, duration: 2000 }).showToast();
}

function formatDate(d) { return d; } // Simplified for now

// Globals
window.openReportModal = (id) => {
    document.getElementById('reportBookingId').value = id;
    document.getElementById('reportModal').classList.remove('hidden');
};
window.closeReportModal = () => document.getElementById('reportModal').classList.add('hidden');
window.logout = logout;
window.switchView = switchView;
window.updateStatus = updateStatus;

// Start
initData();
