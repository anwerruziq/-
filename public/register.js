const form = document.getElementById('register-form');
const usernameInput = document.getElementById('username-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const confirmPasswordInput = document.getElementById('confirm-password-input');
const errorMessage = document.getElementById('error-message');
const registerBtn = document.getElementById('register-btn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRegister();
});

async function handleRegister() {
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear previous errors
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showError('جميع الحقول مطلوبة');
        return;
    }

    if (!validateEmail(email)) {
        showError('الرجاء إدخال بريد إلكتروني صحيح');
        return;
    }

    if (password.length < 6) {
        showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }

    if (password !== confirmPassword) {
        showError('كلمات المرور غير متطابقة');
        return;
    }

    // Disable button during request
    registerBtn.disabled = true;
    registerBtn.textContent = 'جاري الإنشاء...';

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Success - redirect to login
            alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول');
            window.location.href = 'index.html';
        } else {
            showError(data.error || 'حدث خطأ أثناء إنشاء الحساب');
        }
    } catch (error) {
        showError('حدث خطأ في الاتصال بالخادم');
        console.error('Registration error:', error);
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'إنشاء حساب';
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
