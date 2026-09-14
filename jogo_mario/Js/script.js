const board = document.querySelector('.game-board');
const player = document.querySelector('.player');
const hills = document.querySelector('.hills');
const menu = document.querySelector('#menu');
const message = document.querySelector('#message');
const pauseMenu = document.querySelector('#pause');
const savedButton = document.querySelector('#continue-saved');
const scoreLabel = document.querySelector('#score');
const livesLabel = document.querySelector('#lives');
const stageLabel = document.querySelector('#stage');
const timeLabel = document.querySelector('#time');
const reloadIcon = document.querySelector('#reload');
const powerLabel = document.querySelector('#power-label');
const arenaLabel = document.querySelector('#arena-status');
const rewardMenu = document.querySelector('#reward');
const rewardOptions = document.querySelector('#reward-options');
const runLabel = document.querySelector('#run-status');

const stages = [
    { speed: 230, spawn: 1.8, types: ['goomba'] },
    { speed: 270, spawn: 1.55, types: ['goomba', 'koopa'] },
    { speed: 315, spawn: 1.35, types: ['goomba', 'koopa'] },
    { speed: 355, spawn: 1.15, types: ['goomba', 'koopa'] },
    { speed: 410, spawn: .95, types: ['goomba', 'koopa'] },
];

const sizes = {
    goomba: [48, 48],
    koopa: [48, 48],
};
const saveKey = 'marioPlusStage';
const worldScale = 1.65;
const bossScale = 3 * .65;
const hatScale = 3 * .5;
const bossTempo = 1.5;
const runSaveKey = 'marioPlusRun';
const upgrades = {
    flame: { name: 'Chama forte', text: '+1 de dano por bola de fogo.', max: 2 },
    reload: { name: 'Recarga rápida', text: 'Recarga 0,25s menor.', max: 3 },
    boots: { name: 'Botas velozes', text: '+12% de velocidade de movimento.', max: 2 },
    heart: { name: 'Coração extra', text: '+1 vida máxima e recupera 1 vida.', max: 2 },
    doubleJump: { name: 'Pulo duplo', text: 'Aperte pular outra vez no ar.', max: 1 },
    shield: { name: 'Escudo', text: 'Bloqueia um golpe. Renova a cada fase.', max: 1 },
};
const upgradeLevel = id => state.upgrades?.[id] || 0;
const maxLives = () => 3 + upgradeLevel('heart');

console.assert(stages.length === 5 && stages.every(stage => stage.spawn > 0 && stage.speed > 0), 'Configuração das fases inválida');

let state = {};
let entities = [];
let animationId;
const keys = new Set();
const random = (min, max) => min + Math.random() * (max - min);

function loadStage() {
    try {
        const saved = localStorage.getItem(saveKey);
        if (saved === null) return null;
        const stage = Number(saved);
        return Number.isInteger(stage) && stage >= 0 && stage < stages.length ? stage : null;
    } catch {
        return null;
    }
}

function loadRun() {
    try {
        const raw = localStorage.getItem(runSaveKey);
        if (raw === null) {
            const stage = loadStage();
            return stage === null ? null : { stage, upgrades: {}, offers: [], lives: 3, score: 0 };
        }
        const run = JSON.parse(raw);
        if (!run || run.version !== 1 || !Number.isInteger(run.stage) || run.stage < 0 || run.stage >= stages.length ||
            !['mario', 'luigi'].includes(run.character) || !run.upgrades || typeof run.upgrades !== 'object' || Array.isArray(run.upgrades)) return null;
        const entries = Object.entries(run.upgrades);
        if (entries.some(([id, level]) => !Object.hasOwn(upgrades, id) || !Number.isInteger(level) || level < 1 || level > upgrades[id].max) ||
            entries.reduce((sum, [, level]) => sum + level, 0) > run.stage) return null;
        if (!Number.isInteger(run.lives) || run.lives < 1 || run.lives > 3 + (run.upgrades.heart || 0) ||
            !Number.isInteger(run.score) || run.score < 0 || run.score > 10000000) return null;
        if (!Number.isInteger(run.shield) || run.shield < 0 || run.shield > (run.upgrades.shield || 0)) return null;
        if (!Array.isArray(run.offers) || ![0, 3].includes(run.offers.length) || new Set(run.offers).size !== run.offers.length ||
            run.offers.some(id => !Object.hasOwn(upgrades, id) || (run.upgrades[id] || 0) >= upgrades[id].max) ||
            (run.offers.length && (run.stage === 0 || entries.reduce((sum, [, level]) => sum + level, 0) >= run.stage))) return null;
        return run;
    } catch { return null; }
}

