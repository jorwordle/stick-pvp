const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route for the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/play', (req, res) => {
    res.sendFile(path.join(__dirname, 'multiplayer.html'));
});

const PORT = process.env.PORT || 3000;

// Game state
const rooms = new Map();
const players = new Map();

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.gameState = {
            player1: null,
            player2: null,
            effects: []
        };
        this.updateInterval = null;
    }

    addPlayer(playerId, socketId) {
        if (this.players.length >= 2) return false;
        
        const playerData = {
            id: playerId,
            socketId: socketId,
            x: this.players.length === 0 ? 400 : 600,
            y: 400,
            health: 100,
            stamina: 100,
            stickAngle: 0,
            targetStickAngle: 0,
            stickVelocity: 0,
            lastStickEndX: 0,
            lastStickEndY: 0,
            stickArc: 0, // Track total angle change for swing power
            lastAngleChange: 0,
            color: this.players.length === 0 ? '#4a90e2' : '#e24a4a',
            // Dash mechanics
            dashReady: true,
            lastDashTime: 0,
            isDashing: false,
            dashVelocity: { x: 0, y: 0 },
            dashTime: 0,
            // Crouch mechanics
            isCrouching: false
        };
        
        this.players.push(playerData);
        
        if (this.players.length === 1) {
            this.gameState.player1 = playerData;
        } else {
            this.gameState.player2 = playerData;
            this.startGame();
        }
        
        return true;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.players.length === 0) {
            this.stopGame();
        }
    }

    startGame() {
        if (this.updateInterval) return;
        
        console.log(`Game started in room ${this.id}`);
        
        // Game update loop (60 FPS)
        this.updateInterval = setInterval(() => {
            this.updateGameState();
            this.broadcastState();
        }, 1000 / 60);
    }

    stopGame() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    updateGameState() {
        // Update player states
        this.players.forEach(player => {
            // Update stick angle with lag
            let angleDiff = player.targetStickAngle - player.stickAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            const staminaPercent = player.stamina / 100;
            const stickResponseSpeed = (0.05 + 0.15 * staminaPercent) / 1.5; // Doubled speed from /3
            const actualAngleChange = angleDiff * stickResponseSpeed;
            
            // Calculate stick velocity
            const stickLength = 60;
            const stickOffset = { x: 18, y: 24 };
            const stickEndX = player.x + stickOffset.x + Math.cos(player.stickAngle) * stickLength;
            const stickEndY = player.y + stickOffset.y + Math.sin(player.stickAngle) * stickLength;
            
            if (player.lastStickEndX !== 0 && player.lastStickEndY !== 0) {
                const dx = stickEndX - player.lastStickEndX;
                const dy = stickEndY - player.lastStickEndY;
                player.stickVelocity = Math.sqrt(dx * dx + dy * dy);
            }
            
            player.lastStickEndX = stickEndX;
            player.lastStickEndY = stickEndY;
            
            // Track swing arc for power calculation
            if (Math.sign(actualAngleChange) === Math.sign(player.lastAngleChange)) {
                // Continuing swing in same direction - accumulate arc
                player.stickArc += Math.abs(actualAngleChange);
            } else {
                // Direction changed - reset arc
                player.stickArc = Math.abs(actualAngleChange);
            }
            player.lastAngleChange = actualAngleChange;
            
            // Drain stamina for stick movement
            if (Math.abs(actualAngleChange) > 0.01) {
                player.stamina = Math.max(0, player.stamina - 0.2 * Math.abs(actualAngleChange));
            }
            
            player.stickAngle += actualAngleChange;
            
            // Regenerate stamina when not moving
            if (!player.isMoving && Math.abs(actualAngleChange) < 0.01) {
                player.stamina = Math.min(100, player.stamina + 0.5);
            }
            
            // Update dash cooldown
            if (!player.dashReady && player.lastDashTime > 0) {
                if (Date.now() - player.lastDashTime >= 10000) { // 10 second cooldown
                    player.dashReady = true;
                }
            }
            
            // Update dash movement
            if (player.isDashing) {
                player.x += player.dashVelocity.x;
                player.y += player.dashVelocity.y;
                player.dashTime -= 16; // Assuming 60fps
                
                if (player.dashTime <= 0) {
                    player.isDashing = false;
                    player.dashVelocity = { x: 0, y: 0 };
                }
                
                // Enforce boundaries during dash
                player.x = Math.max(50, Math.min(950 - 36, player.x));
                player.y = Math.max(50, Math.min(750 - 48, player.y));
            }
        });
        
        // Check collisions if we have 2 players
        if (this.players.length === 2) {
            this.checkCollisions();
        }
        
        // Update effects
        this.gameState.effects = this.gameState.effects.filter(effect => {
            effect.life--;
            return effect.life > 0;
        });
    }

    checkCollisions() {
        const p1 = this.players[0];
        const p2 = this.players[1];
        
        // Get stick lines
        const stick1 = this.getStickLine(p1);
        const stick2 = this.getStickLine(p2);
        
        // Check stick collision
        const intersection = this.lineIntersection(
            { x: stick1.startX, y: stick1.startY },
            { x: stick1.endX, y: stick1.endY },
            { x: stick2.startX, y: stick2.startY },
            { x: stick2.endX, y: stick2.endY }
        );
        
        if (intersection) {
            // Sticks colliding - add effect
            this.gameState.effects.push({
                type: 'spark',
                x: intersection.x,
                y: intersection.y,
                life: 10
            });
            
            // Calculate combat power (velocity * arc size * stamina)
            const power1 = p1.stickVelocity * (1 + Math.min(p1.stickArc, 1.5)) * (p1.stamina / 100);
            const power2 = p2.stickVelocity * (1 + Math.min(p2.stickArc, 1.5)) * (p2.stamina / 100);
            const powerDiff = Math.abs(power1 - power2);
            
            // Determine winner based on power, not just velocity
            if (power1 > power2 + 2) { // Player 1's swing is more powerful
                // Calculate angle from collision to p2's stick pivot
                const pivotX = p2.x + 18;
                const pivotY = p2.y + 24;
                const bounceAngle = Math.atan2(pivotY - intersection.y, pivotX - intersection.x);
                
                // Knock p2's stick backward with power-based force
                const bounceForce = 0.4 + (powerDiff * 0.03);
                p2.stickAngle -= bounceForce;
                p2.targetStickAngle = p2.stickAngle;
                p2.stickArc = 0; // Reset their swing arc
                
                // Slight deflection for p1's stick
                p1.stickAngle += 0.05;
                p1.targetStickAngle = p1.stickAngle;
            } else if (power2 > power1 + 2) { // Player 2's swing is more powerful
                // Calculate angle from collision to p1's stick pivot
                const pivotX = p1.x + 18;
                const pivotY = p1.y + 24;
                const bounceAngle = Math.atan2(pivotY - intersection.y, pivotX - intersection.x);
                
                // Knock p1's stick backward with power-based force
                const bounceForce = 0.4 + (powerDiff * 0.03);
                p1.stickAngle -= bounceForce;
                p1.targetStickAngle = p1.stickAngle;
                p1.stickArc = 0; // Reset their swing arc
                
                // Slight deflection for p2's stick
                p2.stickAngle += 0.05;
                p2.targetStickAngle = p2.stickAngle;
            } else { // Similar velocities - both bounce slightly
                p1.stickAngle -= 0.1;
                p1.targetStickAngle = p1.stickAngle;
                p2.stickAngle += 0.1;
                p2.targetStickAngle = p2.stickAngle;
            }
        } else {
            // Check body hits if sticks aren't blocking
            this.checkBodyHit(p1, p2);
            this.checkBodyHit(p2, p1);
        }
    }

    checkBodyHit(attacker, defender) {
        const stick = this.getStickLine(attacker);
        const bodyX = defender.x + 18;
        let bodyY = defender.y + 24;
        let bodyRadius = 18;
        
        // Adjust hitbox for crouching
        if (defender.isCrouching) {
            bodyY = defender.y + 36; // Lower center when crouched
            bodyRadius = 14; // Smaller hitbox
        }
        
        const dx = stick.endX - bodyX;
        const dy = stick.endY - bodyY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < bodyRadius + 6) { // 6 is half stick thickness
            const staminaMultiplier = attacker.stamina / 100;
            const damage = Math.min(attacker.stickVelocity * 2 * staminaMultiplier, 10);
            
            if (damage > 1) {
                defender.health = Math.max(0, defender.health - damage);
                
                // Add hit effect
                this.gameState.effects.push({
                    type: 'hit',
                    x: bodyX,
                    y: bodyY,
                    life: 15,
                    damage: damage
                });
                
                // Knockback
                const knockbackX = (stick.endX - stick.startX) * 0.1;
                const knockbackY = (stick.endY - stick.startY) * 0.1;
                defender.x += knockbackX;
                defender.y += knockbackY;
                
                // Enforce boundaries after knockback
                defender.x = Math.max(50, Math.min(950 - 36, defender.x));
                defender.y = Math.max(50, Math.min(750 - 48, defender.y));
            }
        }
    }

    getStickLine(player) {
        const stickLength = 60;
        const stickOffset = { x: 18, y: 24 };
        const startX = player.x + stickOffset.x;
        const startY = player.y + stickOffset.y;
        const endX = startX + Math.cos(player.stickAngle) * stickLength;
        const endY = startY + Math.sin(player.stickAngle) * stickLength;
        return { startX, startY, endX, endY };
    }

    lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        
        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 0.0001) return null;
        
        const t1 = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
        const t2 = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
        
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return {
                x: p1.x + t1 * d1x,
                y: p1.y + t1 * d1y
            };
        }
        return null;
    }

    broadcastState() {
        const state = {
            players: this.players.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                health: p.health,
                stamina: p.stamina,
                stickAngle: p.stickAngle,
                color: p.color,
                dashReady: p.dashReady,
                isDashing: p.isDashing,
                isCrouching: p.isCrouching
            })),
            effects: this.gameState.effects
        };
        
        io.to(this.id).emit('gameState', state);
    }

    handlePlayerInput(playerId, input) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;
        
        // Map boundaries
        const mapBounds = {
            left: 50,
            right: 950,
            top: 50,
            bottom: 750
        };
        
        // Update player movement
        const staminaPercent = player.stamina / 100;
        let speed = 3 * (0.3 + 0.7 * staminaPercent);
        
        player.isMoving = false;
        
        // Handle crouch
        player.isCrouching = input.keys['Shift'] || input.keys['Control'];
        
        // Reduce speed when crouching
        if (player.isCrouching) {
            speed *= 0.5;
        }
        
        // Don't allow movement during dash
        if (!player.isDashing) {
            if (input.keys['w'] || input.keys['W']) {
                player.y = Math.max(mapBounds.top, player.y - speed);
                player.isMoving = true;
            }
            if (input.keys['s'] || input.keys['S']) {
                player.y = Math.min(mapBounds.bottom - 48, player.y + speed); // 48 is player height
                player.isMoving = true;
            }
            if (input.keys['a'] || input.keys['A']) {
                player.x = Math.max(mapBounds.left, player.x - speed);
                player.isMoving = true;
            }
            if (input.keys['d'] || input.keys['D']) {
                player.x = Math.min(mapBounds.right - 36, player.x + speed); // 36 is player width
                player.isMoving = true;
            }
        }
        
        // Drain stamina for movement
        if (player.isMoving && player.stamina > 0) {
            player.stamina = Math.max(0, player.stamina - 0.3);
        }
        
        // Update stick target angle
        const dx = input.mouseX - (player.x + 18);
        const dy = input.mouseY - (player.y + 24);
        player.targetStickAngle = Math.atan2(dy, dx);
        
        // Handle dash activation (left click)
        if (input.leftClick && player.dashReady && !player.isDashing) {
            // Calculate dash direction based on movement input
            let dashDirX = 0;
            let dashDirY = 0;
            
            if (input.keys['w'] || input.keys['W']) dashDirY = -1;
            if (input.keys['s'] || input.keys['S']) dashDirY = 1;
            if (input.keys['a'] || input.keys['A']) dashDirX = -1;
            if (input.keys['d'] || input.keys['D']) dashDirX = 1;
            
            // If no movement keys, dash toward mouse
            if (dashDirX === 0 && dashDirY === 0) {
                const mouseDist = Math.sqrt(dx * dx + dy * dy);
                if (mouseDist > 0) {
                    dashDirX = dx / mouseDist;
                    dashDirY = dy / mouseDist;
                }
            }
            
            // Normalize diagonal dashes
            const dashMag = Math.sqrt(dashDirX * dashDirX + dashDirY * dashDirY);
            if (dashMag > 0) {
                dashDirX /= dashMag;
                dashDirY /= dashMag;
                
                // Start dash
                player.isDashing = true;
                player.dashReady = false;
                player.lastDashTime = Date.now();
                player.dashTime = 250; // 0.25 seconds
                player.dashVelocity = {
                    x: dashDirX * 8, // Dash speed
                    y: dashDirY * 8
                };
                
                // Add dash effect
                this.gameState.effects.push({
                    type: 'dash',
                    x: player.x + 18,
                    y: player.y + 24,
                    life: 10,
                    color: player.color
                });
            }
        }
    }
}

