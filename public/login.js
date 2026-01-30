const form = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const joinBtn = document.getElementById('join-btn');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogin();
});

async function handleLogin() {
    const identifier = emailInput.value.trim();
    const password = passwordInput.value;

    // Clear previous errors
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';

    if (!identifier) {
        showError('الرجاء إدخال البريد الإلكتروني أو اسم المستخدم');
        return;
    }

    if (!password) {
        showError('الرجاء إدخال كلمة المرور');
        return;
    }

    // Disable button during request
    joinBtn.disabled = true;
    joinBtn.textContent = 'جاري تسجيل الدخول...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Success - save user data and redirect to dashboard
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            showError(data.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
    } catch (error) {
        showError('حدث خطأ في الاتصال بالخادم');
        console.error('Login error:', error);
    } finally {
        joinBtn.disabled = false;
        joinBtn.textContent = 'دخول';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}