function saveRun() {
    if (!state.running || state.lives <= 0 || state.stage >= stages.length) return;
    try {
        localStorage.setItem(runSaveKey, JSON.stringify({ version: 1, stage: state.stage, character: state.character,
            upgrades: state.upgrades, offers: state.offers, lives: state.lives, score: state.score, shield: state.shield }));
        localStorage.removeItem(saveKey);
    } catch { /* Jogo continua caso navegador bloqueie armazenamento. */ }
}

function refreshContinue() {
    const run = loadRun();
    savedButton.classList.toggle('hidden', run === null);
    if (run) savedButton.textContent = `Continuar corrida · fase ${run.stage + 1}`;
}

function resetState(startStage = 0, saved = null) {
    keys.clear();
    entities.forEach(({ element }) => element.remove());
    entities = [];
    state = {
        running: true,
        paused: false,
        character: saved?.character || document.querySelector('.character.selected').dataset.character,
        stage: startStage,
        stageTime: 0,
        spawnTime: 0,
        score: saved?.score ?? 0,
        lives: saved?.lives ?? 3,
        upgrades: { ...saved?.upgrades },
        offers: saved?.offers?.slice() || [],
        rewardPending: false,
        jumpsUsed: 0,
        playerX: board.clientWidth * .07,
        playerY: 0,
        velocityY: 0,
        facing: 1,
        action: 'idle',
        shooting: 0,
        onGround: true,
        fireCooldown: 0,
        invulnerable: 0,
        lastTime: performance.now(),
        boardWidth: board.clientWidth,
        worldWidth: board.clientWidth * worldScale,
        cameraX: 0,
        playerWidth: player.offsetWidth,
        playerHeight: player.offsetHeight,
        hud: '',
        powerHud: '',
        transitioning: false,
        exitUnlocked: false,
    };
    player.className = `player ${state.character}`;
    player.setAttribute('aria-label', state.character === 'mario' ? 'Mario' : 'Luigi');
    board.className = `game-board theme-${startStage + 1}`;
    menu.classList.add('hidden');
    message.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    rewardMenu.classList.add('hidden');
    setupStage();
    if (saved?.shield !== undefined) state.shield = saved.shield;
    updateHud(true);
    cancelAnimationFrame(animationId);
    if (state.offers.length) showReward();
    else animationId = requestAnimationFrame(gameLoop);
    saveRun();
}

function jump() {
    if (state.running && !state.paused && !state.rewardPending && !state.transitioning &&
        (state.onGround || (upgradeLevel('doubleJump') && state.jumpsUsed < 2))) {
        state.jumpsUsed = state.onGround ? 1 : Math.max(1, state.jumpsUsed) + 1;
        state.velocityY = 720;
        state.onGround = false;
    }
}

function spawnPipe(position, height, exit = false) {
    const element = document.createElement('img');
    const castle = exit && state.stage === 3;
    element.src = castle ? '../images/castle-sprite.png' : '../images/pipe.png';
    element.alt = castle ? 'Entrada do castelo' : exit ? 'Cano para próxima fase' : 'Cano';
    element.className = castle ? 'enemy exit-castle locked' : `enemy pipe scenery-pipe${exit ? ' exit-pipe locked' : ''}`;
    if (castle) height = 145;
    const width = Math.round(height * (castle ? 1 : .78));
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    board.append(element);
    const pipe = { type: exit ? 'exit' : 'enemy', enemyType: 'pipe', element, x: state.worldWidth * position, y: 0, width, height, speed: 0, anchor: position };
    entities.push(pipe);
    if (exit) state.exitPipe = pipe;
}

