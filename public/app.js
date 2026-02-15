// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const chatScreen = document.getElementById('chatScreen');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

const errorMsg = document.getElementById('errorMsg');
const registerError = document.getElementById('registerError');

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const logoutBtn = document.getElementById('logoutBtn');
const chatStatus = document.getElementById('chatStatus');

let ws = null;
let currentUsername = null;

// Check authentication on load
checkAuth();

async function checkAuth() {
  try {
    const response = await fetch('/api/check-auth');
    const data = await response.json();
    
    if (data.authenticated) {
      currentUsername = data.username;
      showChatScreen();
    } else {
      showLoginScreen();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginScreen();
  }
}

// Screen navigation
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  registerScreen.classList.add('hidden');
  chatScreen.classList.add('hidden');
}

function showRegisterScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
}

function showChatScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  initWebSocket();
}

// Toggle between login and register
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  errorMsg.classList.add('hidden');
  showRegisterScreen();
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  registerError.classList.add('hidden');
  showLoginScreen();
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUsername = data.username;
      showChatScreen();
      errorMsg.classList.add('hidden');
    } else {
      errorMsg.textContent = data.error || 'Login failed';
      errorMsg.classList.remove('hidden');
    }
  } catch (error) {
    errorMsg.textContent = 'Connection error. Please try again.';
    errorMsg.classList.remove('hidden');
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUsername = data.username;
      showChatScreen();
      registerError.classList.add('hidden');
    } else {
      registerError.textContent = data.error || 'Registration failed';
      registerError.classList.remove('hidden');
    }
  } catch (error) {
    registerError.textContent = 'Connection error. Please try again.';
    registerError.classList.remove('hidden');
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
    
    if (ws) {
      ws.close();
    }
    
    currentUsername = null;
    chatMessages.innerHTML = '';
    showLoginScreen();
  } catch (error) {
    console.error('Logout error:', error);
  }
});

// WebSocket connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({
      type: 'join',
      username: currentUsername
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'waiting') {
      chatStatus.textContent = 'Looking for stranger...';
      chatStatus.classList.remove('connected');
      addSystemMessage(data.message);
      messageInput.disabled = true;
      sendBtn.disabled = true;
    } else if (data.type === 'matched') {
      chatStatus.textContent = 'Connected';
      chatStatus.classList.add('connected');
      addSystemMessage(data.message);
      messageInput.disabled = false;
      sendBtn.disabled = false;
      messageInput.focus();
    } else if (data.type === 'message') {
      addMessage(data.text, data.sender);
    } else if (data.type === 'stranger-disconnected') {
      chatStatus.textContent = 'Stranger disconnected';
      chatStatus.classList.remove('connected');
      addSystemMessage(data.message);
      messageInput.disabled = true;
      sendBtn.disabled = true;
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    chatStatus.textContent = 'Connection error';
    chatStatus.classList.remove('connected');
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    chatStatus.textContent = 'Disconnected';
    chatStatus.classList.remove('connected');
    messageInput.disabled = true;
    sendBtn.disabled = true;
  };
}

// Add message to chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  const senderLabel = document.createElement('div');
  senderLabel.className = 'message-sender';
  senderLabel.textContent = sender.toUpperCase();
  
  const messageText = document.createElement('div');
  messageText.textContent = text;
  
  messageDiv.appendChild(senderLabel);
  messageDiv.appendChild(messageText);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add system message
function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message
function sendMessage() {
  const text = messageInput.value.trim();
  
  if (text && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'message',
      text: text
    }));
    
    messageInput.value = '';
    messageInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// New chat
newChatBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    chatMessages.innerHTML = '';
    ws.send(JSON.stringify({
      type: 'new-chat'
    }));
  }
});
