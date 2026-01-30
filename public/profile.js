// Check authentication
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user) {
    window.location.href = 'index.html';
}

// DOM Elements
const avatarPreview = document.getElementById('avatar-preview');
const avatarInput = document.getElementById('avatar-input');
const usernameInput = document.getElementById('username-input');
const emailDisplay = document.getElementById('email-display');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileMessage = document.getElementById('profile-message');
const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');

// Load user profile
loadProfile();

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        const profile = await response.json();

        if (response.ok) {
            usernameInput.value = profile.username;
            emailDisplay.value = profile.email;

            if (profile.avatar) {
                avatarPreview.src = profile.avatar;
            } else {
                // Default avatar with first letter
                avatarPreview.src = generateDefaultAvatar(profile.username);
            }
        } else {
            showMessage(profile.error || 'فشل تحميل البروفايل', 'error');
        }
    } catch (error) {
        console.error('Load profile error:', error);
        showMessage('حدث خطأ أثناء تحميل البروفايل', 'error');
    }
}

// Avatar upload
avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMessage('يرجى اختيار صورة فقط', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showMessage('حجم الصورة يجب أن يكون أقل من 5 ميجابايت', 'error');
        return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
        avatarPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'جاري رفع الصورة...';

        const response = await fetch('/api/profile/avatar', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('تم رفع الصورة بنجاح', 'success');

            // Update localStorage
            user.avatar = data.avatarUrl;
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            showMessage(data.error || 'فشل رفع الصورة', 'error');
        }
    } catch (error) {
        console.error('Upload avatar error:', error);
        showMessage('حدث خطأ أثناء رفع الصورة', 'error');
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'حفظ التغييرات';
    }
});

// Save profile
saveProfileBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();

    if (!username) {
        showMessage('اسم المستخدم مطلوب', 'error');
        return;
    }

    try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'جاري الحفظ...';

        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('تم حفظ التغييرات بنجاح', 'success');

            // Update localStorage
            user.username = username;
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            showMessage(data.error || 'فشل حفظ التغييرات', 'error');
        }
    } catch (error) {
        console.error('Save profile error:', error);
        showMessage('حدث خطأ أثناء حفظ التغييرات', 'error');
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'حفظ التغييرات';
    }
});

// Logout
logoutBtnSidebar.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

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

function showMessage(message, type) {
    profileMessage.textContent = message;
    profileMessage.className = `profile-message ${type}`;
    profileMessage.style.display = 'block';

    setTimeout(() => {
        profileMessage.style.display = 'none';
    }, 3000);
}

function generateDefaultAvatar(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 200, 200);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 200);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), 100, 100);

    return canvas.toDataURL();
}