function setupStage() {
    state.boss = null;
    state.shield = upgradeLevel('shield');
    arenaLabel.textContent = '';
    if (state.stage === 4) {
        // Fixed, open arena: no random pipes obstructing a dodge or a landing.
        state.worldWidth = Math.max(state.boardWidth * worldScale, 1120);
        spawnPlatform(.22, 82, 120);
        spawnPlatform(.44, 124, 130);
        spawnPlatform(.67, 82, 120);
        spawnPipe(.91, 80, true);
        spawnBoss();
    } else {
        spawnPipe(random(.3, .43), random(55, 100));
        spawnPipe(random(.55, .7), random(60, 110));
        spawnPipe(random(.86, .94), random(70, 105), true);
    }
}

function spawnPlatform(anchor, y, width) {
    const element = document.createElement('div');
    element.className = 'platform';
    element.style.width = `${width}px`;
    board.append(element);
    entities.push({ type: 'platform', element, x: state.worldWidth * anchor, y, width, height: 18, speed: 0, anchor });
}

function spawnBoss() {
    const element = document.createElement('div');
    element.className = 'enemy boss';
    element.style.setProperty('--boss-scale', bossScale);
    element.style.setProperty('--boss-tempo', bossTempo);
    const health = document.createElement('meter');
    health.className = 'boss-health';
    health.min = 0;
    health.max = 20;
    health.value = 20;
    health.setAttribute('aria-label', 'Vida de Conde Cannoli — forma 1');
    element.append(health);
    element.dataset.hp = 'I · 20/20';
    element.dataset.form = '1';
    board.append(element);
    state.boss = { type: 'enemy', enemyType: 'boss', boss: true, element, health, x: Math.min(state.worldWidth * .72, state.worldWidth * .86 - 96 * bossScale), y: 0, width: 96 * bossScale, height: 96 * bossScale, scale: bossScale, tempo: bossTempo, speed: 0, velocityY: 0, phase: 'waiting', phaseTime: 0, facing: -1, form: 1, attacks: 0, hp: 20, hitTime: 0 };
    element.dataset.phase = 'waiting';
    arenaLabel.textContent = 'CONDE CANNOLI';
    entities.push(state.boss);
}

function setBossPhase(boss, phase, time) {
    boss.phase = phase;
    // Preserve the preparation timing independently of the faster attack motion.
    boss.phaseTime = time * (boss.form === 2 && phase.startsWith('prepare-') ? 2 : 1);
    boss.element.dataset.phase = phase;
    if (phase === 'prepare-jump') {
        const reach = 250 * (2 * (boss.form === 2 ? 620 : 570) / 1500);
        boss.landX = Math.max(20, Math.min(state.worldWidth * .86 - boss.width,
            Math.max(boss.x - reach, Math.min(boss.x + reach, state.playerX))));
    }
}

function clearBossShots() {
    entities.filter(entity => entity.type === 'boss-shot').forEach(removeEntity);
}

function castBossPower(boss) {
    const x = boss.x + boss.width / 2 + boss.facing * (boss.form === 1 ? 28 : 42) * boss.scale;
    const y = boss.y + 28 * boss.scale;
    const angle = Math.atan2(state.playerY + 28 - y, state.playerX + state.playerWidth / 2 - x);
    // Aimed once, never homing. At most six simple projectiles in the arena.
    for (const spread of boss.form === 2 ? [-.18, .18] : [0]) {
        if (entities.filter(entity => entity.type === 'boss-shot').length >= 6) break;
        const element = document.createElement('div');
        element.className = 'boss-shot';
        board.append(element);
        const speed = (boss.form === 2 ? 245 : 205) * boss.tempo;
        entities.push({ type: 'boss-shot', element, x: x - 11, y: y - 11, width: 22, height: 22,
            speed: Math.cos(angle + spread) * speed, velocityY: Math.sin(angle + spread) * speed, life: 4 });
    }
}

