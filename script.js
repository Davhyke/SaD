const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    // Отключаем свайп закрытия WebApp чтобы не конфликтовал со скроллом
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
}

// Фикс скролла в Telegram WebApp
function enableTouchScroll(el) {
    if (!el) return;
    let startY = 0;

    el.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        const delta = startY - e.touches[0].clientY;
        const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight;
        const canScrollUp   = el.scrollTop > 0;

        if ((delta > 0 && canScrollDown) || (delta < 0 && canScrollUp)) {
            // Есть куда скроллить — разрешаем и блокируем Telegram
            e.stopPropagation();
            if (!e.cancelable) return;
            e.preventDefault();
            el.scrollTop += delta * 0.5;
            startY = e.touches[0].clientY;
        }
    }, { passive: false });
}

const IMAGES_DIR = 'images/';
const API_URL = 'https://sad-server-production.up.railway.app';

// 1. СПИСОК МОБОВ (Статичное здоровье и награды)
const monsters = [
    { name: "Красный слайм",    hp: 20,  img: "red_slime.png",    reward: 15,  xp: 2,  chance: 25 },
    { name: "Зелёный слайм",    hp: 20,  img: "green_slime.png",  reward: 15,  xp: 2,  chance: 25 },
    { name: "Синий слайм",      hp: 20,  img: "blue_slime.png",   reward: 15,  xp: 2,  chance: 25 },
    { name: "Розовый слайм",    hp: 20,  img: "pink_slime.png",   reward: 15,  xp: 2,  chance: 25 },
    { name: "Фиолетовый слайм", hp: 20,  img: "purple_slime.png", reward: 15,  xp: 2,  chance: 25 },
    { name: "Белый слайм",      hp: 20,  img: "white_slime.png",  reward: 15,  xp: 2,  chance: 25 },
    { name: "Жёлтый слайм",     hp: 20,  img: "yellow_slime.png", reward: 15,  xp: 2,  chance: 25 },
    { name: "Ледышка",          hp: 30,  img: "ice.png",          reward: 25,  xp: 4,  chance: 20 },
    { name: "Скелет",           hp: 40,  img: "skeleton.png",     reward: 40,  xp: 6,  chance: 20 },
    { name: "Призрак",          hp: 80,  img: "ghost.png",        reward: 90,  xp: 12, chance: 20  },
    { name: "Паук",             hp: 60,  img: "spider.png",       reward: 50,  xp: 8,  chance: 20 },
    { name: "Зомби",            hp: 100, img: "zombie.png",       reward: 100, xp: 15, chance: 15  },
    { name: "Огненный дух",     hp: 25,  img: "fire_spirit.png",  reward: 20,  xp: 3,  chance: 25 },
    { name: "Слайм удачи",      hp: 1,   img: "lucky_slime.png",  reward: 500, xp: 50, chance: 4  },
    { name: "Слайм бездны",     hp: 175, img: "abyss_slime.png",  reward: 250, xp: 40, chance: 11  },
    { name: "Дракон",           hp: 200, img: "dragon.png",       reward: 275, xp: 67, chance: 9  },
];

const skinMap = {
    'default': 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
    'rose':    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'toxic':   'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'neon':    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    'ocean':   'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'gold':    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    'void':    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'blood':   'linear-gradient(135deg, #ff0844 0%, #2b0b01 100%)',
    'emerald': 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
    'purple':  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'rgb':     'rgb'
};


// =========================================
// СИСТЕМА УРОВНЕЙ
// =========================================
const MAX_LEVEL = 50;

// Опыт нужный для перехода НА следующий уровень
// Уровень 1->2: 10 XP, 2->3: 20 XP, ... растёт на 10 каждый уровень
function xpForLevel(level) {
    return level * 50;
}

// Награда монетами за достижение уровня (растёт: уровень * 50)
function rewardForLevel(level) {
    return level * 50;
}

