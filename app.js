// Инициализация Supabase с вашими ключами
const SUPABASE_URL = "https://ycmvhvsbcexxpuzdskpu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ztQr6Kblgt4kb-3R3nhiPg_ctswPZb6"; // Публичный ключ авторизации
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Объявляем глобальную константу курса ОДИН раз для всего файла на самом верху:
const EX_RATE = 5; 

// ==========================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ ИГРОВОГО ЧЕКА И ДОНАТА (ИСПРАВЛЕНИЕ ОШИБКИ DEFINED)
// ==========================================
function showReceipt(repairId) {
    let foundRepair = null;
    state.garage.forEach(car => {
        const allRepairs = [...car.visibleRepairs, ...car.hiddenRepairs];
        const rep = allRepairs.find(r => r.id === repairId);
        if (rep) foundRepair = rep;
    });

    const title = foundRepair ? foundRepair.name : "Комплексный ремонт узла автомобиля";
    let totalCost = foundRepair ? foundRepair.cost : 150000;
    if (state.upgrades.tools && foundRepair) totalCost = Math.round(totalCost * 0.85);

    document.getElementById('receipt-title').innerText = title;
    document.getElementById('receipt-total-price').innerText = formatMoney(totalCost);

    const listContainer = document.getElementById('receipt-works-list');
    listContainer.innerHTML = ''; 

    const partPrice = Math.round(totalCost * 0.65);
    const workPrice = totalCost - partPrice;

    const works = [
        { name: "Оригинальные автозапчасти и расходники", price: partPrice },
        { name: "Технологические нормо-часы механика СТО", price: workPrice }
    ];

    works.forEach(work => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${work.name}</span><strong>${money.format(work.price)} ₸</strong>`;
        listContainer.appendChild(li);
    });

    document.getElementById('receipt-modal').style.display = 'flex';
}

function closeReceipt() {
    document.getElementById('receipt-modal').style.display = 'none';
}

const COMMISSIONS = { kaspi: 0.00, card: 0.025, crypto: 0.01 };

function calculateDonation() {
    const kztInput = document.getElementById('kzt-amount').value;
    const method = document.getElementById('payment-method').value;
    
    const baseAmount = parseFloat(kztInput) || 0;
    const commRate = COMMISSIONS[method];
    const commission = baseAmount * commRate;
    const totalPay = baseAmount + commission;
    const gameMoney = baseAmount * EX_RATE;

    document.getElementById('res-base').innerText = money.format(baseAmount) + ' KZT';
    document.getElementById('res-comm').innerText = money.format(commission) + ' KZT';
    document.getElementById('res-total').innerText = money.format(totalPay) + ' KZT';
    document.getElementById('res-game-money').innerText = formatMoney(gameMoney);
    
    return { gameMoney, baseAmount };
}

async function processDemoPayment() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert('Ошибка: Для совершения платежа необходимо войти в личный кабинет!');
        return;
    }

    const { gameMoney, baseAmount } = calculateDonation();
    if (baseAmount < 500) {
        alert('Минимальная сумма пополнения — 500 KZT');
        return;
    }

    document.body.style.cursor = 'wait';
    state.balance += gameMoney;
    commit(`Успешно! Пополнение счета (Демо): +${formatMoney(gameMoney)}`);
    document.body.style.cursor = 'default';
}

// ==========================================
// ЛОГИКА РАБОТЫ ЛИЧНОГО КАБИНЕТА (ПОД СТРУКТУРУ ТВОЕЙ ТАБЛИЦЫ)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('authForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const usernameInput = document.getElementById('authUsername');
        
        if (usernameInput && usernameInput.hasAttribute('required')) {
            const username = usernameInput.value;
            await signUp(email, password, username);
        } else {
            await signIn(email, password);
        }
    });

    const toggleBtn = document.getElementById('authToggleType');
    toggleBtn.addEventListener('click', () => {
        const title = document.getElementById('authTitle');
        const desc = document.getElementById('authDesc');
        const userLabel = document.getElementById('usernameLabel');
        const userInp = document.getElementById('authUsername');
        const submitBtn = document.getElementById('authSubmitBtn');

        if (userInp.hasAttribute('required')) {
            title.textContent = "Вход в СТО";
            desc.textContent = "Введите данные мастера, чтобы восстановить баланс и сессию.";
            userLabel.style.display = "none";
            userInp.removeAttribute('required');
            submitBtn.textContent = "Войти";
            toggleBtn.textContent = "Нет аккаунта? Зарегистрироваться";
        } else {
            title.textContent = "Регистрация мастера";
            desc.textContent = "Создайте аккаунт, чтобы попасть в облачный рейтинг механиков.";
            userLabel.style.display = "flex";
            userInp.setAttribute('required', 'required');
            submitBtn.textContent = "Зарегистрироваться";
            toggleBtn.textContent = "Уже есть аккаунт? Войти";
        }
    });

    document.getElementById('logoutButton').onclick = logoutPlayer;

    if (document.getElementById('kzt-amount')) {
        calculateDonation();
    }
    
    checkCurrentSession();
});

async function checkCurrentSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        showProfile(session.user);
    } else {
        document.getElementById("authOverlay").style.display = "flex";
    }
}

async function signUp(email, password, username) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        alert('Ошибка регистрации: ' + error.message);
        return;
    }
    const user = data.user;
    if (user) {
        const { error: dbError } = await supabaseClient
            .from('profiles')
            .insert([{ 
                Id: user.id, 
                username: username, 
                balance: state.balance,
                xp: state.xp,
                reputation: state.reputation,
                sold_count: state.soldCount,
                profit_total: state.profitTotal
            }]);
        
        if (dbError) {
            console.error(dbError);
            alert('Ошибка создания профиля в БД: ' + dbError.message);
        } else {
            alert('Регистрация успешна! Сессия создана.');
            showProfile(user);
        }
    }
}

async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Ошибка входа: ' + error.message);
    } else {
        showProfile(data.user);
    }
}

async function showProfile(user) {
    document.getElementById("authOverlay").style.display = "none";
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('username, balance, xp, sold_count, profit_total')
        .eq('Id', user.id)
        .single();

    if (!error && data) {
        document.getElementById("playerUsername").textContent = data.username;
        state.balance = data.balance;
        state.xp = data.xp;
        state.soldCount = data.sold_count;
        state.profitTotal = data.profit_total;
        render();
    } else {
        document.getElementById("playerUsername").textContent = user.email.split('@')[0];
    }
}

async function logoutPlayer() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem(storageKey);
    window.location.reload();
}

async function syncBalanceToCloud() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        await supabaseClient
            .from('profiles')
            .update({ 
                balance: state.balance,
                xp: state.xp,
                sold_count: state.soldCount,
                profit_total: state.profitTotal
            })
            .eq('Id', user.id);
    }
}

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const storageKey = "autoFixIndustrialSim_v5";

const conditionLabels = { poor: "Критическое", fair: "Удовлетворительное", good: "Стабильное" };
const systems = { engine: "ДВС", suspension: "Ходовая часть", brakes: "Тормозная система", electric: "Электроника", body: "Кузов" };

const carTemplates = [
  { id: "audi-a4", name: "Audi A4 B6", year: 2003, basePrice: 900000, resaleMult: 1.35, image: "assets/audi-a4.jpg" },
  { id: "bmw-e30", name: "BMW E30 (Classic)", year: 1989, basePrice: 650000, resaleMult: 1.45, image: "assets/bmw-e30.jpg" },
  { id: "bmw-e39", name: "BMW E39", year: 2001, basePrice: 1000000, resaleMult: 1.38, image: "assets/bmw-e39.jpg" },
  { id: "honda-civic", name: "Honda Civic", year: 2010, basePrice: 950000, resaleMult: 1.28, image: "assets/honda-civic.jpg" },
  { id: "lada-priora", name: "Lada Priora", year: 2011, basePrice: 450000, resaleMult: 1.42, image: "assets/lada-priora.jpg" },
  { id: "lexus-gs300", name: "Lexus GS300", year: 2006, basePrice: 2500000, resaleMult: 1.32, image: "assets/lexus-gs300.jpg" },
  { id: "mercedes-w124", name: "Mercedes-Benz W124", year: 1994, basePrice: 700000, resaleMult: 1.45, image: "assets/mercedes-benz-w124.jpg" },
  { id: "mercedes-w201", name: "Mercedes-Benz W201", year: 1991, basePrice: 500000, resaleMult: 1.50, image: "assets/mercedes-benz-w201.jpg" },
  { id: "mercedes-w211", name: "Mercedes-Benz W211", year: 2004, basePrice: 900000, resaleMult: 1.32, image: "assets/mercedes-benz-w211.jpg" },
  { id: "mercedes-w204", name: "Mercedes-Benz W204", year: 2011, basePrice: 1100000, resaleMult: 1.28, image: "assets/mercedes-benz-w204.jpg" },
  { id: "toyota-mark-2", name: "Toyota Mark II", year: 1998, basePrice: 950000, resaleMult: 1.42, image: "assets/toyota-mark-2.jpg" },
  { id: "volkswagen-golf-5", name: "VW Golf V", year: 2007, basePrice: 950000, resaleMult: 1.34, image: "assets/volkswagen-golf-5.jpg" }
];

const possibleRepairs = [
  { name: "Капитальный ремонт ДВС", system: "engine", costRange: [120000, 200000], impact: 45 },
  { name: "Замена components ГРМ", system: "engine", costRange: [30000, 60000], impact: 15 },
  { name: "Комплексное обслуживание ходовой", system: "suspension", costRange: [40000, 80000], impact: 30 },
  { name: "Регенерация тормозной системы", system: "brakes", costRange: [15000, 35000], impact: 15 },
  { name: "Модернизация бортовой электроники", system: "electric", costRange: [20000, 50000], impact: 20 },
  { name: "Локальные кузовные работы", system: "body", costRange: [25000, 45000], impact: 12 },
  { name: "Стапельные работы и сварка порогов", system: "body", costRange: [50000, 100000], impact: 25 }
];

const marketEvents = [
  { id: "normal", title: "Стабильная конъюнктура", text: "Рыночные показатели в пределах нормы.", repairMod: 1.0, resaleMod: 1.0, type: "info" },
  { id: "crisis", title: "Кризис поставок компонентов", text: "Логистические сбои. Стоимость ремонта увеличена на 30%!", repairMod: 1.3, resaleMod: 1.0, type: "danger" },
  { id: "discount", title: "Оптимизация налогообложения запчастей", text: "Снижение пошлин. Себестоимость ремонта снижена на 20%!", repairMod: 0.8, resaleMod: 1.0, type: "good" },
  { id: "boom", title: "Всплеск потребительского спроса", text: "Инфляционные ожидания. Стоимость продажи выросла на 15%!", repairMod: 1.0, resaleMod: 1.15, type: "good" }
];

const upgradeTemplates = [
  { id: "scanner", name: "Диагностический комплекс OBD-III", cost: 150000, desc: "Автоматически выявляет 100% скрытых дефектов при покупке." },
  { id: "tools", name: "Профессиональное оборудование Hans", cost: 300000, desc: "Снижает базовую себестоимость нормо-часа ремонта на 15%." },
  { id: "marketing", name: "CRM-интеграция с маркетплейсами", cost: 200000, desc: "Повышает капитализацию и финальную маржинальность продаж на 8%." }
];

const creditProducts = [
  { id: "micro", name: "Микрозайм на покрытие кассового разрыва", principal: 300000, totalPayout: 360000, percent: 20, description: "Срочное пополнение капитала. Высокая ставка." },
  { id: "business", name: "Коммерческий кредит на развитие оборотного фонда", principal: 1000000, totalPayout: 1150000, percent: 15, description: "Оптимально для выкупа премиального сегмента авто." }
];

const initialState = {
  balance: 2000000,
  xp: 0,
  reputation: 75,
  soldCount: 0,
  profitTotal: 0,
  totalInvested: 0,
  garage: [],
  marketCars: [],
  upgrades: { scanner: false, tools: false, marketing: false },
  financialHistory: [],
  currentEvent: marketEvents[0],
  loan: { active: false, principal: 0, remaining: 0, name: "" },
  events: [{ type: "good", title: "Инициализация системы", text: "Платформа запущена в штатном режиме.", time: "Бизнес-инкубатор" }]
};

let state = loadState();
let financialChart = null;

const elements = {
  balanceText: document.querySelector("#balanceText"),
  xpText: document.querySelector("#xpText"),
  reputationText: document.querySelector("#reputationText"),
  soldText: document.querySelector("#soldText"),
  levelText: document.querySelector("#levelText"),
  marketList: document.querySelector("#marketList"),
  garageList: document.querySelector("#garageList"),
  repairList: document.querySelector("#repairList"),
  saleList: document.querySelector("#saleList"),
  eventsList: document.querySelector("#eventsList"),
  ratingList: document.querySelector("#ratingList"),
  creditPanel: document.querySelector("#creditPanel"),
  toast: document.querySelector("#toast"),
  menuButton: document.querySelector("#menuButton"),
  scrim: document.querySelector("#scrim")
};

if (state.marketCars.length === 0) {
    refreshMarket();
}

document.querySelectorAll("[data-view], [data-switch]").forEach(function(btn) {
  btn.addEventListener("click", function() {
      switchView(btn.dataset.view || btn.dataset.switch);
  });
});

document.querySelector("#newDealsButton").addEventListener("click", refreshMarket);
document.querySelector("#resetButton").addEventListener("click", resetGame);
elements.menuButton.addEventListener("click", function() {
    document.body.classList.add("menu-open");
});
elements.scrim.addEventListener("click", function() {
    document.body.classList.remove("menu-open");
});

// ИСПРАВЛЕННЫЕ СТРОКИ: без знаков ?.
var elSearch = document.querySelector("#searchInput");
if (elSearch) {
    elSearch.addEventListener("input", renderMarket);
}

var elCond = document.querySelector("#conditionFilter");
if (elCond) {
    elCond.addEventListener("change", renderMarket);
}

var elDeal = document.querySelector("#dealFilter");
if (elDeal) {
    elDeal.addEventListener("change", renderMarket);
}

injectAnalyticsContainers();
render();

function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateCarInstance(template) {
  const seed = Math.random();
  const condition = seed > 0.75 ? "good" : seed > 0.35 ? "fair" : "poor";
  const mileage = getRandom(90000, 380000);
  const priceModifier = 0.85 + Math.random() * 0.3;
  
  const healthFloor = condition === "good" ? 75 : condition === "fair" ? 45 : 20;
  const health = {};
  Object.keys(systems).forEach(s => health[s] = getRandom(healthFloor, Math.min(healthFloor + 25, 100)));

  const allRepairs = [...possibleRepairs].sort(() => 0.5 - Math.random());
  
  const mapRepair = r => ({
    ...r,
    id: Math.random().toString(36).substr(2, 9),
    cost: Math.round(getRandom(r.costRange[0], r.costRange[1]) * state.currentEvent.repairMod)
  });

  const visible = allRepairs.slice(0, getRandom(1, 2)).map(mapRepair);
  const hidden = Math.random() < 0.15 ? [] : allRepairs.slice(2, 2 + getRandom(1, 2)).map(mapRepair);

  if (state.upgrades.scanner) {
    visible.push(...hidden);
    hidden.length = 0;
  }

  const price = Math.round(template.basePrice * priceModifier);

  return {
    ...template,
    instanceId: Math.random().toString(36).substr(2, 9),
    condition,
    mileage,
    price,
    resale: Math.round(price * template.resaleMult * state.currentEvent.resaleMod),
    baseHealth: health,
    visibleRepairs: visible,
    hiddenRepairs: hidden,
    revealedRepairs: []
  };
}

function refreshMarket() {
  if (state.loan.active) {
    const interestCharge = Math.round(state.loan.principal * 0.02); 
    if (state.balance >= interestCharge) {
      state.balance -= interestCharge;
      addEvent("danger", "Проценты по кредиту", `Списана комиссия за обслуживание кредита: -${formatMoney(interestCharge)}`);
    } else {
      state.loan.remaining += interestCharge;
      addEvent("danger", "Просрочка платежа", `Недостаточно средств! Начисленные проценты капитализированы к долгу: +${formatMoney(interestCharge)}`);
    }
  }

  if (Math.random() > 0.4) {
    state.currentEvent = marketEvents[Math.floor(Math.random() * marketEvents.length)];
    addEvent(state.currentEvent.type, "Рыночный фактор: " + state.currentEvent.title, state.currentEvent.text);
  }
  const shuffledTemplates = [...carTemplates].sort(() => 0.5 - Math.random());
  state.marketCars = shuffledTemplates.slice(0, 9).map(t => generateCarInstance(t));
  commit("Рыночные предложения и экономические индексы обновлены.");
}

function buyUpgrade(id) {
  const upg = upgradeTemplates.find(u => u.id === id);
  if (state.balance >= upg.cost && !state.upgrades[id]) {
    state.balance -= upg.cost;
    state.totalInvested += upg.cost;
    state.upgrades[id] = true;
    addEvent("good", "Модернизация", `Активировано: ${upg.name}`);
    commit("Инвестиция успешно внесена в основные фонды.");
  } else {
    showToast("Недостаточно ликвидных средств.");
  }
}

function takeLoan(id) {
  if (state.loan.active) {
    showToast("В системе уже зарегистрирован активный кредитный договор!");
    return;
  }
  const prod = creditProducts.find(p => p.id === id);
  state.balance += prod.principal;
  state.loan = { active: true, name: prod.name, principal: prod.principal, remaining: prod.totalPayout };
  addEvent("good", "Финансирование", `Привлечен заемный капитал: +${formatMoney(prod.principal)}`);
  commit("Кредитные средства зачислены на расчетный счет.");
}

function payLoanManual(amount) {
  const payment = Math.min(state.balance, state.loan.remaining, amount);
  if (payment <= 0) {
    showToast("Недостаточно ликвидности для проведения транзакции.");
    return;
  }
  state.balance -= payment;
  state.loan.remaining -= payment;
  addEvent("info", "Погашение займа", `Произведен ручной платеж: -${formatMoney(payment)}`);
  if (state.loan.remaining <= 0) {
    state.loan = { active: false, principal: 0, remaining: 0, name: "" };
    addEvent("good", "Кредит закрыт", "Обязательства перед банком полностью ликвидированы.");
  }
  commit("Транзакция по кредиту успешно обработана.");
}

function buyCar(instanceId) {
  const index = state.marketCars.findIndex(c => c.instanceId === instanceId);
  const car = state.marketCars[index];
  if (state.balance >= car.price) {
    state.balance -= car.price;
    state.garage.push({ ...car, purchasePrice: car.price, repairCost: 0, completedRepairs: [] });
    state.marketCars.splice(index, 1);
    addEvent("good", "Акцепт сделки", `Приобретен актив: ${car.name}`);
    commit("Объект передан в зону технического контроля.");
  } else { showToast("Превышен лимит оборотного капитала!"); }
}

function diagnoseCar(instanceId) {
  const car = state.garage.find(c => c.instanceId === instanceId);
  if (state.upgrades.scanner) return;
  const unknownHidden = car.hiddenRepairs.filter(r => !car.revealedRepairs.includes(r.id));
  if (unknownHidden.length > 0) {
    car.revealedRepairs.push(unknownHidden[0].id);
    addEvent("danger", "Дефектовка", `Выявлен скрытый износ узла на ${car.name}: ${unknownHidden[0].name}`);
    commit("Корректировка дефектной ведомости.");
  } else { showToast("Дополнительных дефектов не обнаружено."); }
}

function repairCar(instanceId, repairId) {
  const car = state.garage.find(c => c.instanceId === instanceId);
  const repair = [...car.visibleRepairs, ...car.hiddenRepairs].find(r => r.id === repairId);
  let actualCost = repair.cost;
  if (state.upgrades.tools) actualCost = Math.round(actualCost * 0.85);

  if (state.balance >= actualCost) {
    state.balance -= actualCost;
    car.repairCost += actualCost;
    car.completedRepairs.push(repairId);
    state.xp += 60;
    commit(`Технологический процесс выполнен: ${repair.name}`);
  } else { showToast("Недостаточно средств на балансе."); }
}

function sellCar(instanceId) {
  const index = state.garage.findIndex(c => c.instanceId === instanceId);
  const car = state.garage[index];
  const healthRate = calculateHealth(car);
  let finalResale = car.resale * (healthRate / 100);
  if (state.upgrades.marketing) finalResale *= 1.08;
  finalResale = Math.round(finalResale);
  const netProfit = finalResale - car.purchasePrice - car.repairCost;

  state.balance += finalResale;
  state.profitTotal += netProfit;
  state.soldCount++;
  state.xp += netProfit > 0 ? 200 : 75;
  state.reputation = Math.max(10, Math.min(100, state.reputation + (netProfit > 0 ? 6 : -12)));

  state.financialHistory.push({ period: "Сделка №" + state.soldCount, profit: netProfit, balance: state.balance });
  state.garage.splice(index, 1);
  addEvent(netProfit > 0 ? "good" : "danger", "Ликвидация актива", `${car.name} реализован за ${formatMoney(finalResale)}. Маржа: ${formatMoney(netProfit)}`);
  commit(netProfit > 0 ? "Норма прибыли выполнена успешно." : "Реализация актива зафиксирована в убыток.");
}

function calculateHealth(car) {
  let totalHealth = 0;
  const sysKeys = Object.keys(systems);
  sysKeys.forEach(s => {
    let currentSystemHealth = car.baseHealth[s];
    const repairs = [...car.visibleRepairs, ...car.hiddenRepairs].filter(r => r.system === s);
    repairs.forEach(r => { if (car.completedRepairs.includes(r.id)) currentSystemHealth += r.impact; });
    totalHealth += Math.min(100, currentSystemHealth);
  });
  return Math.round(totalHealth / sysKeys.length);
}

function injectAnalyticsContainers() {
  const homeView = document.querySelector("#homeView");
  if (homeView && !document.querySelector("#diplomaDashboard")) {
    const dash = document.createElement("div");
    dash.id = "diplomaDashboard";
    dash.style.cssText = "background:var(--panel-2); padding:20px; border-radius:12px; margin-bottom:20px; border:1px solid var(--line);";
    homeView.insertBefore(dash, homeView.firstChild);
  }
  const settingsView = document.querySelector("#settingsView") || document.querySelector("#homeView");
  if (settingsView && !document.querySelector("#upgradesContainer")) {
    const upgSection = document.createElement("div");
    upgSection.id = "upgradesContainer";
    upgSection.style.cssText = "margin-top:25px; background:var(--panel); padding:20px; border-radius:12px; border:1px solid var(--line);";
    settingsView.appendChild(upgSection);
  }
}

function render() {
  elements.balanceText.textContent = formatMoney(state.balance);
  elements.xpText.textContent = `${state.xp} / 5000`;
  elements.reputationText.textContent = `${state.reputation}%`;
  elements.soldText.textContent = String(state.soldCount);
  elements.levelText.textContent = `Ранг: ${Math.floor(state.xp / 1000) + 1} Инженер`;

  renderDashboard();
  renderMarket();
  renderUpgrades();
  renderCompetitorRating();
  renderCreditPanel();
  renderGarageCollection(elements.garageList, "garage");
  renderGarageCollection(elements.repairList, "repair");
  renderGarageCollection(elements.saleList, "sale");
  renderEvents();
  renderChart();
}

function renderCompetitorRating() {
  if (!elements.ratingList) return;
  loadLeaderboard(); 
}

function renderCreditPanel() {
  if (!elements.creditPanel) return;
  if (state.loan.active) {
    const canPayAll = state.balance >= state.loan.remaining;
    elements.creditPanel.innerHTML = `
      <h3 style="margin-top:0; color:var(--red);">⚠️ Зафиксированы активные кредитные обязательства</h3>
      <p><strong>Программа:</strong> ${state.loan.name}</p>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; background:var(--bg); padding:15px; border-radius:8px;">
        <div><span style="color:var(--muted); font-size:12px;">Тело кредита</span><br><strong style="font-size:18px;">${formatMoney(state.loan.principal)}</strong></div>
        <div><span style="color:var(--muted); font-size:12px;">Остаток к выплате</span><br><strong style="font-size:18px; color:var(--amber);">${formatMoney(state.loan.remaining)}</strong></div>
      </div>
      <p style="font-size:12px; color:var(--muted); margin-bottom:15px;">ℹ️ Внимание: Каждое обновление рынка списывает 2% от суммы кредита в качестве операционных процентов банка. Погасите задолженность быстрее, чтобы остановить убытки.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="primary-button" id="payLoanBtn" style="background:var(--green); flex:1;">Внести платеж (200 000 ₸)</button>
        <button class="primary-button" id="payLoanAllBtn" style="background:var(--blue); flex:1;" ${!canPayAll ? 'disabled' : ''}>Погасить полностью (${formatMoney(state.loan.remaining)})</button>
      </div>
    `;
    elements.creditPanel.querySelector("#payLoanBtn").onclick = () => payLoanManual(200000);
    elements.creditPanel.querySelector("#payLoanAllBtn").onclick = () => payLoanManual(state.loan.remaining);
  } else {
    elements.creditPanel.innerHTML = `<h3 style="margin-top:0; color:var(--blue); margin-bottom:20px;">Доступные инвестиционные кредитные линии</h3>`;
    creditProducts.forEach(p => {
      const block = document.createElement("div");
      block.style.cssText = "background:var(--panel-2); padding:15px; border-radius:8px; border:1px solid var(--line); margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; gap:20px;";
      block.innerHTML = `
        <div style="flex:1;">
          <strong style="font-size:16px;">${p.name}</strong><br><span style="font-size:12px; color:var(--muted);">${p.description}</span><br>
          <span style="font-size:13px; color:var(--amber); font-weight:bold; margin-top:5px; display:inline-block;">Сумма: ${money.format(p.principal)} ₸ | К возврату: ${money.format(p.totalPayout)} ₸ (+${p.percent}%)</span>
        </div>
        <button class="primary-button" style="white-space:nowrap;">Заключить договор</button>
      `;
      block.querySelector("button").onclick = () => takeLoan(p.id);
      elements.creditPanel.appendChild(block);
    });
  }
}

function renderDashboard() {
  const container = document.querySelector("#diplomaDashboard");
  if (!container) return;
  const roi = state.totalInvested > 0 ? ((state.profitTotal / state.totalInvested) * 100).toFixed(1) : "0.0";
  const avgProfit = state.soldCount > 0 ? Math.round(state.profitTotal / state.soldCount) : 0;
  container.innerHTML = `
    <h3 style="margin-top:0; color:var(--blue);">📊 Аналитическая панель операционной деятельности</h3>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:15px;">
      <div><span style="color:var(--muted);font-size:13px;">Чистая рентабельность (ROI)</span><br><strong style="font-size:20px;color:var(--green);">${roi}%</strong></div>
      <div><span style="color:var(--muted);font-size:13px;">Общая накопленная прибыль</span><br><strong style="font-size:20px;">${formatMoney(state.profitTotal)}</strong></div>
      <div><span style="color:var(--muted);font-size:13px;">Средняя маржа с объекта</span><br><strong style="font-size:20px;color:var(--amber);">${formatMoney(avgProfit)}</strong></div>
      <div><span style="color:var(--muted);font-size:13px;">Инвестиции в основные фонды</span><br><strong style="font-size:20px;">${formatMoney(state.totalInvested)}</strong></div>
    </div>
    <div style="background:var(--bg); padding:10px; border-radius:8px; border:1px solid var(--line);">
      <span style="font-size:12px; color:var(--muted);">Текущий макроэкономический статус:</span>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
        <strong style="color: ${state.currentEvent.type === 'danger' ? 'var(--red)' : 'var(--green)'}">${state.currentEvent.title}</strong>
        <span style="font-size:12px;">Индекс ремонта: x${state.currentEvent.repairMod} | Индекс продаж: x${state.currentEvent.resaleMod}</span>
      </div>
    </div>
    <div style="margin-top:20px; height:200px; position:relative;"><canvas id="analyticsChartCanvas"></canvas></div>
  `;
}

function renderUpgrades() {
  const container = document.querySelector("#upgradesContainer");
  if (!container) return;
  container.innerHTML = `<h3 style="margin-top:0;color:var(--blue);">🛠️ Капитальные инвестиции и модернизация производства</h3>`;
  upgradeTemplates.forEach(u => {
    const bought = state.upgrades[u.id];
    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line); gap:10px;";
    row.innerHTML = `
      <div style="flex:1;"><strong style="color:var(--text);">${u.name}</strong><br><span style="font-size:12px; color:var(--muted);">${u.desc}</span></div>
      <button class="${bought ? 'secondary-button' : 'primary-button'}" style="white-space:nowrap;" ${bought || state.balance < u.cost ? 'disabled' : ''}>${bought ? 'Внедрено' : `Купить за ${money.format(u.cost)} ₸`}</button>
    `;
    row.querySelector("button").onclick = () => buyUpgrade(u.id);
    container.appendChild(row);
  });
}

function renderChart() {
  const canvas = document.getElementById("analyticsChartCanvas");
  if (!canvas || !window.Chart) return;
  const ctx = canvas.getContext("2d");
  const labels = state.financialHistory.map(h => h.period);
  const data = state.financialHistory.map(h => h.balance);
  if (labels.length === 0) { labels.push("Старт"); data.push(2000000); }
  if (financialChart) financialChart.destroy();
  financialChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{ label: 'Динамика оборотного капитала (₸)', data: data, borderColor: '#2f6df6', backgroundColor: 'rgba(47, 109, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: '#263447' }, ticks: { color: '#9aa7b7' } }, y: { grid: { color: '#263447' }, ticks: { color: '#9aa7b7' } } }
    }
  });
}

function renderMarket() {
  let eventBanner = document.querySelector("#marketEventBanner");
  if (!eventBanner) {
    eventBanner = document.createElement("div");
    eventBanner.id = "marketEventBanner";
    elements.marketList.parentNode.insertBefore(eventBanner, elements.marketList);
  }
  
  if (state.currentEvent.id !== "normal") {
    const isDanger = state.currentEvent.type === "danger";
    eventBanner.style.cssText = `padding:15px; border-radius:8px; margin-bottom:20px; font-size:14px; border:1px solid ${isDanger ? 'var(--red)' : 'var(--green)'}; background:${isDanger ? 'rgba(225,93,100,0.1)' : 'rgba(85,200,120,0.1)'};`;
    eventBanner.innerHTML = `<strong style="color:${isDanger?'var(--red)':'var(--green)'}; font-size:16px;">📢 Экономический фактор: ${state.currentEvent.title}</strong><p style="margin:5px 0 0 0; color:var(--text);">${state.currentEvent.text}</p>`;
  } else {
    eventBanner.style.cssText = "display:none;";
  }

  const searchVal = document.querySelector("#searchInput")?.value.toLowerCase() || "";
  const condVal = document.querySelector("#conditionFilter")?.value || "all";
  const dealVal = document.querySelector("#dealFilter")?.value || "all";

  elements.marketList.innerHTML = "";

  const filteredCars = state.marketCars.filter(car => {
    const matchesSearch = car.name.toLowerCase().includes(searchVal);
    const matchesCond = condVal === "all" || car.condition === condVal;
    
    const visibleCost = car.visibleRepairs.reduce((s, r) => s + r.cost, 0);
    const forecast = car.resale - car.price - visibleCost;
    const matchesDeal = dealVal === "all" || 
                        (dealVal === "positive" && forecast > 0) || 
                        (dealVal === "danger" && forecast <= 0);

    return matchesSearch && matchesCond && matchesDeal;
  });

  if (filteredCars.length === 0) {
    elements.marketList.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--muted);">Подходящих автомобилей не найдено. Измените параметры фильтров.</div>`;
    return;
  }

  filteredCars.forEach(car => {
    const template = document.querySelector("#marketCardTemplate").content.cloneNode(true);
    const visibleCost = car.visibleRepairs.reduce((s, r) => s + r.cost, 0);
    const forecast = car.resale - car.price - visibleCost;

    template.querySelector(".car-image").src = car.image;
    template.querySelector("h2").textContent = car.name;
    template.querySelector(".condition-badge").textContent = conditionLabels[car.condition];
    template.querySelector(".condition-badge").className = `condition-badge condition-${car.condition}`;
    template.querySelector(".car-meta").textContent = `${car.year} г.в. · ${car.mileage.toLocaleString()} км`;
    template.querySelector(".price-text").textContent = formatMoney(car.price);
    template.querySelector(".visible-cost").textContent = formatMoney(visibleCost);
    template.querySelector(".forecast-text").textContent = formatMoney(forecast);
    template.querySelector(".forecast-text").className = `forecast-text ${forecast > 0 ? 'profit-positive' : 'profit-negative'}`;
    
    const btn = template.querySelector(".buy-button");
    btn.disabled = state.balance < car.price;
    btn.onclick = () => buyCar(car.instanceId);

    elements.marketList.append(template);
  });
}

