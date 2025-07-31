# Stick Combat PvP - Multiplayer Game

A physics-based 2D multiplayer combat game where players duel with sticks. Features real-time combat, stamina management, and strategic blocking mechanics.

## 🎮 Game Features

- **Real-time 1v1 PvP combat**
- **Physics-based stick collision** - Sticks physically block each other
- **Stamina system** - Movement and attacks drain stamina, affecting speed and damage
- **Health system** - Take damage from successful hits
- **Strategic gameplay** - Time your blocks and attacks carefully

## 🚀 Deployment on Render

### Prerequisites
- GitHub account
- Render account (free tier works)
- Git installed locally

### Step 1: Prepare for Deployment

1. Clone/download this project
2. Initialize git repository:
```bash
git init
git add .
git commit -m "Initial commit"
```

### Step 2: Push to GitHub

1. Create a new repository on GitHub
2. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Render

1. Log in to [Render](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select your repository
4. Configure your service:
   - **Name**: `stick-combat-pvp` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
5. Click **"Create Web Service"**

### Step 4: Access Your Game

Once deployed, your game will be available at:
```
https://YOUR-SERVICE-NAME.onrender.com
```

## 🎯 How to Play

### Starting a Match

1. **Player 1**: 
   - Go to your Render URL
   - Enter a room name (e.g., "battle-room-1")
   - Click "Join Game"
   - Wait for opponent

2. **Player 2**: 
   - Go to the same URL
   - Enter the SAME room name
   - Click "Join Game"
   - Game starts automatically!

### Controls

- **WASD** - Move your character
- **Mouse** - Aim your stick
- Movement and stick swinging drain stamina
- Stand still to regenerate stamina
- Block attacks by positioning your stick between you and the opponent

### Combat Tips

- **Stamina Management**: Low stamina = slower movement and weaker attacks
- **Blocking**: Position your stick to intercept enemy attacks
- **Timing**: Wait for openings when your opponent is low on stamina
- **Physics**: Faster swings push through slower blocks

## 🛠️ Local Development

### Running Locally

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser to `http://localhost:3000`

### Project Structure

```
├── server.js           # Node.js game server
├── multiplayer.html    # Game client
├── game-multiplayer.js # Game logic
├── network.js          # Network handling
├── index.html          # Landing page
├── package.json        # Dependencies
└── README.md          # This file
```

## 🔧 Configuration

### Server Configuration
- Default port: 3000 (automatically uses PORT env variable on Render)
- WebSocket configuration in `server.js`

### Client Configuration
- Server URL can be changed in the join form
- Room names are case-sensitive

## 📝 Technical Details

- **Backend**: Node.js with Express and Socket.io
- **Frontend**: Vanilla JavaScript with HTML5 Canvas
- **Physics**: Server-authoritative collision detection
- **Networking**: WebSocket with client-side interpolation
- **Frame Rate**: 60 FPS server tick rate

## 🐛 Troubleshooting

### "Cannot connect to server"
- Check if server URL is correct
- Ensure no firewall is blocking WebSocket connections
- Try using HTTPS URL on Render

### "Room is full"
- Room already has 2 players
- Try a different room name

### Laggy gameplay
- Check internet connection
- Server location affects latency
- Free Render tier may have cold starts

## 📄 License

This project is open source and available for personal and educational use.