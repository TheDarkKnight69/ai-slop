const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database setup
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true with HTTPS
}));

// Authentication endpoints
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
      [username, hashedPassword], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        
        req.session.userId = this.lastID;
        req.session.username = username;
        res.json({ success: true, username });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    try {
      const match = await bcrypt.compare(password, user.password);
      
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ success: true, username: user.username });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// WebSocket chat logic
const waitingUsers = [];
const activeChats = new Map();
const userConnections = new Map(); // Track username -> websocket connections

wss.on('connection', (ws) => {
  let currentUser = null;
  let chatPartner = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'join') {
        currentUser = data.username;
        ws.username = currentUser;
        
        // Track this connection
        if (!userConnections.has(currentUser)) {
          userConnections.set(currentUser, []);
        }
        userConnections.get(currentUser).push(ws);
        
        // Try to match with waiting user (but not with yourself)
        let partner = null;
        let foundPartner = false;
        
        while (waitingUsers.length > 0 && !foundPartner) {
          const potentialPartner = waitingUsers.shift();
          
          // Make sure we don't match with ourselves (same username)
          if (potentialPartner.username !== currentUser) {
            partner = potentialPartner;
            foundPartner = true;
          }
        }
        
        if (foundPartner && partner) {
          chatPartner = partner;
          partner.chatPartner = ws;
          ws.chatPartner = partner;
          
          // Create chat room
          const chatId = Date.now().toString();
          activeChats.set(ws, chatId);
          activeChats.set(partner, chatId);
          
          // Notify both users
          ws.send(JSON.stringify({ 
            type: 'matched', 
            message: 'You are now connected with a stranger!' 
          }));
          partner.send(JSON.stringify({ 
            type: 'matched', 
            message: 'You are now connected with a stranger!' 
          }));
        } else {
          waitingUsers.push(ws);
          ws.send(JSON.stringify({ 
            type: 'waiting', 
            message: 'Looking for someone to chat with...' 
          }));
        }
      } else if (data.type === 'message') {
        if (ws.chatPartner && ws.chatPartner.readyState === WebSocket.OPEN) {
          ws.chatPartner.send(JSON.stringify({
            type: 'message',
            text: data.text,
            sender: 'stranger'
          }));
        }
      } else if (data.type === 'disconnect') {
        if (ws.chatPartner && ws.chatPartner.readyState === WebSocket.OPEN) {
          ws.chatPartner.send(JSON.stringify({
            type: 'stranger-disconnected',
            message: 'Stranger has disconnected.'
          }));
          ws.chatPartner.chatPartner = null;
        }
        ws.chatPartner = null;
        activeChats.delete(ws);
      } else if (data.type === 'new-chat') {
        // End current chat if exists
        if (ws.chatPartner && ws.chatPartner.readyState === WebSocket.OPEN) {
          ws.chatPartner.send(JSON.stringify({
            type: 'stranger-disconnected',
            message: 'Stranger has disconnected.'
          }));
          ws.chatPartner.chatPartner = null;
        }
        ws.chatPartner = null;
        activeChats.delete(ws);
        
        // Join waiting pool - try to match with waiting user (but not yourself)
        let partner = null;
        let foundPartner = false;
        
        while (waitingUsers.length > 0 && !foundPartner) {
          const potentialPartner = waitingUsers.shift();
          
          // Make sure we don't match with ourselves (same username)
          if (potentialPartner.username !== currentUser) {
            partner = potentialPartner;
            foundPartner = true;
          }
        }
        
        if (foundPartner && partner) {
          chatPartner = partner;
          partner.chatPartner = ws;
          ws.chatPartner = partner;
          
          const chatId = Date.now().toString();
          activeChats.set(ws, chatId);
          activeChats.set(partner, chatId);
          
          ws.send(JSON.stringify({ 
            type: 'matched', 
            message: 'You are now connected with a stranger!' 
          }));
          partner.send(JSON.stringify({ 
            type: 'matched', 
            message: 'You are now connected with a stranger!' 
          }));
        } else {
          waitingUsers.push(ws);
          ws.send(JSON.stringify({ 
            type: 'waiting', 
            message: 'Looking for someone to chat with...' 
          }));
        }
      }
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove from waiting list
    const index = waitingUsers.indexOf(ws);
    if (index > -1) {
      waitingUsers.splice(index, 1);
    }
    
    // Clean up user connections tracking
    if (currentUser && userConnections.has(currentUser)) {
      const connections = userConnections.get(currentUser);
      const connIndex = connections.indexOf(ws);
      if (connIndex > -1) {
        connections.splice(connIndex, 1);
      }
      // Remove the user entry if no more connections
      if (connections.length === 0) {
        userConnections.delete(currentUser);
      }
    }
    
    // Notify partner
    if (ws.chatPartner && ws.chatPartner.readyState === WebSocket.OPEN) {
      ws.chatPartner.send(JSON.stringify({
        type: 'stranger-disconnected',
        message: 'Stranger has disconnected.'
      }));
      ws.chatPartner.chatPartner = null;
    }
    
    activeChats.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