function renderGarageCollection(container, mode) {
  if (!container) return;
  container.innerHTML = "";
  if (state.garage.length === 0) {
    container.innerHTML = `<div class="empty-state"><h2>Объекты в обработке отсутствуют</h2><p>Перейдите на вкладку рынка для подбора активов</p></div>`;
    return;
  }

  state.garage.forEach(car => {
    const template = document.querySelector("#garageCardTemplate").content.cloneNode(true);
    const health = calculateHealth(car);
    
    template.querySelector(".garage-image").src = car.image;
    template.querySelector("h2").textContent = car.name;
    template.querySelector(".health-text").textContent = `${health}%`;
    template.querySelector(".purchase-text").textContent = formatMoney(car.purchasePrice);
    template.querySelector(".repair-text").textContent = formatMoney(car.repairCost);
    
    let currentEstimatedValue = car.resale * (health / 100);
    if (state.upgrades.marketing) currentEstimatedValue *= 1.08;
    currentEstimatedValue = Math.round(currentEstimatedValue);
    template.querySelector(".value-text").textContent = formatMoney(currentEstimatedValue);

    const financialResult = currentEstimatedValue - car.purchasePrice - car.repairCost;
    const resultElement = template.querySelector(".result-text");
    if (resultElement) {
      resultElement.textContent = formatMoney(financialResult);
      resultElement.style.color = financialResult >= 0 ? "var(--green)" : "var(--red)";
    }
    const badgeElement = template.querySelector(".profit-badge");
    if (badgeElement) {
      badgeElement.textContent = financialResult >= 0 ? "В ПЛЮСЕ" : "В УБЫТКЕ";
      badgeElement.style.cssText = `font-size:11px; padding:2px 6px; border-radius:4px; margin-left:10px; font-weight:bold; background:${financialResult >= 0 ? 'rgba(85,200,120,0.2)' : 'rgba(225,93,100,0.2)'}; color:${financialResult >= 0 ? 'var(--green)' : 'var(--red)'};`;
    }

    const list = template.querySelector(".repair-items");
    const allKnown = [...car.visibleRepairs, ...car.hiddenRepairs.filter(r => car.revealedRepairs.includes(r.id))];
    
    allKnown.forEach(r => {
      const isDone = car.completedRepairs.includes(r.id);
      let actualCost = r.cost;
      if (state.upgrades.tools) actualCost = Math.round(actualCost * 0.85);

      let valueBump = Math.round((car.resale * (r.impact / 5)) / 100);
      if (state.upgrades.marketing) valueBump = Math.round(valueBump * 1.08);

      const item = document.createElement("div");
      item.className = "repair-row";
      item.innerHTML = `
        <div>
          <strong>${r.name}</strong><br>
          <span style="font-size:11px;color:var(--muted);">${systems[r.system]}</span>
          ${!isDone ? `<br><span style="font-size:11px; color:var(--green); font-weight:500;">📈 Рост цены: +${money.format(valueBump)} ₸</span>` : ''}
        </div>
        <strong>${isDone ? "Ликвидировано" : formatMoney(actualCost)}</strong>
      `;
      if (!isDone && mode !== "sale") {
        const btn = document.createElement("button");
        btn.className = "secondary-button";
        btn.textContent = "Устранить";
        btn.onclick = () => {
            repairCar(car.instanceId, r.id); 
            showReceipt(r.id); 
        };
        item.append(btn);
      }
      list.append(item);
    });

    const diagBtn = template.querySelector(".diagnose-button");
    if (diagBtn) {
      diagBtn.onclick = () => diagnoseCar(car.instanceId);
      if (mode === "sale" || state.upgrades.scanner) diagBtn.style.display = "none";
    }

    const sellBtn = template.querySelector(".sell-button");
    if (sellBtn) {
      sellBtn.onclick = () => sellCar(car.instanceId);
      if (mode === "repair") sellBtn.style.display = "none";
    }

    container.append(template);
  });
}