// Состояние
// Индекс текущего моба теперь выбирается случайно при загрузке, если его нет в памяти
// Состояние игры
let state = {
    coins: parseInt(localStorage.getItem('coins')) || 0,
    totalKills: parseInt(localStorage.getItem('totalKills')) || 0,
    // Выбираем случайного моба при загрузке
    monsterIndex: randomMonsterIndex(), 
    owned: JSON.parse(localStorage.getItem('owned')) || ['default'],
    currentSkin: localStorage.getItem('currentSkin') || 'default',
    currentHp: 0,
    isRolling: false,
    rx: 0, ry: 0,
    level: parseInt(localStorage.getItem('level')) || 1,
    xp: parseInt(localStorage.getItem('xp')) || 0
};


// Выбор случайного моба с учётом весов (chance)
function randomMonsterIndex() {
    const total = monsters.reduce((sum, m) => sum + m.chance, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < monsters.length; i++) {
        roll -= monsters[i].chance;
        if (roll <= 0) return i;
    }
    return monsters.length - 1;
}

// Состояние сундука
let chestState = {
    active: false,
    hp: 0,
    maxHp: 0,
    reward: 0
};

// СРАЗУ устанавливаем HP выбранного моба
state.currentHp = monsters[state.monsterIndex].hp;

// Устанавливаем HP выбранного случайного моба
state.currentHp = monsters[state.monsterIndex].hp;

const rotations = { 1:{x:0,y:0}, 2:{x:90,y:0}, 3:{x:0,y:-90}, 4:{x:0,y:90}, 5:{x:-90,y:0}, 6:{x:0,y:180} };

function save() {
    localStorage.setItem('coins', state.coins);
    localStorage.setItem('monsterIndex', state.monsterIndex);
    localStorage.setItem('owned', JSON.stringify(state.owned));
    localStorage.setItem('currentSkin', state.currentSkin);
    localStorage.setItem('totalKills', state.totalKills);
    localStorage.setItem('level', state.level);
    localStorage.setItem('xp', state.xp);
}


// Добавить опыт и проверить повышение уровня
function addXP(amount) {
    if (state.level >= MAX_LEVEL) return;

    state.xp += amount;

    while (state.level < MAX_LEVEL) {
        const needed = xpForLevel(state.level);
        if (state.xp >= needed) {
            state.xp -= needed;
            state.level++;
            const reward = rewardForLevel(state.level);
            state.coins += reward;
            showLevelUp(state.level, reward);
        } else {
            break;
        }
    }

    if (state.level >= MAX_LEVEL) state.xp = 0;
}

