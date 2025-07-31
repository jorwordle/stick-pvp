const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    camera: { x: 0, y: 0 },
    effects: [],
    isMultiplayer: true,
    localPlayer: null,
    remotePlayer: null,
    interpolationDelay: 100 // ms
};

// Input handling
const keys = {};
const mouse = { x: 0, y: 0 };

// Player class (simplified for multiplayer)
class Player {
    constructor(x, y, color = '#4a90e2', isLocal = false) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.color = color;
        this.stickAngle = 0;
        this.stickLength = 40;
        this.stickOffset = { x: 12, y: 16 };
        this.health = 100;
        this.stamina = 100;
        this.isLocal = isLocal;
        
        // For interpolation
        this.targetX = x;
        this.targetY = y;
        this.targetStickAngle = 0;
    }

    updateFromServer(serverData) {
        this.targetX = serverData.x;
        this.targetY = serverData.y;
        this.health = serverData.health;
        this.stamina = serverData.stamina;
        this.targetStickAngle = serverData.stickAngle;
    }

    interpolate() {
        // Smooth position interpolation
        const lerpSpeed = 0.2;
        this.x += (this.targetX - this.x) * lerpSpeed;
        this.y += (this.targetY - this.y) * lerpSpeed;
        
        // Smooth stick angle interpolation
        let angleDiff = this.targetStickAngle - this.stickAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        this.stickAngle += angleDiff * lerpSpeed;
    }

    draw() {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height + 4, 
                    this.width/2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw head
        ctx.fillStyle = '#f4c4a0';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 6, this.y + 6, 3, 3);
        ctx.fillRect(this.x + 15, this.y + 6, 3, 3);

        // Draw stick
        const stickStartX = this.x + this.stickOffset.x;
        const stickStartY = this.y + this.stickOffset.y;
        const stickEndX = stickStartX + Math.cos(this.stickAngle) * this.stickLength;
        const stickEndY = stickStartY + Math.sin(this.stickAngle) * this.stickLength;

        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(stickStartX, stickStartY);
        ctx.lineTo(stickEndX, stickEndY);
        ctx.stroke();

        // Draw hand
        ctx.fillStyle = '#f4c4a0';
        ctx.beginPath();
        ctx.arc(stickStartX, stickStartY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize multiplayer
function initMultiplayer() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || 'default';
    const serverUrl = urlParams.get('server') || 'http://localhost:3000';
    
    network.connect(serverUrl, roomId);
}

// Input event listeners
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#3a6b35';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    if (network.isConnected()) {
        // Send input to server
        network.sendInput(keys, mouse.x, mouse.y);
        
        // Get server state
        const serverState = network.getState();
        if (serverState) {
            // Update or create players
            serverState.players.forEach(playerData => {
                if (playerData.id === network.getPlayerId()) {
                    // Local player
                    if (!game.localPlayer) {
                        game.localPlayer = new Player(playerData.x, playerData.y, playerData.color, true);
                    }
                    game.localPlayer.updateFromServer(playerData);
                } else {
                    // Remote player
                    if (!game.remotePlayer) {
                        game.remotePlayer = new Player(playerData.x, playerData.y, playerData.color, false);
                    }
                    game.remotePlayer.updateFromServer(playerData);
                }
            });
            
            // Update effects
            game.effects = serverState.effects || [];
        }
        
        // Interpolate positions
        if (game.localPlayer) game.localPlayer.interpolate();
        if (game.remotePlayer) game.remotePlayer.interpolate();
        
        // Draw players
        const entities = [];
        if (game.localPlayer) entities.push(game.localPlayer);
        if (game.remotePlayer) entities.push(game.remotePlayer);
        
        entities.sort((a, b) => a.y - b.y);
        entities.forEach(entity => entity.draw());
        
        // Draw effects
        drawEffects();
        
        // Draw UI
        if (game.localPlayer) {
            drawStaminaBar(game.localPlayer, 20, 20);
            drawHealthBar(game.localPlayer, 20, 50);
        }
        if (game.remotePlayer) {
            drawStaminaBar(game.remotePlayer, canvas.width - 220, 20);
            drawHealthBar(game.remotePlayer, canvas.width - 220, 50);
        }
    } else {
        // Show connection status
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Connecting to server...', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(gameLoop);
}

// Draw visual effects
function drawEffects() {
    game.effects.forEach(effect => {
        if (effect.type === 'spark') {
            ctx.fillStyle = '#ffff00';
            ctx.globalAlpha = effect.life / 10;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI * 2 * i) / 4;
                const dist = 10 - effect.life;
                ctx.beginPath();
                ctx.arc(effect.x + Math.cos(angle) * dist, 
                       effect.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (effect.type === 'hit') {
            ctx.fillStyle = '#ff0000';
            ctx.globalAlpha = effect.life / 15;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 20 - effect.life, 0, Math.PI * 2);
            ctx.fill();
            
            if (effect.life > 10) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(Math.floor(effect.damage), effect.x, effect.y - (15 - effect.life) * 2);
            }
            ctx.globalAlpha = 1;
        }
    });
}

// UI functions
function drawStaminaBar(entity, x, y) {
    const barWidth = 200;
    const barHeight = 20;
    const staminaPercent = entity.stamina / 100;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    const hue = staminaPercent * 120;
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(x + 2, y + 2, (barWidth - 4) * staminaPercent, barHeight - 4);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Stamina: ${Math.floor(entity.stamina)}/100`, x + barWidth/2, y + 14);
}

function drawHealthBar(entity, x, y) {
    const barWidth = 200;
    const barHeight = 20;
    const healthPercent = entity.health / 100;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    ctx.fillStyle = healthPercent > 0.3 ? '#4CAF50' : '#f44336';
    ctx.fillRect(x + 2, y + 2, (barWidth - 4) * healthPercent, barHeight - 4);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Health: ${Math.floor(entity.health)}/100`, x + barWidth/2, y + 14);
}

// Start game
initMultiplayer();
gameLoop();