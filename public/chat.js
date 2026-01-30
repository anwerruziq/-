// Check authentication
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user) {
    window.location.href = 'index.html';
}

// Get room info from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const roomName = urlParams.get('roomName');

if (!roomId) {
    alert('معرف الغرفة غير صحيح');
    window.location.href = 'dashboard.html';
}

// DOM Elements
const chatScreen = document.getElementById('chat-screen');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const currentUserSpan = document.getElementById('current-user');
const roomNameSpan = document.getElementById('room-name');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const backBtn = document.getElementById('back-btn');
const voiceBtn = document.getElementById('voice-btn');

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Emoji elements
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

// Room settings elements
const roomSettingsBtn = document.getElementById('room-settings-btn');
const roomSettingsModal = document.getElementById('room-settings-modal');
const closeSettingsModal = document.getElementById('close-settings-modal');
const editRoomName = document.getElementById('edit-room-name');
const editInviteCode = document.getElementById('edit-invite-code');
const generateCodeBtn = document.getElementById('generate-code-btn');
const saveRoomSettings = document.getElementById('save-room-settings');
const settingsMessage = document.getElementById('settings-message');

// New Messenger UI Elements
const infoBtn = document.getElementById('info-btn');
const infoSidebar = document.getElementById('info-sidebar');
const sendBtn = document.getElementById('send-btn');
const sidebarRoomName = document.getElementById('sidebar-room-name');
const sidebarRoomAvatar = document.getElementById('sidebar-room-avatar');
const headerRoomInfo = document.getElementById('header-room-info');

let isAdmin = false;

// Header Elements
const headerInviteBtn = document.getElementById('header-invite-btn');
const headerSettingsBtn = document.getElementById('header-settings-btn');
const stickyNotification = document.getElementById('sticky-notification');
const notificationText = document.getElementById('notification-text');
const closeNotification = document.getElementById('close-notification');

// Invite members modal elements
const inviteMembersModal = document.getElementById('invite-members-modal');
const closeInviteModal = document.getElementById('close-invite-modal');
const inviteSearchInput = document.getElementById('invite-search-input');
const inviteSearchBtn = document.getElementById('invite-search-btn');
const inviteSearchResults = document.getElementById('invite-search-results');

// Emoji Configuration
const emojiMap = {
    '😊': '1F60A', '😂': '1F602', '🤣': '1F923', '❤️': '2764',
    '👍': '1F44D', '😍': '1F60D', '🙏': '1F64F', '✨': '2728',
    '🔥': '1F525', '🎉': '1F389', '😎': '1F60E', '😢': '1F622',
    '😡': '1F621', '🤔': '1F914', '🙌': '1F64C', '👋': '1F44B',
    '💪': '1F4AA', '💯': '1F4AF', '🚀': '1F680', '💀': '1F480',
    '🥰': '1F970', '🙄': '1F644', '🤫': '1F92B'
};

function parseEmojis(text) {
    if (!text) return '';
    let parsedText = text;
    Object.entries(emojiMap).forEach(([emoji, hex]) => {
        const emojiImg = `<img src="https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg/${hex}.svg" class="openmoji" alt="${emoji}">`;
        parsedText = parsedText.split(emoji).join(emojiImg);
    });
    return parsedText;
}

// Set user and room info
if (currentUserSpan) {
    currentUserSpan.textContent = user.username;
}
if (roomNameSpan) {
    roomNameSpan.textContent = roomName;
}
if (sidebarRoomName) {
    sidebarRoomName.textContent = roomName;
}

// Socket.IO connection
const socket = io();

// Authenticate and join room
socket.emit('authenticate', user.id);
socket.emit('join_room', roomId);

// Load message history and room info
loadRoomInfo();
loadMessages();

async function loadRoomInfo() {
    try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();
        const currentRoom = rooms.find(r => r.id === roomId);

        if (currentRoom) {
            isAdmin = currentRoom.is_admin === 1;
            if (roomNameSpan) {
                roomNameSpan.textContent = currentRoom.name;
            }

            if (isAdmin && roomSettingsBtn) {
                roomSettingsBtn.style.display = 'flex';
                if (editRoomName) editRoomName.value = currentRoom.name;
                if (editInviteCode) editInviteCode.value = currentRoom.invite_code || '';
            }
        }
    } catch (error) {
        console.error('Load room info error:', error);
    }
}

async function loadMessages() {
    try {
        const response = await fetch(`/api/rooms/${roomId}/messages`);
        const messages = await response.json();

        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            displayMessage(msg);
        });

        scrollToBottom();
        markAsRead();
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

// Messenger UI Toggles
if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        infoSidebar.classList.toggle('open');
        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle('active', infoSidebar.classList.contains('open'));
        }
    });
}