function fire() {
    if (!state.running || state.paused || state.rewardPending || state.transitioning || state.fireCooldown > 0) return;
    const element = document.createElement('div');
    element.className = `fireball${state.facing < 0 ? ' left' : ''}`;
    board.append(element);
    entities.push({ type: 'fireball', element, x: state.playerX + (state.facing > 0 ? state.playerWidth - 17 : 0), y: state.playerY + 35, width: 20, height: 20, speed: 620 * state.facing, damage: 1 + upgradeLevel('flame') });
    state.fireCooldown = 2 - .25 * upgradeLevel('reload');
    state.shooting = .22;
}

function spawnEnemy() {
    const stage = stages[state.stage];
    const type = stage.types[Math.floor(Math.random() * stage.types.length)];
    const element = document.createElement('div');
    element.className = 'enemy bully';
    board.append(element);
    const [width, height] = sizes[type];
    entities.push({ type: 'enemy', enemyType: type, element, x: state.cameraX + state.boardWidth + 30, y: 0, width, height, speed: -stage.speed });
}

function movePlayer(dt) {
    const direction = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (direction) {
        state.facing = direction;
    }
    state.playerX = Math.max(0, Math.min(state.worldWidth - state.playerWidth, state.playerX + direction * 300 * (1 + .12 * upgradeLevel('boots')) * dt));
    const previousY = state.playerY;
    state.velocityY -= 1800 * dt;
    state.playerY = Math.max(0, state.playerY + state.velocityY * dt);
    state.onGround = state.playerY === 0;
    if (state.onGround) state.velocityY = 0;
    if (state.velocityY <= 0) {
        for (const platform of entities) {
            if (platform.type !== 'platform') continue;
            const top = platform.y + platform.height;
            if (previousY >= top && state.playerY <= top && state.playerX + state.playerWidth > platform.x && state.playerX < platform.x + platform.width) {
                state.playerY = top;
                state.velocityY = 0;
                state.onGround = true;
                break;
            }
        }
    }
    if (state.onGround) state.jumpsUsed = 0;
    const action = state.shooting > 0 ? 'shooting' : !state.onGround ? 'jumping' : direction ? 'walking' : 'idle';
    if (action !== state.action) {
        player.classList.remove('walking', 'jumping', 'shooting');
        player.classList.add(action);
        state.action = action;
    }
    const cameraTarget = Math.max(0, Math.min(state.worldWidth - state.boardWidth, state.playerX - state.boardWidth * .38));
    state.cameraX += (cameraTarget - state.cameraX) * Math.min(1, dt * 7);
    const spriteFacing = state.facing * (state.character === 'mario' && action === 'jumping' ? -1 : 1);
    player.style.transform = `translate3d(${state.playerX - state.cameraX}px, ${-state.playerY}px, 0) scaleX(${spriteFacing})`;
    hills.style.transform = `translate3d(${-state.cameraX * .18}px, 0, 0)`;
}

function moveEntities(dt) {
    for (let index = entities.length - 1; index >= 0; index--) {
        const entity = entities[index];
        if (entity.boss) moveBoss(entity, dt);
        else entity.x += entity.speed * dt;
        if (entity.type === 'boss-shot') {
            entity.y += entity.velocityY * dt;
            entity.life -= dt;
            if (entity.life <= 0 || entity.y < -22 || entity.y > 600) {
                removeEntity(entity);
                continue;
            }
        }
        if (entity.type === 'fireball') entity.y = Math.max(9, entity.y - 105 * dt);
        entity.element.style.transform = `translate3d(${entity.x - state.cameraX}px, ${-entity.y}px, 0)`;
        if (!entity.boss && ((entity.speed < 0 && entity.x < state.cameraX - 100) || (entity.speed > 0 && entity.x > state.cameraX + state.boardWidth + 100))) removeEntity(entity);
    }
}

