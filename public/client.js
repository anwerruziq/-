console.log('Client script loaded');

const socket = io();

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    alert('Failed to connect to server. Please try again.');
});

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const currentUserSpan = document.getElementById('current-user');

let username = '';

joinBtn.addEventListener('click', (e) => {
    console.log('Join button clicked');
    e.preventDefault(); // Prevent any default form submission if it were inside a form
    joinChat();
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        console.log('Enter key pressed');
        joinChat();
    }
});

function joinChat() {
    const name = usernameInput.value.trim();
    console.log('Attempting to join with name:', name);

    if (name) {
        username = name;
        loginScreen.classList.remove('active');
        chatScreen.classList.add('active');
        currentUserSpan.textContent = username;
        socket.emit('join', username);
        messageInput.focus();
        console.log('Join successful, switched screens');
    } else {
        alert('Please enter a username');
    }
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (msg) {
        socket.emit('message', msg);
        messageInput.value = '';
    }
});

socket.on('message', (data) => {
    const isSystem = data.user === 'System';
    const isMe = data.user === username;

    const msgElement = document.createElement('div');
    msgElement.classList.add('message');

    if (isSystem) {
        msgElement.classList.add('system');
        msgElement.textContent = data.text;
    } else {
        msgElement.classList.add(isMe ? 'outgoing' : 'incoming');
        const sender = isMe ? 'You' : data.user;
        msgElement.innerHTML = `
            <span class="sender">${sender}</span>
            <div class="content">${data.text}</div>
        `;
    }

    messagesContainer.appendChild(msgElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});