// Универсальный тост
function showToast(text, type = 'info') {
    const el = document.getElementById('levelup-toast');
    if (!el) return;
    el.innerHTML = text;
    el.className = '';
    el.classList.add('show', 'toast-' + type);
    clearTimeout(el._hideTimer);
    const duration = type === 'admin' ? 5000 : 3000;
    el._hideTimer = setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

// Проверка сообщений от админа и бустов в реальном времени
async function checkAdminMessage() {
    if (!tg?.initData) return;
    try {
        const res = await fetch(API_URL + '/api/getUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
        const data = await res.json();
        if (data.pending_message) {
            showToast('👑 Админ (DNN): ' + data.pending_message, 'admin');
        }
        // Синхронизируем бусты
        if (data.boost_coins_until && data.boost_coins_until > Date.now()) {
            boosts.coins = parseInt(data.boost_coins_until);
            localStorage.setItem('boost_coins', boosts.coins);
        }
        if (data.boost_damage_until && data.boost_damage_until > Date.now()) {
            boosts.damage = parseInt(data.boost_damage_until);
            localStorage.setItem('boost_damage', boosts.damage);
        }
    } catch (e) {}
}

// Показать уведомление о повышении уровня
function showLevelUp(level, reward) {
    showToast(`⬆️ Уровень ${level}! +${reward} 💰`, 'level');
    tg?.HapticFeedback?.notificationOccurred('success');
}

function updateUI() {
    const mob = monsters[state.monsterIndex];
    const slimeImg = document.getElementById('slime');

    // Обновляем картинку и имя (только если не идёт анимация)
    if (!state.isRolling) {
        if (chestState.active) {
            if (slimeImg) slimeImg.src = IMAGES_DIR + "chest.png";
            if(document.getElementById('monster-name'))
                document.getElementById('monster-name').innerText = "💰 СУНДУК";
        } else {
            if (slimeImg) slimeImg.src = IMAGES_DIR + mob.img;
            if(document.getElementById('monster-name'))
                document.getElementById('monster-name').innerText = mob.name;
        }
    }

    // ... остальной код обновления (монеты, HP бар, кубик) ...

    if(document.getElementById('coin-count')) {
        document.getElementById('coin-count').innerText = state.coins;
    }
    if(document.getElementById('kill-count')) {
        document.getElementById('kill-count').innerText = state.totalKills;
    }
    
    // ОБЯЗАТЕЛЬНО: Обновляем золото внутри модального окна магазина
    const modalCoinDisplay = document.getElementById('modal-coins');
    if (modalCoinDisplay) {
        modalCoinDisplay.innerText = state.coins;
    }
    
    document.querySelectorAll('.buy-btn').forEach(btn => {
        const skin = btn.getAttribute('data-skin');
        
        if (state.currentSkin === skin) {
            btn.innerText = "ВЫБРАНО";
            btn.style.background = "#4CAF50"; // Зеленый для активного
        } else if (state.owned.includes(skin)) {
            btn.innerText = "ВЫБРАТЬ";
            btn.style.background = "#2196F3"; // Синий для купленных
        } else {
            const price = btn.getAttribute('data-price');
            btn.innerText = `${price} 💰`;
            btn.style.background = ""; // Стандартный цвет для покупки
        }
    });
    
    const hpBar = document.getElementById('hp-bar');
    const maxHp = chestState.active ? chestState.maxHp : mob.hp;
    const pct = (state.currentHp / maxHp * 100);
    if(hpBar) hpBar.style.width = Math.max(0, pct) + '%';
    if(document.getElementById('hp-text')) {
        document.getElementById('hp-text').innerText = `${Math.ceil(state.currentHp)}/${maxHp} HP`;
    }

    // Уровень и XP бар
    if(document.getElementById('xp-lvl-cur')) {
        document.getElementById('xp-lvl-cur').innerText = state.level;
    }
    if(document.getElementById('xp-lvl-next')) {
        document.getElementById('xp-lvl-next').innerText =
            state.level >= MAX_LEVEL ? '★' : state.level + 1;
    }
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    if (xpBar) {
        const needed = xpForLevel(state.level);
        const xpPct = state.level >= MAX_LEVEL ? 100 : (state.xp / needed * 100);
        xpBar.style.width = xpPct + '%';
    }
    if (xpText) {
        const needed = xpForLevel(state.level);
        xpText.innerText = state.level >= MAX_LEVEL ? 'MAX' : `${state.xp}/${needed} XP`;
    }
}

function canClaimDailyReward() {
    const lastClaim = localStorage.getItem('dailyRewardDate');
    if (!lastClaim) return true;
    return Date.now() - parseInt(lastClaim) >= 12 * 60 * 60 * 1000;
}

const wheelRewards = [25, 50, 100, 250, 500, 0, 'x2coins', 'x2damage'];

// Состояние бустов (время окончания в мс)
const boosts = {
    coins:  parseInt(localStorage.getItem('boost_coins'))  || 0,
    damage: parseInt(localStorage.getItem('boost_damage')) || 0
};

function boostActive(type) {
    return boosts[type] > Date.now();
}

function activateBoost(type, durationMs) {
    boosts[type] = Date.now() + durationMs;
    localStorage.setItem('boost_' + type, boosts[type]);
    updateBoostUI();
    showToast(type === 'coins' ? '💰 x2 монеты на 15 мин!' : '⚔️ x2 урон на 15 мин!', 'success');
}

function updateBoostUI() {
    const now = Date.now();
    const coinsEl  = document.getElementById('boost-coins');
    const damageEl = document.getElementById('boost-damage');
    const coinsTimer  = document.getElementById('boost-coins-timer');
    const damageTimer = document.getElementById('boost-damage-timer');

    if (boostActive('coins')) {
        const left = boosts.coins - now;
        const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
        if(coinsEl)  { coinsEl.classList.remove('hidden'); coinsEl.classList.add('boost-coins-active'); }
        if(coinsTimer) coinsTimer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else {
        if(coinsEl)  { coinsEl.classList.add('hidden'); coinsEl.classList.remove('boost-coins-active'); }
    }

    if (boostActive('damage')) {
        const left = boosts.damage - now;
        const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
        if(damageEl)  { damageEl.classList.remove('hidden'); damageEl.classList.add('boost-damage-active'); }
        if(damageTimer) damageTimer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else {
        if(damageEl)  { damageEl.classList.add('hidden'); damageEl.classList.remove('boost-damage-active'); }
    }
}

const wheelColors = ['#ff4b2b', '#ffd700', '#00c853', '#00b0ff', '#aa00ff', '#555', '#f6a623', '#e74c3c'];
const wheelLabels = ['25 💰', '50 💰', '100 💰', '250 💰', '500 💰', '0 💰', '💰×2', '⚔️×2'];

function drawWheel() {
    const canvas = document.getElementById('wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 4;
    const sectors = 8;
    const arc = (2 * Math.PI) / sectors;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < sectors; i++) {
        const startAngle = i * arc - Math.PI / 2;
        const endAngle = startAngle + arc;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = wheelColors[i];
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(startAngle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(wheelLabels[i], r - 8, 5);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.stroke();
}


function updateWheelTimer() {
    const timerEl = document.getElementById('wheel-timer');
    if (!timerEl) return;

    if (canClaimDailyReward()) {
        timerEl.textContent = '✅ Доступно сейчас!';
        timerEl.className = 'ready';
        return;
    }

    const lastClaim = parseInt(localStorage.getItem('dailyRewardDate'));
    const nextSpin = lastClaim + 12 * 60 * 60 * 1000;
    const diff = nextSpin - Date.now();

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    timerEl.textContent = `⏳ Следующий прокрут через: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    timerEl.className = '';
}

document.addEventListener('DOMContentLoaded', () => {
    // Вкладки
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const activePane = document.getElementById(targetId);
            if (activePane) activePane.classList.add('active');
            tg?.HapticFeedback?.selectionChanged();
        });
    });

    // Переключение страниц магазина
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.shop-page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById('shop-page-' + page);
            if (target) target.classList.add('active');
            tg?.HapticFeedback?.selectionChanged();
        });
    });

    // Магазин (Открыть/Закрыть)
    // Переключение страниц магазина
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.shop-page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById('shop-page-' + page);
            if (target) target.classList.add('active');
            tg?.HapticFeedback?.selectionChanged();
        });
    });

    // Магазин (Открыть/Закрыть)
    const shopOpen = document.getElementById('shop-open-btn');
    const shopClose = document.getElementById('shop-close-btn');
    const shopOverlay = document.getElementById('shop-overlay');

    if (shopOpen) {
        shopOpen.onclick = () => {
            // Всегда открываем на вкладке магазина
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-target="shop-tab"]').classList.add('active');
            document.getElementById('shop-tab').classList.add('active');
            updateUI();
            shopOverlay.classList.remove('hidden');
        };
    }
    if (shopClose) shopClose.onclick = () => shopOverlay.classList.add('hidden');


        // Кнопки покупки
    // Кнопки покупки
// Кнопки покупки и выбора скинов
document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.onclick = () => {
        const price = parseInt(btn.getAttribute('data-price'));
        const skin = btn.getAttribute('data-skin');

        // 1. Проверяем, куплен ли уже скин
        if (state.owned.includes(skin)) {
            state.currentSkin = skin;
            applySkin(skin);
            save();
            updateUI();
            return;
        }

        // 2. Логика покупки (используем state.coins!)
        if (state.coins >= price) {
            state.coins -= price;
            state.owned.push(skin); // Добавляем в список купленных
            state.currentSkin = skin;
            
            applySkin(skin);
            save();
            updateUI();
            
            tg?.HapticFeedback?.notificationOccurred('success');
        } else {
            showToast('❌ Недостаточно золота!', 'error');
            tg?.HapticFeedback?.notificationOccurred('error');
        }
    };
});

    // Отдельная функция для применения цвета кубика
    function applySkin(skinId) {
        const gradient = skinMap[skinId] || skinMap['default'];
        document.querySelectorAll('.face').forEach(f => {
            if (skinId === 'rgb') {
                f.style.background = '';
                f.classList.add('rgb-skin');
            } else {
                f.classList.remove('rgb-skin');
                f.style.background = gradient;
            }
        });
    }
    // АТАКА
    const rollBtn = document.getElementById('roll-button');
    if(rollBtn) {
        rollBtn.onclick = () => {
            if (state.isRolling) return;
            state.isRolling = true;

            const res = Math.floor(Math.random() * 6) + 1;
            state.rx += 1440 + rotations[res].x - (state.rx % 360);
            state.ry += 1440 + rotations[res].y - (state.ry % 360);

            const cube = document.getElementById('cube');
            if(cube) cube.style.transform = `rotateX(${state.rx}deg) rotateY(${state.ry}deg)`;
            tg?.HapticFeedback?.impactOccurred('medium');

            setTimeout(() => {
                const dmg = boostActive('damage') ? res * 2 : res;
                state.currentHp -= dmg;
                const slime = document.getElementById('slime');
                if(slime) {
                    slime.classList.add('hit');
                    setTimeout(() => slime.classList.remove('hit'), 300);
                }

                // ПРОВЕРКА СМЕРТИ МОБА
                // ПРОВЕРКА СМЕРТИ МОБА
                if (state.currentHp <= 0) {
                    if (chestState.active) {
                        // Убили сундук
                        const chestReward = chestState.reward;
                        state.coins += boostActive('coins') ? chestReward * 2 : chestReward;
                        chestState.active = false;
                        save();

                        if(slime) slime.src = IMAGES_DIR + "explosion.png";

                        setTimeout(() => {
                            // После сундука — обычный моб
                            state.monsterIndex = randomMonsterIndex();
                            const nextMob = monsters[state.monsterIndex];
                            state.currentHp = nextMob.hp;
                            if(slime) slime.src = IMAGES_DIR + nextMob.img;
                            if(document.getElementById('monster-name'))
                                document.getElementById('monster-name').innerText = nextMob.name;
                            updateUI();
                        }, 800);

                    } else {
                        // Убили обычного моба
                        const killedMob = monsters[state.monsterIndex];
                        state.coins += boostActive('coins') ? killedMob.reward * 2 : killedMob.reward;
                        state.totalKills++;
                        addXP(killedMob.xp);
                        save();

                        if(slime) slime.src = IMAGES_DIR + "explosion.png";

                        setTimeout(() => {
                            // Шанс 25% появления сундука
                            if (Math.random() < 0.25) {
                                chestState.active = true;
                                chestState.maxHp = Math.floor(Math.random() * 21) + 30; // 30–50
                                chestState.hp = chestState.maxHp;
                                chestState.reward = Math.floor(Math.random() * 201) + 50; // 50–250

                                state.currentHp = chestState.hp;
                                if(slime) slime.src = IMAGES_DIR + "chest.png";
                                if(document.getElementById('monster-name'))
                                    document.getElementById('monster-name').innerText = "💰 СУНДУК";
                            } else {
                                chestState.active = false;
                                state.monsterIndex = randomMonsterIndex();
                                const nextMob = monsters[state.monsterIndex];
                                state.currentHp = nextMob.hp;
                                if(slime) slime.src = IMAGES_DIR + nextMob.img;
                                if(document.getElementById('monster-name'))
                                    document.getElementById('monster-name').innerText = nextMob.name;
                            }
                            updateUI();
                        }, 800);
                    }
                }
                updateUI();
                state.isRolling = false;
            }, 2000);
        };
    }

const wheelOverlay = document.getElementById('wheel-overlay');
const wheelBtn = document.getElementById('daily-wheel-btn');
const wheelClose = document.getElementById('wheel-close-btn');
const spinBtn = document.getElementById('spin-wheel-btn');
const wheel = document.getElementById('wheel');

if (wheelBtn) {
    wheelBtn.onclick = () => {
        wheelOverlay.classList.remove('hidden');
    };
}

if (wheelClose) {
    wheelClose.onclick = () => {
        wheelOverlay.classList.add('hidden');
    };
}

let wheelRotation = 0;

if (spinBtn) {
    spinBtn.onclick = () => {

        if (!canClaimDailyReward()) {
            showToast('⏳ Сегодня уже крутили колесо!', 'warning');
            return;
        }

        spinBtn.disabled = true;

        const sector = Math.floor(Math.random() * 6);

        const reward = wheelRewards[sector];

        const sectorAngle = 360 / 6;
        // Случайное смещение внутри сектора (10%–90% от ширины ячейки)
        const offset = sectorAngle * (0.1 + Math.random() * 0.8);

        wheelRotation +=
            360 * 6 +
            (360 - sector * sectorAngle - offset);

        wheel.style.transform =
            `rotate(${wheelRotation}deg)`;

        setTimeout(() => {

            state.coins += reward;

            save();
            updateUI();

            localStorage.setItem(
                'dailyRewardDate',
                Date.now().toString()
            );

            showToast(`🎉 Вы выиграли ${reward} 💰!`, 'success');

            spinBtn.disabled = false;

        }, 4000);
    };
}

const dailyBtn = document.getElementById('daily-wheel-btn');

if (dailyBtn) {
    dailyBtn.onclick = () => {

        shopOverlay.classList.remove('hidden');

        document
            .querySelectorAll('.tab-btn')
            .forEach(b => b.classList.remove('active'));

        document
            .querySelectorAll('.tab-pane')
            .forEach(p => p.classList.remove('active'));

        document
            .querySelector('[data-target="wheel-tab"]')
            .classList.add('active');

        document
            .getElementById('wheel-tab')
            .classList.add('active');
    };
}

    // Модалка уровней
    const levelsOverlay = document.getElementById('levels-overlay');
    const levelCircle = document.getElementById('level-circle');
    const levelsClose = document.getElementById('levels-close-btn');

    function buildLevelsList() {
        const list = document.getElementById('levels-list');
        if (!list) return;
        list.innerHTML = '';
        for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
            const isCompleted = state.level > lvl;
            const isCurrent   = state.level === lvl;
            const needed = xpForLevel(lvl);
            const reward = rewardForLevel(lvl + 1);

            const row = document.createElement('div');
            row.className = 'level-row' +
                (isCurrent ? ' current' : '') +
                (isCompleted ? ' completed' : '');

            let xpBarHtml = '';
            if (isCurrent) {
                const pct = Math.min(100, Math.round(state.xp / needed * 100));
                xpBarHtml = `<div class="lvl-xp-bar"><div class="lvl-xp-fill" style="width:${pct}%"></div></div>`;
            }

            const checkmark = isCompleted ? '✅' : isCurrent ? '▶️' : '🔒';
            const subText = isCompleted
                ? 'Завершён'
                : isCurrent
                ? `${state.xp} / ${needed} XP`
                : `Нужно ${needed} XP`;

            row.innerHTML = `
                <div class="lvl-badge">${lvl}</div>
                <div class="lvl-info">
                    <div class="lvl-title">${checkmark} Уровень ${lvl}</div>
                    <div class="lvl-sub">${subText}</div>
                    ${xpBarHtml}
                </div>
                <div class="lvl-reward">+${reward} 💰</div>
            `;
            list.appendChild(row);
        }
        // Скроллим к текущему уровню
        const currentRow = list.querySelector('.level-row.current');
        if (currentRow) currentRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    if (levelCircle) {
        levelCircle.onclick = () => {
            buildLevelsList();
            levelsOverlay.classList.remove('hidden');
            tg?.HapticFeedback?.selectionChanged();
        };
    }
    if (levelsClose) {
        levelsClose.onclick = () => levelsOverlay.classList.add('hidden');
    }

    // Восстанавливаем скин при загрузке
    applySkin(state.currentSkin);

    // Включаем скролл в Telegram для всех скроллящихся списков
    enableTouchScroll(document.getElementById('levels-list'));
    enableTouchScroll(document.querySelector('#shop-overlay .modal'));

    updateUI();
    drawWheel();

    // Таймер колеса — обновляем каждую секунду
    updateWheelTimer();
    setInterval(updateWheelTimer, 1000);
    setInterval(updateBoostUI, 1000);
    updateBoostUI();

    // Проверяем сообщения от админа каждые 30 секунд
    setInterval(checkAdminMessage, 30000);
});