function moveBoss(boss, dt) {
    if (boss.type === 'dying') {
        boss.phaseTime -= dt;
        if (boss.phaseTime <= 0) {
            removeEntity(boss);
            state.boss = null;
            arenaLabel.textContent = 'CONDE DERROTADO';
        }
        return;
    }
    if (boss.phase === 'waiting') {
        if (Math.abs(state.playerX - boss.x) < state.boardWidth * .72) setBossPhase(boss, 'walk', 1);
        return;
    }
    boss.hitTime = Math.max(0, boss.hitTime - dt);
    boss.element.classList.toggle('hit', boss.hitTime > 0);
    // Speed up the whole attack motion, preserving jump height and landing position.
    if (boss.phase !== 'transform') dt *= boss.tempo;
    boss.phaseTime -= dt;
    if (boss.phase === 'transform') {
        if (boss.phaseTime <= 0) {
            boss.form = 2;
            boss.scale = hatScale;
            boss.tempo = bossTempo * 2;
            boss.hp = 20;
            boss.health.value = 20;
            boss.x += (boss.width - 96 * hatScale) / 2;
            boss.width = 96 * hatScale;
            boss.height = 48 * hatScale;
            boss.element.style.setProperty('--boss-scale', boss.scale);
            boss.element.style.setProperty('--boss-tempo', boss.tempo);
            boss.element.dataset.form = '2';
            boss.element.dataset.hp = 'II · 20/20';
            boss.health.setAttribute('aria-label', 'Vida de Conde Cannoli — forma 2');
            boss.attacks = 0;
            setBossPhase(boss, 'recover', 1.2);
        }
        return;
    }
    if (boss.phase === 'walk') {
        boss.facing = Math.sign(state.playerX - boss.x) || boss.facing;
        boss.x += boss.facing * (boss.form === 2 ? 145 : 90) * dt;
        if (boss.phaseTime <= 0) {
            setBossPhase(boss, boss.attacks++ % 2 === 0 ? 'prepare-jump' : 'prepare-shot', boss.form === 2 ? .55 : .75);
        }
    } else if (boss.phase === 'prepare-jump' && boss.phaseTime <= 0) {
        setBossPhase(boss, 'jump', 1);
        boss.velocityY = boss.form === 2 ? 620 : 570;
        // Commit to a landing, rather than tracking the player in mid-air.
        boss.speed = (boss.landX - boss.x) / (2 * boss.velocityY / 1500);
    } else if (boss.phase === 'prepare-shot' && boss.phaseTime <= 0) {
        castBossPower(boss);
        setBossPhase(boss, 'cast', .3);
    } else if (boss.phase === 'cast' && boss.phaseTime <= 0) {
        setBossPhase(boss, 'recover', boss.form === 2 ? 1 : 1.4);
    } else if (boss.phase === 'jump') {
        boss.x += boss.speed * dt;
        boss.y = Math.max(0, boss.y + boss.velocityY * dt - 750 * dt * dt);
        boss.velocityY -= 1500 * dt;
        if (boss.y === 0) {
            boss.x = boss.landX;
            setBossPhase(boss, 'recover', boss.form === 2 ? 1.1 : 1.5);
            boss.speed = 0;
            boss.velocityY = 0;
        }
    } else if (boss.phase === 'recover' && boss.phaseTime <= 0) {
        setBossPhase(boss, 'walk', boss.form === 2 ? .65 : 1);
    }
    boss.x = Math.max(20, Math.min(state.worldWidth * .86 - boss.width, boss.x));
    boss.element.style.setProperty('--boss-facing', boss.facing);
}

function hitBoss(boss, damage = 1) {
    if (boss.type !== 'enemy' || boss.phase === 'transform') return;
    if (boss.phase === 'waiting') setBossPhase(boss, 'walk', 1);
    boss.hp = Math.max(0, boss.hp - damage);
    boss.health.value = boss.hp;
    boss.element.dataset.hp = `${boss.form === 1 ? 'I' : 'II'} · ${boss.hp}/20`;
    boss.hitTime = .18;
    if (boss.hp > 0) return;
    clearBossShots();
    boss.speed = 0;
    boss.velocityY = 0;
    boss.y = 0;
    if (boss.form === 1) {
        setBossPhase(boss, 'transform', 1.4);
        return;
    }
    boss.type = 'dying';
    boss.phaseTime = .7;
    boss.element.classList.add('dying');
    state.score += 1000;
}