// Like button logic
messageInput.addEventListener('input', () => {
    if (messageInput.value.trim().length > 0) {
        sendBtn.innerHTML = "<i class='bx bxs-send'></i>";
    } else {
        sendBtn.innerHTML = "<i class='bx bxs-like'></i>";
    }
});


messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (text) {
        socket.emit('send_message', { roomId, text });
        messageInput.value = '';
        sendBtn.innerHTML = "<i class='bx bxs-like'></i>";
        messageInput.focus();
    } else {
        socket.emit('send_message', { roomId, text: '👍' });
    }
});

// file input handling through image icon
document.getElementById('file-btn').addEventListener('click', () => fileInput.click());


// File upload
fileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        fileBtn.disabled = true;
        fileBtn.textContent = 'جاري الرفع...';

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            socket.emit('send_message', {
                roomId,
                text: file.name,
                mediaUrl: data.url,
                mediaType: data.type
            });
        } else {
            alert(data.error || 'فشل رفع الملف');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('حدث خطأ أثناء رفع الملف');
    } finally {
        fileBtn.disabled = false;
        fileBtn.textContent = '📎';
        fileInput.value = '';
    }
});

// Voice Recording logic
voiceBtn.addEventListener('click', async () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await uploadVoiceNote(audioBlob);
            // Stop all tracks to release the microphone
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = "<i class='bx bx-stop-circle'></i>";
        messageInput.placeholder = "جاري التسجيل... اضغط للتوقف";
    } catch (error) {
        console.error('Microphone error:', error);
        alert('حدث خطأ أثناء الوصول للميكروفون. تأكد من إعطاء الصلاحية.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = "<i class='bx bx-microphone'></i>";
        messageInput.placeholder = "اكتب رسالة...";
    }
}

async function uploadVoiceNote(blob) {
    const formData = new FormData();
    const fileName = `voice-note-${Date.now()}.webm`;
    formData.append('file', blob, fileName);

    try {
        voiceBtn.disabled = true;
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            socket.emit('send_message', {
                roomId,
                text: 'رسالة صوتية',
                mediaUrl: data.url,
                mediaType: 'audio'
            });
        } else {
            alert(data.error || 'فشل رفع البصمة الصوتية');
        }
    } catch (error) {
        console.error('Voice upload error:', error);
        alert('حدث خطأ أثناء إرسال البصمة الصوتية');
    } finally {
        voiceBtn.disabled = false;
    }
}

// Emoji logic
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.emoji-list span').forEach(emojiSpan => {
    emojiSpan.addEventListener('click', () => {
        const emoji = emojiSpan.getAttribute('data-emoji');
        messageInput.value += emoji;
        emojiPicker.style.display = 'none';
        messageInput.focus();

        // Trigger input event to update like button status
        messageInput.dispatchEvent(new Event('input'));
    });
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = 'none';
    }
});

// Header Buttons Logic
if (headerInviteBtn && inviteMembersModal) {
    headerInviteBtn.addEventListener('click', () => {
        inviteMembersModal.style.display = 'flex';
        inviteSearchInput.value = '';
        inviteSearchResults.innerHTML = '<div class="search-hint">ابحث عن مستخدمين لدعوتهم للغرفة</div>';
    });
}

if (headerSettingsBtn && roomSettingsModal) {
    headerSettingsBtn.addEventListener('click', () => {
        roomSettingsModal.style.display = 'flex';
    });
}

// Room Settings logic (Legacy & New)
if (roomSettingsBtn && roomSettingsModal) {
    roomSettingsBtn.addEventListener('click', () => {
        roomSettingsModal.style.display = 'flex';
    });
}

// Sticky Notifications
socket.on('user_joined', (data) => {
    showStickyNotification(`انضم ${data.username} إلى المحادثة`);
});

socket.on('user_left', (data) => {
    showStickyNotification(`غادر ${data.username} المحادثة`);
});

function showStickyNotification(message) {
    if (!stickyNotification || !notificationText) return;
    notificationText.textContent = message;
    stickyNotification.classList.add('active');

    // Auto hide after 5 seconds
    setTimeout(() => {
        stickyNotification.classList.remove('active');
    }, 5000);
}

if (closeNotification) {
    closeNotification.addEventListener('click', () => {
        stickyNotification.classList.remove('active');
    });
}

