// Check authentication
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user) {
    window.location.href = 'index.html';
}

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const roomsList = document.getElementById('rooms-list');
const createRoomBtn = document.getElementById('create-room-btn');
const createRoomModal = document.getElementById('create-room-modal');
const inviteModal = document.getElementById('invite-modal');
const roomNameInput = document.getElementById('room-name-input');
const confirmCreateRoomBtn = document.getElementById('confirm-create-room-btn');
const cancelRoomBtn = document.getElementById('cancel-room-btn');
const modalError = document.getElementById('modal-error');
const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');

// Logout
if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }
    });
}

// Join room by invite code
const inviteCodeInput = document.getElementById('invite-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', async () => {
        const inviteCode = inviteCodeInput.value.trim();
        if (!inviteCode) return;

        try {
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = 'جاري الانضمام...';

            const response = await fetch('/api/rooms/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inviteCode })
            });

            const data = await response.json();

            if (response.ok) {
                inviteCodeInput.value = '';
                loadRooms();
                enterRoom(data.roomId, data.roomName);
            } else {
                alert(data.error || 'كود غير صحيح');
            }
        } catch (error) {
            console.error('Join error:', error);
            alert('حدث خطأ في الاتصال');
        } finally {
            joinRoomBtn.disabled = false;
            joinRoomBtn.textContent = 'انضمام';
        }
    });
}

// Mobile Sidebar Toggle
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

// Socket.IO connection
const socket = io();

// Search users
searchBtn.addEventListener('click', searchUsers);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchUsers();
    }
});

async function searchUsers() {
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const users = await response.json();

        if (users.length === 0) {
            searchResults.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
        } else {
            searchResults.innerHTML = users.map(u => `
                <div class="user-result">
                    <div class="user-info">
                        <div class="user-avatar">${u.username.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="user-name">${u.username}</div>
                            <div class="user-email">${u.email}</div>
                        </div>
                    </div>
                    <button class="invite-user-btn" data-user-id="${u.id}" data-username="${u.username}">دعوة</button>
                </div>
            `).join('');

            // Add event listeners to invite buttons
            document.querySelectorAll('.invite-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    showInviteModal(btn.dataset.userId, btn.dataset.username);
                });
            });
        }
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="error">حدث خطأ أثناء البحث</div>';
    }
}

// Load rooms
async function loadRooms() {
    try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();

        if (rooms.length === 0) {
            roomsList.innerHTML = '<div class="no-rooms">لا توجد غرف دردشة. قم بإنشاء غرفة جديدة!</div>';
        } else {
            roomsList.innerHTML = rooms.map(room => `
                <div class="room-card" data-room-id="${room.id}">
                    <div class="room-header">
                        <h3>${room.name}</h3>
                        ${room.is_admin ? '<span class="admin-badge">مسؤول</span>' : ''}
                    </div>
                    <div class="room-info">
                        <span>👥 ${room.member_count} عضو</span>
                        ${room.unread_count > 0 ? `<span class="unread-badge">${room.unread_count}</span>` : ''}
                    </div>
                    <button class="enter-room-btn" onclick="enterRoom('${room.id}', '${room.name}')">دخول الغرفة</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Load rooms error:', error);
        roomsList.innerHTML = '<div class="error">حدث خطأ أثناء تحميل الغرف</div>';
    }
}

// Create room modal
createRoomBtn.addEventListener('click', () => {
    createRoomModal.style.display = 'flex';
    roomNameInput.value = '';
    modalError.textContent = '';
    modalError.style.display = 'none';
});

cancelRoomBtn.addEventListener('click', () => {
    createRoomModal.style.display = 'none';
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        createRoomModal.style.display = 'none';
        inviteModal.style.display = 'none';
    });
});

confirmCreateRoomBtn.addEventListener('click', async () => {
    const roomName = roomNameInput.value.trim();

    if (!roomName) {
        modalError.textContent = 'الرجاء إدخال اسم الغرفة';
        modalError.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: roomName })
        });

        const data = await response.json();

        if (response.ok) {
            createRoomModal.style.display = 'none';
            loadRooms();
        } else {
            modalError.textContent = data.error || 'حدث خطأ أثناء إنشاء الغرفة';
            modalError.style.display = 'block';
        }
    } catch (error) {
        console.error('Create room error:', error);
        modalError.textContent = 'حدث خطأ في الاتصال بالخادم';
        modalError.style.display = 'block';
    }
});

// Invite user modal
function showInviteModal(userId, username) {
    document.getElementById('invite-username').textContent = username;
    document.getElementById('invite-user-id').value = userId;
    inviteModal.style.display = 'flex';
}

document.getElementById('cancel-invite-btn').addEventListener('click', () => {
    inviteModal.style.display = 'none';
});

document.getElementById('confirm-invite-btn').addEventListener('click', async () => {
    const userId = document.getElementById('invite-user-id').value;
    const roomId = document.getElementById('invite-room-id').value;

    // For now, we'll need to select a room first
    // This is a simplified version - you might want to add room selection
    alert('يرجى تحديد غرفة أولاً من قائمة الغرف');
    inviteModal.style.display = 'none';
});

// Enter room
function enterRoom(roomId, roomName) {
    window.location.href = `chat.html?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`;
}

// Socket events
socket.on('room_created', () => {
    loadRooms();
});

socket.on('new_message', (data) => {
    // Update unread count
    loadRooms();

    // Show notification if permission granted
    if (Notification.permission === 'granted') {
        new Notification('رسالة جديدة', {
            body: `رسالة جديدة في ${data.roomName}`,
            icon: '/icon.png'
        });
    }
});

// Request notification permission
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

// Load rooms on page load
loadRooms();

// Refresh rooms every 30 seconds
setInterval(loadRooms, 30000);



