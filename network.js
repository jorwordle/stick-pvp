class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomId = null;
        this.playerId = null;
        this.playerNumber = null;
        this.gameStarted = false;
        this.serverState = null;
        this.inputBuffer = [];
        this.lastInputTime = 0;
        this.inputDelay = 1000 / 60; // 60 FPS input rate
    }

    connect(serverUrl, roomId) {
        this.roomId = roomId;
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        
        this.socket = io(serverUrl);
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.joinRoom();
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.gameStarted = false;
        });
        
        this.socket.on('joinedRoom', (data) => {
            this.playerId = data.playerId;
            this.playerNumber = data.playerNumber;
            console.log(`Joined room ${data.roomId} as player ${data.playerNumber}`);
            
            // Update UI
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.textContent = `Connected as Player ${data.playerNumber}. Waiting for opponent...`;
            }
        });
        
        this.socket.on('roomFull', () => {
            console.log('Room is full');
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.textContent = 'Room is full. Try another room.';
            }
        });
        
        this.socket.on('gameStart', () => {
            console.log('Game started!');
            this.gameStarted = true;
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.textContent = 'Game started!';
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 2000);
            }
        });
        
        this.socket.on('gameState', (state) => {
            this.serverState = state;
        });
        
        this.socket.on('playerDisconnected', (playerId) => {
            console.log('Player disconnected:', playerId);
            this.gameStarted = false;
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = 'Opponent disconnected. Waiting for new player...';
            }
        });
    }

    joinRoom() {
        if (this.socket && this.connected) {
            this.socket.emit('joinRoom', {
                roomId: this.roomId,
                playerId: this.playerId
            });
        }
    }

    sendInput(keys, mouseX, mouseY) {
        if (!this.connected || !this.gameStarted) return;
        
        const now = Date.now();
        if (now - this.lastInputTime < this.inputDelay) return;
        
        this.lastInputTime = now;
        
        const input = {
            keys: keys,
            mouseX: mouseX,
            mouseY: mouseY,
            timestamp: now
        };
        
        this.socket.emit('playerInput', input);
        this.inputBuffer.push(input);
        
        // Keep only last 60 frames of input
        if (this.inputBuffer.length > 60) {
            this.inputBuffer.shift();
        }
    }

    getState() {
        return this.serverState;
    }

    isConnected() {
        return this.connected && this.gameStarted;
    }

    getPlayerId() {
        return this.playerId;
    }

    getPlayerNumber() {
        return this.playerNumber;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Create global network instance
const network = new NetworkManager();