// Delete Room Logic
const deleteRoomBtn = document.getElementById('delete-room-btn');
if (deleteRoomBtn) {
    deleteRoomBtn.addEventListener('click', async () => {
        if (confirm('هل أنت متأكد تماماً؟ هذا الإجراء سيحذف الغرفة وكافة محتوياتها ولا يمكن التراجع عنه.')) {
            try {
                const response = await fetch(`/api/rooms/${roomId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();

                if (response.ok) {
                    alert('تم حذف الغرفة بنجاح');
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.error || 'فشل حذف الغرفة');
                }
            } catch (error) {
                console.error('Delete room error:', error);
                alert('خطأ في الاتصال');
            }
        }
    });
}

if (closeSettingsModal && roomSettingsModal) {
    closeSettingsModal.addEventListener('click', () => {
        roomSettingsModal.style.display = 'none';
    });
}

if (generateCodeBtn && editInviteCode) {
    generateCodeBtn.addEventListener('click', () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        editInviteCode.value = code;
    });
}

if (saveRoomSettings) {
    saveRoomSettings.addEventListener('click', async () => {
        if (!editRoomName || !editInviteCode) return;
        const name = editRoomName.value.trim();
        const inviteCode = editInviteCode.value.trim();

        if (!name) {
            showSettingsError('اسم الغرفة مطلوب', 'error');
            return;
        }

        try {
            saveRoomSettings.disabled = true;
            const response = await fetch(`/api/rooms/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, inviteCode })
            });

            if (response.ok) {
                showSettingsError('تم حفظ الإعدادات بنجاح', 'success');
                roomNameSpan.textContent = name;
                setTimeout(() => {
                    if (roomSettingsModal) roomSettingsModal.style.display = 'none';
                }, 1500);
            } else {
                showSettingsError('فشل حفظ الإعدادات', 'error');
            }
        } catch (error) {
            console.error('Save room settings error:', error);
            showSettingsError('خطأ في الاتصال بالسيرفر', 'error');
        } finally {
            saveRoomSettings.disabled = false;
        }
    });
}

function showSettingsError(message, type) {
    settingsMessage.textContent = message;
    settingsMessage.className = `profile-message ${type}`;
}

// Socket events
socket.on('new_message', (data) => {
    displayMessage(data);
    scrollToBottom();

    // Play notification sound
    if (data.senderId != user.id) {
        playNotificationSound();
    }
});

socket.on('error', (data) => {
    alert(data.message || 'حدث خطأ في الاتصال');
});

function displayMessage(msg) {
    const isMe = msg.senderId == user.id || msg.sender_id == user.id;
    const senderName = msg.senderName || msg.sender_name;
    const senderAvatar = msg.senderAvatar || msg.sender_avatar;

    const msgElement = document.createElement('div');
    msgElement.classList.add('message-wrapper');
    msgElement.classList.add(isMe ? 'outgoing' : 'incoming');

    let content = '';

    // Handle media
    if (msg.mediaUrl || msg.media_url) {
        const mediaUrl = msg.mediaUrl || msg.media_url;
        const mediaType = msg.mediaType || msg.media_type;

        if (mediaType === 'image') {
            content = `<img src="${mediaUrl}" alt="صورة" class="message-image" onclick="window.open('${mediaUrl}', '_blank')">`;
        } else if (mediaType === 'video') {
            content = `<video src="${mediaUrl}" controls class="message-video"></video>`;
        } else if (mediaType === 'audio') {
            content = `<audio src="${mediaUrl}" controls class="message-audio"></audio>`;
        } else {
            content = `<a href="${mediaUrl}" target="_blank" class="message-file">📄 ${msg.text}</a>`;
        }
    } else {
        content = `<div class="content">${parseEmojis(escapeHtml(msg.text))}</div>`;
    }

    const avatarUrl = senderAvatar || generateDefaultAvatar(senderName);

    msgElement.innerHTML = `
        <img src="${avatarUrl}" class="message-avatar" title="${senderName}">
        <div class="message-box">
            <span class="sender">${isMe ? 'أنت' : senderName}</span>
            ${content}
            <span class="timestamp">${formatTime(msg.timestamp)}</span>
        </div>
    `;

    messagesContainer.appendChild(msgElement);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function markAsRead() {
    fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId })
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77eeeSwwMUKXh8LljHAU7k9r0yXkpBSh+zPLaizsKElyx6OyrWBUIQ5zd8sFuJAUuhM/z2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5YxwFO5Pa9Ml5KQUofszy2os7ChJcsejsq1gVCEOc3fLBbiQFLoTPz2Ik3CBdmue3mnEoMDFCl4fC5Yw==');
    audio.play().catch(e => console.log('Could not play sound'));
}

// Back button
backBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

// Sidebar elements
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuToggle = document.getElementById('menu-toggle');
const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');

// Mobile Sidebar Toggle
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        infoSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

// Sidebar Logout
if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }
    });
}

// ============= Invite Members =============

// Open invite modal

// Close invite modal
closeInviteModal.addEventListener('click', () => {
    inviteMembersModal.style.display = 'none';
});

// Close modal when clicking outside
inviteMembersModal.addEventListener('click', (e) => {
    if (e.target === inviteMembersModal) {
        inviteMembersModal.style.display = 'none';
    }
});