function bossHitbox(boss) {
    // Ignore empty space beside the coat; the hat really is wider and shorter.
    return { x: boss.x + (boss.form === 1 ? 20 : 6) * boss.scale, y: boss.y,
        width: (boss.form === 1 ? 56 : 84) * boss.scale, height: boss.height - 4 * boss.scale };
}

function overlaps(a, b) {
    return a.x + 8 < b.x + b.width && a.x + a.width - 8 > b.x && a.y + 5 < b.y + b.height && a.y + a.height > b.y + 5;
}

console.assert(overlaps({ x: 0, y: 0, width: 30, height: 30 }, { x: 20, y: 0, width: 30, height: 30 }) && !overlaps({ x: 0, y: 0, width: 30, height: 30 }, { x: 40, y: 0, width: 30, height: 30 }), 'Detecção de colisão inválida');

function checkCollisions() {
    if (state.transitioning) return;
    for (let shotIndex = entities.length - 1; shotIndex >= 0; shotIndex--) {
        const fireball = entities[shotIndex];
        if (!fireball || fireball.type !== 'fireball') continue;
        for (let enemyIndex = entities.length - 1; enemyIndex >= 0; enemyIndex--) {
            const enemy = entities[enemyIndex];
            if (enemy.type !== 'enemy' || enemy.enemyType === 'pipe' || !overlaps(fireball, enemy.boss ? bossHitbox(enemy) : enemy)) continue;
            removeEntity(fireball);
            if (enemy.boss) {
                hitBoss(enemy, fireball.damage ?? 1);
                break;
            }
            enemy.type = 'dying';
            enemy.speed = 0;
            enemy.element.classList.add('dying');
            state.score += enemy.enemyType === 'koopa' ? 200 : 100;
            setTimeout(() => removeEntity(enemy), 550);
            break;
        }
    }

    if (state.invulnerable > 0) return;
    const playerBox = { x: state.playerX, y: state.playerY, width: state.playerWidth, height: state.playerHeight };
    const enemy = entities.find(item => (item.type === 'enemy' || item.type === 'boss-shot') &&
        (!item.boss || !['transform', 'waiting'].includes(item.phase)) && overlaps(playerBox, item.boss ? bossHitbox(item) : item));
    if (!enemy) return;
    if (enemy.enemyType === 'pipe') {
        state.playerX = state.playerX + state.playerWidth / 2 < enemy.x + enemy.width / 2 ? enemy.x - state.playerWidth : enemy.x + enemy.width;
        return;
    }
    if (!enemy.boss) removeEntity(enemy);
    if (state.shield > 0) state.shield--;
    else state.lives--;
    state.invulnerable = 1.4;
    player.classList.add('hit');
    if (state.lives === 0) finish(false);
    else saveRun();
}

function removeEntity(entity) {
    entity.element.remove();
    const index = entities.indexOf(entity);
    if (index >= 0) entities.splice(index, 1);
}

function nextStage() {
    state.stage++;
    state.stageTime = 0;
    state.spawnTime = .8;
    entities.slice().forEach(removeEntity);
    if (state.stage === stages.length) finish(true);
    else {
        board.className = `game-board theme-${state.stage + 1}`;
        state.worldWidth = state.boardWidth * worldScale;
        state.cameraX = 0;
        state.playerX = state.boardWidth * .07;
        state.playerY = 0;
        state.velocityY = 0;
        state.onGround = true;
        state.transitioning = false;
        state.exitUnlocked = false;
        state.fireCooldown = 0;
        state.shooting = 0;
        state.invulnerable = 0;
        state.lives = Math.min(maxLives(), state.lives + 1);
        player.classList.remove('entering-pipe', 'entering-castle', 'walking', 'jumping', 'shooting', 'hit');
        state.action = 'idle';
        setupStage();
        showReward();
    }
}

