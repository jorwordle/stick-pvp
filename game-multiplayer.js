const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Weapon configurations (mirror server)
const WEAPONS = {
    stick: {
        name: 'Stick',
        length: 60,
        color: '#8b4513',
        thickness: 6
    },
    bow: {
        name: 'Bow', 
        length: 65,
        color: '#654321',
        thickness: 4
    }
};

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
let leftClickPressed = false;
let rightClickPressed = false;

// Player class (simplified for multiplayer)
class Player {
    constructor(x, y, color = '#4a90e2', isLocal = false) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 48;
        this.color = color;
        this.stickAngle = 0;
        this.stickLength = 60;
        this.stickOffset = { x: 18, y: 24 };
        this.health = 10000;
        this.stamina = 100;
        this.isLocal = isLocal;
        
        // For interpolation
        this.targetX = x;
        this.targetY = y;
        this.targetStickAngle = 0;
        
        // Dash and crouch states
        this.dashReady = false;
        this.isDashing = false;
        this.isCrouching = false;
        
        // Weapon states
        this.currentWeapon = 'stick';
        this.isCharging = false;
        this.chargeLevel = 0;
        this.weapons = ['stick', 'bow'];
        this.selectedWeaponSlot = 0;
    }

    updateFromServer(serverData) {
        this.targetX = serverData.x;
        this.targetY = serverData.y;
        this.health = serverData.health;
        this.stamina = serverData.stamina;
        this.targetStickAngle = serverData.stickAngle;
        this.dashReady = serverData.dashReady;
        this.isDashing = serverData.isDashing;
        this.isCrouching = serverData.isCrouching;
        this.currentWeapon = serverData.currentWeapon;
        this.isCharging = serverData.isCharging;
        this.chargeLevel = serverData.chargeLevel;
        this.weapons = serverData.weapons;
        this.selectedWeaponSlot = serverData.selectedWeaponSlot;
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
        // Save context for potential transformations
        ctx.save();
        
        // Apply crouch transformation
        let drawHeight = this.height;
        let yOffset = 0;
        if (this.isCrouching) {
            drawHeight = this.height * 0.6;
            yOffset = this.height * 0.4;
        }
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height + 4, 
                    this.width/2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y + yOffset, this.width, drawHeight);
        
        // Draw head
        ctx.fillStyle = '#f4c4a0';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + yOffset + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 10, this.y + yOffset + 9, 4, 4);
        ctx.fillRect(this.x + 22, this.y + yOffset + 9, 4, 4);

        // Draw weapon
        const weapon = WEAPONS[this.currentWeapon] || WEAPONS.stick;
        const stickStartX = this.x + this.stickOffset.x;
        const stickStartY = this.y + this.stickOffset.y + (this.isCrouching ? yOffset : 0);

        if (this.currentWeapon === 'bow') {
            // Always draw bow vertically
            const bowStartX = stickStartX - 5;
            const bowStartY = stickStartY - weapon.length * 0.3;
            const bowEndX = bowStartX;
            const bowEndY = bowStartY + weapon.length;
            
            // Calculate bow curve based on charge
            const baseCurve = 10;
            const chargeCurve = this.isCharging ? baseCurve + (this.chargeLevel / 100) * 15 : baseCurve;
            
            // Bow frame
            ctx.strokeStyle = weapon.color;
            ctx.lineWidth = weapon.thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const bowMidY = (bowStartY + bowEndY) / 2;
            ctx.moveTo(bowStartX, bowStartY);
            ctx.quadraticCurveTo(bowStartX - chargeCurve, bowMidY, bowEndX, bowEndY);
            ctx.stroke();
            
            // Calculate string position
            let stringX = bowStartX;
            let stringMidX = bowStartX;
            
            if (this.isCharging) {
                // Pull string back based on charge level
                const pullback = (this.chargeLevel / 100) * 20;
                stringMidX = bowStartX + pullback;
                
                // Draw pulled string
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bowStartX, bowStartY);
                ctx.lineTo(stringMidX, bowMidY);
                ctx.lineTo(bowEndX, bowEndY);
                ctx.stroke();
                
                // Draw arrow on string
                const arrowAngle = this.stickAngle;
                const arrowLength = 30;
                const arrowStartX = stringMidX;
                const arrowStartY = bowMidY;
                const arrowEndX = arrowStartX + Math.cos(arrowAngle) * arrowLength;
                const arrowEndY = arrowStartY + Math.sin(arrowAngle) * arrowLength;
                
                // Arrow shaft
                ctx.strokeStyle = '#654321';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(arrowStartX - Math.cos(arrowAngle) * 10, 
                           arrowStartY - Math.sin(arrowAngle) * 10);
                ctx.lineTo(arrowEndX, arrowEndY);
                ctx.stroke();
                
                // Arrow head
                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.save();
                ctx.translate(arrowEndX, arrowEndY);
                ctx.rotate(arrowAngle);
                ctx.moveTo(0, 0);
                ctx.lineTo(-5, -3);
                ctx.lineTo(-5, 3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                
                // Charge glow
                if (this.chargeLevel > 20) {
                    ctx.fillStyle = `rgba(255, 255, 0, ${this.chargeLevel / 200})`;
                    ctx.beginPath();
                    ctx.arc(arrowStartX, arrowStartY, 5 + this.chargeLevel / 20, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Show charge percentage for debugging
                if (this.isLocal) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${Math.floor(this.chargeLevel)}%`, bowStartX, bowStartY - 10);
                }
            } else {
                // Bow string at rest
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bowStartX, bowStartY);
                ctx.lineTo(bowEndX, bowEndY);
                ctx.stroke();
            }
        } else {
            // Normal weapon drawing (stick)
            const stickEndX = stickStartX + Math.cos(this.stickAngle) * weapon.length;
            const stickEndY = stickStartY + Math.sin(this.stickAngle) * weapon.length;
            
            ctx.strokeStyle = weapon.color;
            ctx.lineWidth = weapon.thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(stickStartX, stickStartY);
            ctx.lineTo(stickEndX, stickEndY);
            ctx.stroke();
        }

        // Draw hand
        ctx.fillStyle = '#f4c4a0';
        ctx.beginPath();
        ctx.arc(stickStartX, stickStartY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw dash indicator
        if (this.dashReady) {
            // Ready - green circle
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, 25, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.isLocal) {
            // Show cooldown for local player only
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Dash', this.x + this.width/2, this.y - 5);
        }
        
        ctx.restore();
    }
}

// Initialize multiplayer
function initMultiplayer() {
    // Auto-detect server URL from current location
    const protocol = window.location.protocol;
    const host = window.location.host;
    const serverUrl = `${protocol}//${host}`;
    
    // Everyone joins the same room automatically
    network.connect(serverUrl, 'global');
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

canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 0) { // Left click
        leftClickPressed = true;
    } else if (e.button === 2) { // Right click
        rightClickPressed = true;
    }
});

canvas.addEventListener('mouseup', (e) => {
    e.preventDefault();
    if (e.button === 0) { // Left click
        leftClickPressed = false;
    } else if (e.button === 2) { // Right click
        rightClickPressed = false;
    }
});

// Prevent context menu on right click
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
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
    
    // Draw map borders
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.strokeRect(50, 50, 900, 700);
    
    // Draw corner markers
    ctx.fillStyle = '#888';
    const corners = [[50, 50], [950, 50], [50, 750], [950, 750]];
    corners.forEach(([x, y]) => {
        ctx.fillRect(x - 5, y - 5, 10, 10);
    });

    if (network.isConnected()) {
        // Send input to server with left and right click states
        network.sendInput(keys, mouse.x, mouse.y, leftClickPressed, rightClickPressed);
        leftClickPressed = false; // Reset after sending
        
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
            
            // Update effects and projectiles
            game.effects = serverState.effects || [];
            game.projectiles = serverState.projectiles || [];
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
        
        // Draw projectiles
        drawProjectiles();
        
        // Draw effects
        drawEffects();
        
        // Draw UI
        if (game.localPlayer) {
            drawStaminaBar(game.localPlayer, 20, 20);
            drawHealthBar(game.localPlayer, 20, 50);
            drawDashIndicator(game.localPlayer, 20, 80);
        }
        if (game.remotePlayer) {
            drawStaminaBar(game.remotePlayer, canvas.width - 220, 20);
            drawHealthBar(game.remotePlayer, canvas.width - 220, 50);
            drawDashIndicator(game.remotePlayer, canvas.width - 220, 80);
        }
        
        // Draw hotbar
        drawHotbar();
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
        } else if (effect.type === 'dash') {
            // Draw dash trail
            ctx.strokeStyle = effect.color || '#4a90e2';
            ctx.globalAlpha = effect.life / 10;
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(effect.x, effect.y);
            ctx.lineTo(effect.x - 30, effect.y);
            ctx.stroke();
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
    const healthPercent = entity.health / 10000;
    
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
    ctx.fillText(`Health: ${Math.floor(entity.health)}/10000`, x + barWidth/2, y + 14);
}

// Draw dash indicator
function drawDashIndicator(entity, x, y) {
    const barWidth = 200;
    const barHeight = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    if (entity.dashReady) {
        // Dash ready - full green bar
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(x + 2, y + 2, barWidth - 4, barHeight - 4);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Dash Ready! (Left Click)', x + barWidth/2, y + 14);
    } else {
        // Show cooldown progress
        ctx.fillStyle = '#666';
        ctx.fillRect(x + 2, y + 2, barWidth - 4, barHeight - 4);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Dash Cooldown', x + barWidth/2, y + 14);
    }
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
}

// Draw projectiles
function drawProjectiles() {
    if (!game.projectiles) return;
    
    game.projectiles.forEach(projectile => {
        ctx.save();
        
        // Calculate arrow angle
        const angle = Math.atan2(projectile.vy, projectile.vx);
        
        // Draw arrow
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(angle);
        
        // Arrow shaft
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        
        // Arrow head
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -3);
        ctx.lineTo(5, 3);
        ctx.closePath();
        ctx.fill();
        
        // Arrow fletching
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-8, -2);
        ctx.lineTo(-8, 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    });
}