// Socket.IO events
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    socket.on('joinRoom', (data) => {
        const { roomId, playerId } = data;
        
        // Always use the global room
        const globalRoomId = 'global';
        let room = rooms.get(globalRoomId);
        if (!room) {
            room = new GameRoom(globalRoomId);
            rooms.set(globalRoomId, room);
        }
        
        if (room.addPlayer(playerId, socket.id)) {
            socket.join(globalRoomId);
            players.set(socket.id, { playerId, roomId: globalRoomId });
            
            socket.emit('joinedRoom', {
                playerId,
                roomId: globalRoomId,
                playerNumber: room.players.length
            });
            
            if (room.players.length === 2) {
                io.to(globalRoomId).emit('gameStart');
            }
        } else {
            socket.emit('roomFull');
        }
    });
    
    socket.on('playerInput', (input) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const room = rooms.get(playerInfo.roomId);
        if (room) {
            room.handlePlayerInput(playerInfo.playerId, input);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const playerInfo = players.get(socket.id);
        if (playerInfo) {
            const room = rooms.get(playerInfo.roomId);
            if (room) {
                room.removePlayer(playerInfo.playerId);
                if (room.players.length === 0) {
                    rooms.delete(playerInfo.roomId);
                } else {
                    io.to(playerInfo.roomId).emit('playerDisconnected', playerInfo.playerId);
                }
            }
            players.delete(socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});