// Search for users to invite
if (inviteSearchBtn) {
    inviteSearchBtn.addEventListener('click', searchUsersToInvite);
}

if (inviteSearchInput) {
    inviteSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchUsersToInvite();
        }
    });
}

async function searchUsersToInvite() {
    const query = inviteSearchInput.value.trim();

    if (!query) {
        inviteSearchResults.innerHTML = '<div class="search-hint">الرجاء إدخال اسم مستخدم أو بريد إلكتروني</div>';
        return;
    }

    try {
        inviteSearchResults.innerHTML = '<div class="loading">جاري البحث...</div>';

        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const users = await response.json();

        if (users.length === 0) {
            inviteSearchResults.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
        } else {
            inviteSearchResults.innerHTML = users.map(u => `
                <div class="user-result">
                    <div class="user-info">
                        <div class="user-avatar">${u.username.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="user-name">${u.username}</div>
                            <div class="user-email">${u.email}</div>
                        </div>
                    </div>
                    <button class="invite-btn" data-user-id="${u.id}" data-username="${u.username}">دعوة</button>
                </div>
            `).join('');

            // Add event listeners to invite buttons
            document.querySelectorAll('.invite-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    inviteUserToRoom(btn.dataset.userId, btn.dataset.username, btn);
                });
            });
        }
    } catch (error) {
        console.error('Search error:', error);
        inviteSearchResults.innerHTML = '<div class="error">حدث خطأ أثناء البحث</div>';
    }
}

async function inviteUserToRoom(userId, username, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'جاري الدعوة...';

    try {
        const response = await fetch(`/api/rooms/${roomId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: parseInt(userId) })
        });

        const data = await response.json();

        if (response.ok) {
            button.textContent = '✓ تمت الدعوة';
            button.style.background = 'var(--success-color)';

            // Show success message
            setTimeout(() => {
                inviteMembersModal.style.display = 'none';

                // Add system message to chat
                const systemWrapper = document.createElement('div');
                systemWrapper.classList.add('system-message-wrapper');

                const systemMsg = document.createElement('div');
                systemMsg.classList.add('message', 'system');
                systemMsg.textContent = `تمت دعوة ${username} للغرفة`;

                systemWrapper.appendChild(systemMsg);
                messagesContainer.appendChild(systemWrapper);
                scrollToBottom();
            }, 1000);
        } else {
            button.textContent = originalText;
            button.disabled = false;
            alert(data.error || 'فشلت الدعوة');
        }
    } catch (error) {
        console.error('Invite error:', error);
        button.textContent = originalText;
        button.disabled = false;
        alert('حدث خطأ أثناء الدعوة');
    }
}


// ============= WebRTC Voice Call =============

let peerConnection = null;
let localStream = null;
let isCallActive = false;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

callBtn.addEventListener('click', async () => {
    if (isCallActive) {
        endCall();
    } else {
        // For simplicity, we'll implement peer-to-peer calling later
        alert('ميزة المكالمات الصوتية قيد التطوير. ستكون متاحة قريباً!');
    }
});

async function startCall(targetUserId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        peerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: targetUserId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = (event) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('call_user', {
            to: targetUserId,
            offer: offer
        });

        isCallActive = true;
        callBtn.textContent = '📞 إنهاء المكالمة';
        callBtn.classList.add('active-call');

    } catch (error) {
        console.error('Start call error:', error);
        alert('فشل بدء المكالمة. تأكد من منح الإذن للميكروفون.');
    }
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    isCallActive = false;
    callBtn.textContent = '📞 مكالمة صوتية';
    callBtn.classList.remove('active-call');

    socket.emit('end_call', { roomId });
}

// Handle incoming calls
socket.on('incoming_call', async (data) => {
    const accept = confirm('مكالمة واردة. هل تريد الرد؟');

    if (accept) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            peerConnection = new RTCPeerConnection(configuration);

            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice_candidate', {
                        to: data.from,
                        candidate: event.candidate
                    });
                }
            };

            peerConnection.ontrack = (event) => {
                const remoteAudio = document.createElement('audio');
                remoteAudio.srcObject = event.streams[0];
                remoteAudio.autoplay = true;
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit('call_answer', {
                to: data.from,
                answer: answer
            });

            isCallActive = true;
            callBtn.textContent = '📞 إنهاء المكالمة';
            callBtn.classList.add('active-call');

        } catch (error) {
            console.error('Answer call error:', error);
        }
    }
});

socket.on('call_answered', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('ice_candidate', async (data) => {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('call_ended', () => {
    endCall();
    alert('تم إنهاء المكالمة');
});

// Request notification permission
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

function generateDefaultAvatar(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const context = canvas.getContext('2d');

    // Generate background color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${Math.abs(hash) % 360}, 65%, 50%)`;

    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = 'bold 50px Arial';
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name.charAt(0).toUpperCase(), canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL();
}