// Draw weapon hotbar
function drawHotbar() {
    if (!game.localPlayer) return;
    
    const slotSize = 60;
    const slotSpacing = 10;
    const hotbarY = canvas.height - 80;
    const totalWidth = game.localPlayer.weapons.length * slotSize + 
                      (game.localPlayer.weapons.length - 1) * slotSpacing;
    const startX = (canvas.width - totalWidth) / 2;
    
    game.localPlayer.weapons.forEach((weaponName, index) => {
        const x = startX + index * (slotSize + slotSpacing);
        const selected = index === game.localPlayer.selectedWeaponSlot;
        
        // Draw slot background
        ctx.fillStyle = selected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, hotbarY, slotSize, slotSize);
        
        // Draw slot border
        ctx.strokeStyle = selected ? '#fff' : '#666';
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(x, hotbarY, slotSize, slotSize);
        
        // Draw weapon icon
        const weapon = WEAPONS[weaponName];
        ctx.strokeStyle = weapon.color;
        ctx.lineWidth = weapon.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 10, hotbarY + slotSize - 10);
        ctx.lineTo(x + slotSize - 10, hotbarY + 10);
        ctx.stroke();
        
        // Draw slot number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText((index + 1).toString(), x + 5, hotbarY + 15);
        
        // Draw weapon name
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(weapon.name, x + slotSize/2, hotbarY + slotSize - 5);
    });
}

// Start game
initMultiplayer();
gameLoop();