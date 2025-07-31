const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    camera: { x: 0, y: 0 },
    effects: []
};

// Input handling
const keys = {};
const mouse = { x: 0, y: 0 };

// Player class
class Player {
    constructor(x, y, color = '#4a90e2') {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.baseSpeed = 3;
        this.speed = this.baseSpeed;
        this.color = color;
        this.stickAngle = 0;
        this.targetStickAngle = 0;
        this.stickLength = 40;
        this.stickOffset = { x: 12, y: 16 };
        
        // Stamina system
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.staminaRegenRate = 0.5;
        this.movementStaminaCost = 0.3;
        this.stickMovementStaminaCost = 0.2;
        this.lastStickAngle = 0;
        this.isMoving = false;
        
        // Health system
        this.maxHealth = 100;
        this.health = this.maxHealth;
        
        // Physics
        this.stickVelocity = 0;
        this.lastStickEndX = 0;
        this.lastStickEndY = 0;
    }

    update() {
        // Check if moving
        this.isMoving = keys['w'] || keys['W'] || keys['s'] || keys['S'] || 
                       keys['a'] || keys['A'] || keys['d'] || keys['D'];
        
        // Update speed based on stamina
        const staminaPercent = this.stamina / this.maxStamina;
        this.speed = this.baseSpeed * (0.3 + 0.7 * staminaPercent); // Min 30% speed at 0 stamina
        
        // Movement with stamina cost
        if (this.isMoving && this.stamina > 0) {
            if (keys['w'] || keys['W']) this.y -= this.speed;
            if (keys['s'] || keys['S']) this.y += this.speed;
            if (keys['a'] || keys['A']) this.x -= this.speed;
            if (keys['d'] || keys['D']) this.x += this.speed;
            this.stamina = Math.max(0, this.stamina - this.movementStaminaCost);
        }

        // Calculate target stick angle based on mouse position
        const dx = mouse.x - (this.x + this.stickOffset.x);
        const dy = mouse.y - (this.y + this.stickOffset.y);
        this.targetStickAngle = Math.atan2(dy, dx);
        
        // Calculate stick movement
        let angleDiff = this.targetStickAngle - this.stickAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Apply stick movement with stamina-based lag (3x slower)
        const stickResponseSpeed = (0.05 + 0.15 * staminaPercent) / 3; // Much slower response
        const actualAngleChange = angleDiff * stickResponseSpeed;
        
        // Drain stamina for stick movement
        if (Math.abs(actualAngleChange) > 0.01) {
            this.stamina = Math.max(0, this.stamina - this.stickMovementStaminaCost * Math.abs(actualAngleChange));
        }
        
        this.stickAngle += actualAngleChange;
        
        // Calculate stick end position and velocity
        const stickEndX = this.x + this.stickOffset.x + Math.cos(this.stickAngle) * this.stickLength;
        const stickEndY = this.y + this.stickOffset.y + Math.sin(this.stickAngle) * this.stickLength;
        
        if (this.lastStickEndX !== 0 && this.lastStickEndY !== 0) {
            const dx = stickEndX - this.lastStickEndX;
            const dy = stickEndY - this.lastStickEndY;
            this.stickVelocity = Math.sqrt(dx * dx + dy * dy);
        }
        
        this.lastStickEndX = stickEndX;
        this.lastStickEndY = stickEndY;
        
        // Regenerate stamina when not moving or stick is still
        if (!this.isMoving && Math.abs(actualAngleChange) < 0.01) {
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate);
        }
    }
    
    getStickLine() {
        const startX = this.x + this.stickOffset.x;
        const startY = this.y + this.stickOffset.y;
        const endX = startX + Math.cos(this.stickAngle) * this.stickLength;
        const endY = startY + Math.sin(this.stickAngle) * this.stickLength;
        return { startX, startY, endX, endY };
    }

    draw() {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height + 4, 
                    this.width/2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw body (simple rectangle for now)
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

        // Draw hand holding stick
        ctx.fillStyle = '#f4c4a0';
        ctx.beginPath();
        ctx.arc(stickStartX, stickStartY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Dummy class (inherits from Player)
class Dummy extends Player {
    constructor(x, y) {
        super(x, y, '#e24a4a');
        this.stickAngle = Math.PI / 4; // Fixed angle for dummy
    }

    update() {
        // Dummy doesn't move for now
        // Could add AI later
    }
}

// Create player and dummy
const player = new Player(canvas.width / 2 - 12, canvas.height / 2 - 16);
const dummy = new Dummy(canvas.width / 2 + 100, canvas.height / 2 - 16);

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

// Collision detection between two line segments
function lineIntersection(p1, p2, p3, p4) {
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
            y: p1.y + t1 * d1y,
            t1: t1,
            t2: t2
        };
    }
    return null;
}