function showReward() {
    if (!state.offers.length) {
        const available = Object.keys(upgrades).filter(id => upgradeLevel(id) < upgrades[id].max);
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }
        state.offers = available.slice(0, 3);
    }
    state.rewardPending = true;
    keys.clear();
    cancelAnimationFrame(animationId);
    board.classList.add('is-paused');
    rewardOptions.replaceChildren();
    state.offers.forEach((id, index) => {
        const button = document.createElement('button');
        button.className = 'upgrade-choice';
        button.textContent = `${index + 1}. ${upgrades[id].name} · nível ${upgradeLevel(id) + 1} — ${upgrades[id].text}`;
        button.addEventListener('click', () => chooseUpgrade(id));
        rewardOptions.append(button);
    });
    rewardMenu.classList.remove('hidden');
    rewardOptions.firstElementChild?.focus();
    updateHud(true);
    saveRun();
}

function chooseUpgrade(id) {
    if (!state.running || !state.rewardPending || !state.offers.includes(id)) return;
    state.upgrades[id] = upgradeLevel(id) + 1;
    if (id === 'heart') state.lives = Math.min(maxLives(), state.lives + 1);
    if (id === 'shield') state.shield = 1;
    state.offers = [];
    state.rewardPending = false;
    rewardMenu.classList.add('hidden');
    board.classList.remove('is-paused');
    keys.clear();
    updateHud(true);
    saveRun();
    state.lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

function enterPipe() {
    if (!state.running || state.paused || state.rewardPending || state.transitioning || state.boss || state.playerY > 0) return;
    const exit = state.exitPipe;
    if (!exit || state.playerX + state.playerWidth < exit.x - 12 || state.playerX > exit.x + exit.width + 12) return;
    state.transitioning = true;
    keys.clear();
    player.classList.remove('walking', 'jumping', 'shooting');
    player.classList.add(state.stage === 3 ? 'entering-castle' : 'entering-pipe');
    state.transitionTime = .52;
}

function finish(won) {
    state.running = false;
    keys.clear();
    cancelAnimationFrame(animationId);
    try {
        localStorage.removeItem(saveKey);
        localStorage.removeItem(runSaveKey);
    } catch { /* Sem armazenamento. */ }
    document.querySelector('#message-title').textContent = won ? 'Você venceu!' : 'Game over';
    document.querySelector('#message-text').textContent = won ? `As 5 fases completas — ${state.score} pontos.` : `Fim da corrida na fase ${state.stage + 1}. Próxima tentativa: fase 1, sem melhorias.`;
    if (!won) player.classList.add('game-over');
    message.classList.remove('hidden');
}

function togglePause() {
    if (!state.running || state.transitioning || state.rewardPending) return;
    state.paused = !state.paused;
    keys.clear();
    board.classList.toggle('is-paused', state.paused);
    pauseMenu.classList.toggle('hidden', !state.paused);
    if (state.paused) cancelAnimationFrame(animationId);
    else {
        state.lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }
}

function exitGame() {
    saveRun();
    keys.clear();
    state.running = false;
    state.paused = false;
    cancelAnimationFrame(animationId);
    pauseMenu.classList.add('hidden');
    message.classList.add('hidden');
    rewardMenu.classList.add('hidden');
    menu.classList.remove('hidden');
    refreshContinue();
}

function updateHud(force = false) {
    const values = [state.score, `${state.lives}/${maxLives()}`, Math.min(state.stage + 1, 5), Math.floor(state.stageTime), state.shield];
    const snapshot = values.join('|');
    if (force || snapshot !== state.hud) {
        state.hud = snapshot;
        scoreLabel.textContent = values[0];
        livesLabel.textContent = values[1];
        stageLabel.textContent = values[2];
        timeLabel.textContent = values[3];
        const build = Object.entries(state.upgrades || {}).map(([id, rank]) => `${upgrades[id].name} ${rank}`).join(' · ');
        runLabel.textContent = `${build || 'Sem melhorias — escolha uma ao completar cada fase.'}${state.shield ? ' · Escudo pronto' : ''}`;
    }

    const cooldown = Math.max(0, Math.ceil(state.fireCooldown));
    if (!force && cooldown === state.powerHud) return;
    state.powerHud = cooldown;
    reloadIcon.classList.toggle('reloading', cooldown > 0);
    powerLabel.textContent = cooldown ? `${cooldown}s` : 'Pronto';
}

function gameLoop(now) {
    if (!state.running || state.paused || state.rewardPending) return;
    const dt = Math.min((now - state.lastTime) / 1000, .033);
    state.lastTime = now;
    if (state.transitioning) {
        state.transitionTime -= dt;
        if (state.transitionTime <= 0) nextStage();
        if (state.running && !state.rewardPending) animationId = requestAnimationFrame(gameLoop);
        return;
    }
    state.stageTime += dt;
    state.spawnTime -= dt;
    state.fireCooldown -= dt;
    state.shooting -= dt;
    state.invulnerable -= dt;
    if (state.invulnerable <= .5) player.classList.remove('hit');

    if (!state.exitUnlocked && !state.boss) {
        state.exitUnlocked = true;
        state.exitPipe.element.classList.remove('locked');
    }

    if (state.stage < 4 && state.spawnTime <= 0) {
        spawnEnemy();
        state.spawnTime = stages[state.stage].spawn * (.82 + Math.random() * .36);
    }

    movePlayer(dt);
    moveEntities(dt);
    checkCollisions();
    updateHud();
    if (state.running && !state.rewardPending) animationId = requestAnimationFrame(gameLoop);
}

document.querySelectorAll('.character').forEach(button => button.addEventListener('click', () => {
    document.querySelector('.character.selected').classList.remove('selected');
    button.classList.add('selected');
}));

document.querySelector('#start').addEventListener('click', () => resetState());
document.querySelector('#restart').addEventListener('click', () => resetState());
savedButton.addEventListener('click', () => {
    const run = loadRun();
    if (run) resetState(run.stage, run);
});
document.querySelector('#reward-exit').addEventListener('click', exitGame);
document.querySelector('#resume').addEventListener('click', togglePause);
document.querySelector('#exit').addEventListener('click', exitGame);
document.querySelector('#jump').addEventListener('pointerdown', jump);
document.querySelector('#fire').addEventListener('pointerdown', fire);
new ResizeObserver(() => {
    if (!state.running) return;
    state.boardWidth = board.clientWidth;
    state.worldWidth = state.stage === 4 ? Math.max(state.boardWidth * worldScale, 1120) : state.boardWidth * worldScale;
    state.playerWidth = player.offsetWidth;
    state.playerHeight = player.offsetHeight;
    state.playerX = Math.min(state.playerX, state.worldWidth - state.playerWidth);
    state.cameraX = Math.min(state.cameraX, state.worldWidth - state.boardWidth);
    entities.filter(({ anchor }) => anchor).forEach(entity => entity.x = state.worldWidth * entity.anchor);
}).observe(board);
document.addEventListener('keydown', event => {
    if (state.rewardPending) {
        if (/^Digit[123]$/.test(event.code)) {
            event.preventDefault();
            chooseUpgrade(state.offers[Number(event.code.slice(-1)) - 1]);
        }
        return;
    }
    if (event.code === 'Escape') {
        event.preventDefault();
        togglePause();
        return;
    }
    if (['ArrowUp', 'Space', 'KeyW'].includes(event.code)) {
        event.preventDefault();
        jump();
    }
    if (['KeyA', 'KeyD'].includes(event.code)) keys.add(event.code);
    if (event.code === 'KeyS') enterPipe();
    if (event.code === 'KeyP') fire();
});
document.addEventListener('keyup', event => keys.delete(event.code));

refreshContinue();
