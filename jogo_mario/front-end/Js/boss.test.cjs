// Run: node jogo_mario/Js/boss.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const element = () => ({
    dataset: { character: 'mario' }, style: { setProperty(name, value) { this[name] = value; } },
    clientWidth: 960, offsetWidth: 72, offsetHeight: 84,
    classList: { add() {}, remove() {}, toggle() {} },
    append() {}, replaceChildren() {}, focus() {}, remove() {}, setAttribute() {}, addEventListener() {},
});
const storage = new Map();
const context = vm.createContext({
    assert, console,
    performance: { now: () => 0 },
    setTimeout() {}, requestAnimationFrame() {}, cancelAnimationFrame() {},
    document: { querySelector: element, querySelectorAll: () => [], createElement: element, addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    ResizeObserver: class { observe() {} },
});
vm.runInContext(fs.readFileSync(__dirname + '/script.js', 'utf8'), context);
vm.runInContext(`
    state = { worldWidth: 1200, boardWidth: 960, cameraX: 0, playerX: 300,
        playerY: 0, playerWidth: 72, playerHeight: 84, score: 0, lives: 3, invulnerable: 0 };
    spawnBoss();
    const boss = state.boss;
    assert.equal(boss.hp, 20);
    assert.ok(Math.abs(boss.height - 288 * .65) < .0001);
    assert.ok(Math.abs(boss.width - 288 * .65) < .0001);
    assert.ok(Math.abs(bossHitbox(boss).width - 168 * .65) < .0001);
    assert.ok(Math.abs(bossHitbox(boss).x - boss.x - 60 * .65) < .0001);
    assert.ok(Math.abs(bossHitbox(boss).height - 276 * .65) < .0001);
    assert.equal(boss.element.style['--boss-scale'], boss.scale);
    assert.ok(entities.every(e => e.type !== 'decoration'));
    const phases = new Set();
    for (let i = 0; i < 900; i++) {
        moveEntities(1 / 60);
        phases.add(boss.phase);
        assert.ok(boss.x >= 0 && boss.x <= state.worldWidth - boss.width && boss.y >= 0);
        assert.ok(entities.filter(e => e.type === 'boss-shot').length <= 6);
        assert.ok(entities.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)));
    }
    for (const phase of ['walk', 'prepare-jump', 'jump', 'prepare-shot', 'cast', 'recover']) assert.ok(phases.has(phase), phase);
    setBossPhase(boss, 'prepare-jump', .75);
    const landingX = boss.landX;
    assert.equal(arenaLabel.textContent, 'CONDE CANNOLI');
    state.playerX += 100;
    moveEntities(.8);
    assert.equal(boss.landX, landingX, 'landing is committed during preparation, not homing');
    setBossPhase(boss, 'recover', 1);
    assert.equal(arenaLabel.textContent, 'CONDE CANNOLI', 'no attack or recovery hint');

    // Real fireball collision: 1 damage, projectile consumed, never a repeated hit.
    boss.x = 600;
    boss.y = 0;
    entities.push({ type: 'fireball', element: document.createElement('div'), x: bossHitbox(boss).x + 5, y: 20, width: 20, height: 20 });
    checkCollisions();
    assert.equal(boss.hp, 19);
    checkCollisions();
    assert.equal(boss.hp, 19);
    for (let i = 0; i < 18; i++) hitBoss(boss);
    assert.equal(boss.hp, 1);
    assert.equal(boss.health.value, 1);
    hitBoss(boss);
    assert.equal(boss.hp, 0);
    assert.equal(boss.phase, 'transform');
    assert.equal(state.boss, boss, 'exit must remain locked between forms');
    assert.equal(entities.filter(e => e.type === 'boss-shot').length, 0);
    hitBoss(boss);
    assert.equal(boss.hp, 0, 'transformation is invulnerable');
    state.playerX = boss.x;
    checkCollisions();
    assert.equal(state.lives, 3, 'no contact damage during transformation');
    moveBoss(boss, 1.5);
    assert.equal(boss.form, 2);
    assert.equal(boss.width, 288 * .5);
    assert.equal(boss.height, 144 * .5);
    assert.equal(bossHitbox(boss).width, 252 * .5);
    assert.equal(bossHitbox(boss).height, 132 * .5);
    assert.equal(boss.element.style['--boss-scale'], 1.5);
    assert.equal(boss.element.style['--boss-tempo'], 3);
    assert.equal(boss.hp, 20);
    assert.equal(boss.health.value, 20);
    assert.equal(boss.element.dataset.hp, 'II · 20/20');
    boss.x = 500;
    state.playerX = 0;
    setBossPhase(boss, 'walk', 10);
    moveBoss(boss, .1);
    assert.ok(Math.abs(boss.x - (500 - 43.5)) < .0001, 'hat moves 2x its previous speed');
    setBossPhase(boss, 'prepare-jump', .55);
    moveBoss(boss, .35);
    assert.equal(boss.phase, 'prepare-jump', 'preparation timing is unchanged');
    moveBoss(boss, .02);
    assert.equal(boss.phase, 'jump');

    // Both hat attacks repeat; projectiles are capped, aimed once and expire.
    phases.clear();
    state.playerX = 100;
    for (let i = 0; i < 600; i++) {
        moveEntities(1 / 60);
        phases.add(boss.phase);
    }
    for (const phase of ['prepare-jump', 'jump', 'prepare-shot', 'cast', 'recover']) assert.ok(phases.has(phase), phase);
    clearBossShots();
    castBossPower(boss);
    assert.equal(entities.filter(e => e.type === 'boss-shot').length, 2);
    const shot = entities.find(e => e.type === 'boss-shot');
    assert.ok(Math.abs(Math.hypot(shot.speed, shot.velocityY) - 735) < .0001);
    assert.equal(shot.y, boss.y + 42 - 11, 'shot origin follows the smaller hat');
    const shotSpeed = shot.speed;
    state.playerX = 0;
    moveEntities(.01);
    assert.equal(shot.speed, shotSpeed);
    for (let i = 0; i < 10; i++) castBossPower(boss);
    assert.equal(entities.filter(e => e.type === 'boss-shot').length, 6);
    setBossPhase(boss, 'recover', 20);
    for (let i = 0; i < 300; i++) moveEntities(1 / 60);
    assert.equal(entities.filter(e => e.type === 'boss-shot').length, 0);

    castBossPower(boss);
    const contactShot = entities.find(e => e.type === 'boss-shot');
    contactShot.x = state.playerX + 20;
    contactShot.y = 25;
    checkCollisions();
    assert.equal(state.lives, 2);
    assert.ok(!entities.includes(contactShot));
    checkCollisions();
    assert.equal(state.lives, 2, 'damage grants invulnerability');

    for (let i = 0; i < 19; i++) hitBoss(boss);
    assert.equal(boss.hp, 1);
    assert.equal(boss.health.value, 1);
    assert.equal(state.boss, boss);
    hitBoss(boss);
    assert.equal(boss.hp, 0);
    assert.equal(boss.health.value, 0);
    assert.equal(state.boss, boss, 'exit remains locked until death completes');
    assert.equal(boss.type, 'dying');
    hitBoss(boss);
    assert.equal(state.score, 1000);
    const deathX = boss.x;
    moveEntities(.8);
    assert.equal(state.boss, null);
    assert.equal(boss.x, deathX);
    assert.ok(!entities.includes(boss));
    assert.equal(entities.filter(e => e.type === 'boss-shot').length, 0);

    // Final arena preserves run health and provides reachable ledges.
    entities = [];
    state.stage = 4;
    state.boardWidth = 350;
    setupStage();
    assert.equal(state.worldWidth, 1120);
    assert.equal(state.lives, 2);
    assert.equal(entities.filter(e => e.type === 'platform').length, 3);
    assert.equal(entities.filter(e => e.enemyType === 'pipe' && e.type !== 'exit').length, 0);
    assert.ok(entities.filter(e => e.type === 'platform').every(e => e.y + e.height < 144));

    // Roguelike: one of three unique rewards per cleared stage, frozen until chosen.
    resetState();
    assert.equal(state.stage, 0);
    assert.equal(state.lives, 3);
    assert.equal(Object.keys(state.upgrades).length, 0);
    assert.ok(loadRun());
    state.lives = 2;
    state.playerX = state.exitPipe.x;
    enterPipe();
    assert.equal(state.transitioning, true);
    for (let now = 33; now <= 660; now += 33) gameLoop(now);
    assert.equal(state.stage, 1);
    assert.equal(state.lives, 3);
    assert.equal(state.rewardPending, true);
    assert.equal(state.offers.length, 3);
    assert.equal(new Set(state.offers).size, 3);
    const stoppedTime = state.stageTime;
    const stoppedEntities = entities.length;
    fire();
    jump();
    enterPipe();
    gameLoop(1000);
    assert.equal(state.stageTime, stoppedTime);
    assert.equal(state.velocityY, 0);
    assert.equal(entities.length, stoppedEntities);
    chooseUpgrade('not-an-upgrade');
    assert.equal(state.rewardPending, true);
    const pendingOffers = state.offers.join(',');
    exitGame();
    const pendingRun = loadRun();
    assert.equal(pendingRun.offers.join(','), pendingOffers);
    resetState(pendingRun.stage, pendingRun);
    assert.equal(state.rewardPending, true);
    assert.equal(state.offers.join(','), pendingOffers, 'resume cannot reroll the reward');
    const chosen = state.offers[0];
    chooseUpgrade(chosen);
    assert.equal(state.upgrades[chosen], 1);
    assert.equal(state.rewardPending, false);
    chooseUpgrade(chosen);
    assert.equal(state.upgrades[chosen], 1, 'double click cannot grant a second reward');
    const savedRun = loadRun();
    resetState(savedRun.stage, savedRun);
    assert.equal(state.upgrades[chosen], 1);
    assert.equal(state.stage, 1);

    // Actual perk effects (including bounded stacks).
    state.upgrades = { flame: 2, reload: 3, boots: 2, doubleJump: 1, heart: 2, shield: 1 };
    assert.equal(maxLives(), 5);
    state.fireCooldown = 0;
    fire();
    const enhancedShot = entities.find(e => e.type === 'fireball');
    assert.equal(enhancedShot.damage, 3);
    assert.equal(state.fireCooldown, 1.25);
    state.onGround = true;
    jump();
    assert.equal(state.jumpsUsed, 1);
    state.velocityY = 100;
    jump();
    assert.equal(state.jumpsUsed, 2);
    assert.equal(state.velocityY, 720);
    state.velocityY = 100;
    jump();
    assert.equal(state.velocityY, 100, 'no third jump');
    state.playerX = 0;
    keys.add('KeyD');
    movePlayer(.1);
    keys.clear();
    assert.ok(Math.abs(state.playerX - 37.2) < .0001);
    entities = [];
    state.stage = 4;
    setupStage();
    const enhancedBoss = state.boss;
    hitBoss(enhancedBoss, enhancedShot.damage);
    assert.equal(enhancedBoss.hp, 17);
    setBossPhase(enhancedBoss, 'walk', 10);
    const bossStartX = enhancedBoss.x;
    state.playerX = 0;
    moveBoss(enhancedBoss, .1);
    assert.ok(Math.abs(bossStartX - enhancedBoss.x - 13.5) < .0001, '1.5x walking speed');
    castBossPower(enhancedBoss);
    const fasterShot = entities.find(e => e.type === 'boss-shot');
    assert.ok(Math.abs(Math.hypot(fasterShot.speed, fasterShot.velocityY) - 307.5) < .0001);
    state.playerY = 0;
    state.invulnerable = 0;
    const healthBeforeShield = state.lives;
    fasterShot.x = state.playerX + 20;
    fasterShot.y = 25;
    checkCollisions();
    assert.equal(state.lives, healthBeforeShield);
    assert.equal(state.shield, 0);

    // Valid saved build, spent shield and health survive leaving and reloading.
    state.upgrades = { flame: 1, heart: 1, shield: 1, doubleJump: 1 };
    state.lives = 2;
    state.character = 'luigi';
    saveRun();
    const checkpoint = loadRun();
    assert.ok(checkpoint);
    resetState(checkpoint.stage, checkpoint);
    assert.equal(state.lives, 2);
    assert.equal(state.character, 'luigi');
    assert.equal(state.shield, 0, 'resume does not refill a spent shield');
    assert.equal(state.upgrades.flame, 1);

    // Invalid/old storage and blocked storage never prevent a fresh game.
    localStorage.setItem(runSaveKey, '{broken');
    assert.equal(loadRun(), null);
    localStorage.setItem(runSaveKey, JSON.stringify({ ...checkpoint, upgrades: { flame: 99 } }));
    assert.equal(loadRun(), null);
    localStorage.removeItem(runSaveKey);
    localStorage.setItem(saveKey, '2');
    const legacy = loadRun();
    assert.equal(legacy.stage, 2);
    resetState(legacy.stage, legacy);
    assert.equal(localStorage.getItem(saveKey), null);
    assert.ok(loadRun());
    const storageWrite = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('storage blocked'); };
    assert.doesNotThrow(saveRun);
    localStorage.setItem = storageWrite;

    // Death clears both formats; new attempt starts at stage 1 with no upgrades.
    state.lives = 0;
    finish(false);
    assert.equal(loadRun(), null);
    assert.equal(state.running, false);
    exitGame();
    assert.equal(loadRun(), null, 'leaving after death cannot restore the run');
    resetState();
    assert.equal(state.stage, 0);
    assert.equal(state.lives, 3);
    assert.equal(Object.keys(state.upgrades).length, 0);
    for (let stage = 1; stage < 5; stage++) {
        nextStage();
        assert.equal(state.stage, stage);
        assert.equal(state.offers.length, 3);
        chooseUpgrade(state.offers[0]);
        assert.equal(Object.values(state.upgrades).reduce((a, b) => a + b, 0), stage);
    }
    nextStage();
    assert.equal(state.running, false);
    assert.equal(loadRun(), null, 'winning also ends the run');
`, context);
console.log('Cannoli + roguelike: combat, scaling, rewards, perks, saves/resume, death and victory OK');