// Check stick collision
function checkStickCollision(entity1, entity2) {
    const stick1 = entity1.getStickLine();
    const stick2 = entity2.getStickLine();
    
    const intersection = lineIntersection(
        { x: stick1.startX, y: stick1.startY },
        { x: stick1.endX, y: stick1.endY },
        { x: stick2.startX, y: stick2.startY },
        { x: stick2.endX, y: stick2.endY }
    );
    
    if (intersection) {
        // Sticks are colliding - push them apart
        const v1 = entity1.stickVelocity;
        const v2 = entity2.stickVelocity;
        
        // Add collision spark effect
        game.effects.push({
            type: 'spark',
            x: intersection.x,
            y: intersection.y,
            life: 10,
            color: '#ffff00'
        });
        
        // The faster stick pushes the slower one
        if (v1 > v2) {
            // Entity1's stick pushes entity2's stick
            const pushAngle = Math.atan2(stick2.endY - stick2.startY, stick2.endX - stick2.startX);
            entity2.stickAngle += 0.1 * (v1 / (v1 + v2 + 0.1));
            entity2.targetStickAngle = entity2.stickAngle;
        } else {
            // Entity2's stick pushes entity1's stick
            const pushAngle = Math.atan2(stick1.endY - stick1.startY, stick1.endX - stick1.startX);
            entity1.stickAngle += 0.1 * (v2 / (v1 + v2 + 0.1));
            entity1.targetStickAngle = entity1.stickAngle;
        }
        
        return true;
    }
    return false;
}

// Check if stick hits body
function checkStickBodyCollision(attacker, defender) {
    const stick = attacker.getStickLine();
    
    // Simple circle collision for body
    const bodyX = defender.x + defender.width / 2;
    const bodyY = defender.y + defender.height / 2;
    const bodyRadius = defender.width / 2;
    
    // Check distance from stick line to body center
    const dx = stick.endX - bodyX;
    const dy = stick.endY - bodyY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < bodyRadius + 4) { // 4 is stick thickness
        // Calculate damage based on velocity and stamina
        const staminaMultiplier = attacker.stamina / attacker.maxStamina;
        const damage = Math.min(attacker.stickVelocity * 2 * staminaMultiplier, 10);
        
        if (damage > 1) {
            defender.health = Math.max(0, defender.health - damage);
            
            // Add hit effect
            game.effects.push({
                type: 'hit',
                x: bodyX,
                y: bodyY,
                life: 15,
                damage: damage,
                color: '#ff0000'
            });
            
            // Knockback
            const knockbackX = (stick.endX - stick.startX) * 0.1;
            const knockbackY = (stick.endY - stick.startY) * 0.1;
            defender.x += knockbackX;
            defender.y += knockbackY;
            
            return damage;
        }
    }
    return 0;
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#3a6b35';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern for pseudo-isometric feel
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

    // Update entities
    player.update();
    dummy.update();
    
    // Check collisions
    const sticksColliding = checkStickCollision(player, dummy);
    
    // Check damage only if sticks aren't blocking each other
    if (!sticksColliding) {
        checkStickBodyCollision(player, dummy);
        checkStickBodyCollision(dummy, player);
    }

    // Draw entities (draw order matters for pseudo-isometric view)
    const entities = [player, dummy].sort((a, b) => a.y - b.y);
    entities.forEach(entity => entity.draw());
    
    // Draw and update effects
    drawEffects();
    
    // Draw UI
    drawStaminaBar(player, 20, 20);
    drawStaminaBar(dummy, canvas.width - 220, 20);
    drawHealthBar(player, 20, 50);
    drawHealthBar(dummy, canvas.width - 220, 50);

    requestAnimationFrame(gameLoop);
}

// Draw visual effects
function drawEffects() {
    game.effects = game.effects.filter(effect => {
        effect.life--;
        
        if (effect.type === 'spark') {
            // Draw collision spark
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = effect.life / 10;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Small particles
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
            // Draw hit effect
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = effect.life / 15;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 20 - effect.life, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw damage number
            if (effect.life > 10) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(Math.floor(effect.damage), effect.x, effect.y - (15 - effect.life) * 2);
            }
            ctx.globalAlpha = 1;
        }
        
        return effect.life > 0;
    });
}

// Draw stamina bar
function drawStaminaBar(entity, x, y) {
    const barWidth = 200;
    const barHeight = 20;
    const staminaPercent = entity.stamina / entity.maxStamina;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Stamina fill
    const hue = staminaPercent * 120; // Red to green
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(x + 2, y + 2, (barWidth - 4) * staminaPercent, barHeight - 4);
    
    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Stamina: ${Math.floor(entity.stamina)}/${entity.maxStamina}`, x + barWidth/2, y + 14);
}

// Draw health bar
function drawHealthBar(entity, x, y) {
    const barWidth = 200;
    const barHeight = 20;
    const healthPercent = entity.health / entity.maxHealth;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Health fill
    ctx.fillStyle = healthPercent > 0.3 ? '#4CAF50' : '#f44336';
    ctx.fillRect(x + 2, y + 2, (barWidth - 4) * healthPercent, barHeight - 4);
    
    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Health: ${Math.floor(entity.health)}/${entity.maxHealth}`, x + barWidth/2, y + 14);
}

// Start game
gameLoop();