# Stranger Chat - Anonymous Text Chat Application

A real-time anonymous text chat application similar to Omegle, but text-only. Connect with random strangers and have conversations in a sleek, retro-futuristic interface.

## Features

- **User Authentication**: Secure login and registration with password hashing
- **SQLite Database**: Persistent storage of user credentials
- **Real-time Chat**: WebSocket-based instant messaging
- **Random Matching**: Automatically pairs users with strangers
- **Modern UI**: Brutalist/retro aesthetic with smooth animations
- **Session Management**: Secure session handling

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Register**: Create a new account with a username and password (minimum 6 characters)
2. **Login**: Sign in with your credentials
3. **Chat**: Once logged in, you'll be automatically matched with another online user
4. **New Chat**: Click "New Chat" to disconnect and find a new stranger
5. **Logout**: Click "Logout" to end your session

## Project Structure

```
stranger-chat/
├── server.js           # Express server with WebSocket support
├── package.json        # Project dependencies
├── chat.db            # SQLite database (created automatically)
└── public/
    ├── index.html     # Frontend HTML
    └── app.js         # Frontend JavaScript
```

## Technology Stack

- **Backend**:
  - Express.js - Web server
  - WebSocket (ws) - Real-time communication
  - SQLite3 - Database
  - bcrypt - Password hashing
  - express-session - Session management

- **Frontend**:
  - Vanilla JavaScript
  - WebSocket API
  - Custom CSS with animations

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- Session-based authentication
- SQL injection prevention through parameterized queries
- Input validation on both client and server

## Customization

You can customize the appearance by modifying the CSS variables in `public/index.html`:

```css
:root {
  --bg-main: #0a0a0a;
  --bg-card: #1a1a1a;
  --accent-1: #00ff41;
  --accent-2: #ff0080;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --border: #333333;
}
```

## Production Deployment

For production use:

1. Change the session secret in `server.js`
2. Enable secure cookies (HTTPS required)
3. Set up proper environment variables
4. Use a production-grade database (PostgreSQL, MySQL)
5. Implement rate limiting
6. Add proper logging

## License

MIT