function commit(msg) { saveState(); render(); showToast(msg); syncBalanceToCloud(); }
function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function loadState() {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialState));
}
function formatMoney(v) { return `${money.format(v)} ₸`; }
function addEvent(type, title, text) {
  state.events.unshift({ type, title, text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
}
function showToast(m) {
  elements.toast.textContent = m;
  elements.toast.classList.add("is-visible");
  setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}
function switchView(v) {
  document.querySelectorAll(".view").forEach(el => el.classList.remove("is-visible"));
  const view = document.querySelector(`#${v}View`);
  if (view) view.classList.add("is-visible");
  document.querySelectorAll(".nav-button").forEach(b => b.classList.toggle("is-active", b.dataset.view === v));
}
function renderEvents() {
  if (!elements.eventsList) return;
  elements.eventsList.innerHTML = "";
  state.events.slice(0, 15).forEach(e => {
    const el = document.createElement("div");
    el.className = "event-item";
    el.innerHTML = `<span class="event-type event-${e.type}">!</span><div><strong>${e.title}</strong><span>${e.text}</span></div><span class="event-time">${e.time}</span>`;
    elements.eventsList.append(el);
  });
}

function resetGame() {
  if (confirm("Выполнить сброс системы и очистить базу транзакций?")) {
    state = JSON.parse(JSON.stringify(initialState));
    refreshMarket();
  }
}

async function loadLeaderboard() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('username, balance')
        .order('balance', { ascending: false }) 
        .limit(10); 

    const container = document.getElementById('ratingList');
    if (!container) return; 
    container.innerHTML = "";

    const baseCompetitors = [
      { name: "Astana Motors Trade", capBase: 4500000, rep: 90, icon: "🏢" },
      { name: "Almaty Car-Recycling Corp", capBase: 2800000, rep: 60, icon: "🏭" },
      { name: "Шокан и Партнеры (ИП)", capBase: 1200000, rep: 85, icon: "🛠️" }
    ];

    let cloudPlayers = [];
    if (!error && data) {
        cloudPlayers = data.map(p => ({ name: p.username, capBase: p.balance, rep: 80, icon: "🔧" }));
    }

    const currentNick = document.getElementById("playerUsername").textContent;
    const entities = [
        { name: `${currentNick} (Вы)`, capBase: state.balance + state.totalInvested, rep: state.reputation, icon: "⭐", isPlayer: true },
        ...baseCompetitors,
        ...cloudPlayers.filter(p => p.name !== currentNick)
    ];
    
    entities.sort((a, b) => b.capBase - a.capBase);

    entities.forEach((entity, index) => {
      const card = document.createElement("div");
      card.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid var(--line); ${entity.isPlayer ? 'background: rgba(47, 109, 246, 0.15); border-color: var(--blue); font-weight: bold;' : 'background: var(--panel);'}`;
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
          <span style="font-size:18px; color:var(--muted); width:25px;">#${index + 1}</span>
          <span style="font-size:24px;">${entity.icon}</span>
          <div><span style="color:var(--text);">${entity.name}</span><br><span style="font-size:12px; color:var(--muted);">Репутация: ${entity.rep}%</span></div>
        </div>
        <strong style="color:${entity.isPlayer ? 'var(--blue)' : 'var(--text)'};">${formatMoney(Math.round(entity.capBase))}</strong>
      `;
      container.appendChild(card);
    });
}
