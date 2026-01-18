// Data Store
const STORAGE_KEY = 'tiktok_live_bookings';

// Initial Data if empty
function initData() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
}

// Helpers
function getBookings() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveBookings(bookings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    updateUI();
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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
    
    // Tiny timeout to allow display:block to apply before adding active class for fade animation
    setTimeout(() => {
        activeSection.classList.add('active');
    }, 10);

    // Update User Profile Text
    const userRole = document.querySelector('.user-info .role');
    const userName = document.querySelector('.user-info .name');
    if (viewName === 'staff') {
        userRole.textContent = 'Staff';
        userName.textContent = 'Staff Member';
    } else {
        userRole.textContent = 'Manager';
        userName.textContent = 'Admin User';
    }

    updateUI();
}

// Staff: Submit Booking
document.getElementById('bookingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const title = document.getElementById('bookingTitle').value; // Get the title

    if (!date || !time || !title) return alert('Please fill in all fields');

    const bookings = getBookings();

    // Overlap Check (Simple exact match for now)
    const isOverlap = bookings.some(b => 
        b.date === date && 
        b.time === time && 
        b.status !== 'REJECTED'
    );

    if (isOverlap) {
        alert('This time slot is already booked! Please choose another.');
        return;
    }

    const newBooking = {
        id: Date.now().toString(),
        staffName: 'Staff Member', // Mock user
        title: title,
        date,
        time,
        status: 'PENDING',
        actualViewers: null,
        salesAmount: null
    };

    bookings.push(newBooking);
    saveBookings(bookings);
    e.target.reset();
    alert('Booking requested successfully!');
});

// Render Staff Bookings
function renderStaffBookings() {
    const list = document.getElementById('staffBookingsList');
    list.innerHTML = '';
    const bookings = getBookings().filter(b => b.staffName === 'Staff Member'); // Filter for "current user"

    if (bookings.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No bookings found.</p></div>';
        return;
    }

    // Sort by date/time desc
    bookings.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    bookings.forEach(b => {
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

// Render Manager Dashboard
function renderManagerDashboard() {
    const bookings = getBookings();
    
    // Update Stats
    document.getElementById('statPending').textContent = bookings.filter(b => b.status === 'PENDING').length;
    document.getElementById('statApproved').textContent = bookings.filter(b => b.status === 'APPROVED').length;
    
    const totalSales = bookings.reduce((sum, b) => sum + (Number(b.salesAmount) || 0), 0);
    document.getElementById('statSales').textContent = '$' + totalSales.toLocaleString();

    // Render Pending Requests
    const pendingList = document.getElementById('pendingRequestsList');
    pendingList.innerHTML = '';
    const pending = bookings.filter(b => b.status === 'PENDING');

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
                    <button class="btn-sm btn-approve" onclick="updateStatus('${b.id}', 'APPROVED')">Approve</button>
                    <button class="btn-sm btn-reject" onclick="updateStatus('${b.id}', 'REJECTED')">Reject</button>
                </div>
            `;
            pendingList.appendChild(item);
        });
    }

    // Render Approved (Calendar View - simple list for now)
    const calendarList = document.getElementById('approvedCalendarList');
    calendarList.innerHTML = '';
    const approved = bookings.filter(b => b.status === 'APPROVED').sort((a,b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));

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
}

// Update Status
function updateStatus(id, newStatus) {
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
        bookings[idx].status = newStatus;
        saveBookings(bookings);
    }
}

// Modal Logic
function openReportModal(id) {
    document.getElementById('reportBookingId').value = id;
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

document.getElementById('reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('reportBookingId').value;
    const viewers = document.getElementById('actualViewers').value;
    const sales = document.getElementById('salesAmount').value;

    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
        bookings[idx].actualViewers = viewers;
        bookings[idx].salesAmount = sales;
        saveBookings(bookings);
        closeReportModal();
        e.target.reset();
    }
});

// Main Update Loop
function updateUI() {
    renderStaffBookings();
    renderManagerDashboard();
}

// Init
initData();
updateUI();
