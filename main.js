// App State
const state = {
    profile: null, // { name, age, gender, weight, height, activity, goal }
    dailyGoal: 0,
    macros: {
        protein: 0,
        carbs: 0,
        fats: 0
    },
    currentDate: '', // initialized on load
    history: {}, /* { 
        "2026-02-25": {
            consumed: { calories, protein, carbs, fats },
            meals: [],
            water: 0,
            burnedCalories: 0,
            exercises: []
        }
    } */
    weightHistory: [], // { date: string, weight: number }
    settings: { geminiApiKey: '' }
};

// Check for existing profile and state
const savedState = localStorage.getItem('macroTrackerState');
if (savedState) {
    const parsed = JSON.parse(savedState);
    state.profile = parsed.profile || null;
    state.dailyGoal = parsed.dailyGoal || 0;
    state.dailyWaterGoal = parsed.dailyWaterGoal || 8; // fallback to 8
    state.macros = parsed.macros || { protein: 0, carbs: 0, fats: 0 };
    state.weightHistory = parsed.weightHistory || [];
    state.settings = parsed.settings || { geminiApiKey: '' };

    // Migration: If old flat data exists, move it to today's date in history
    state.history = parsed.history || {};
    if (parsed.consumed || parsed.meals) {
        const todayForMig = new Date().toISOString().split('T')[0];
        if (!state.history[todayForMig]) {
            state.history[todayForMig] = {
                consumed: parsed.consumed || { calories: 0, protein: 0, carbs: 0, fats: 0 },
                meals: parsed.meals || [],
                water: 0,
                burnedCalories: 0,
                exercises: []
            };
        }
    }

    // Legacy migration for water
    for (const dateKey in state.history) {
        if (typeof state.history[dateKey].water === 'undefined') {
            state.history[dateKey].water = 0;
        }
        if (typeof state.history[dateKey].burnedCalories === 'undefined') {
            state.history[dateKey].burnedCalories = 0;
        }
        if (typeof state.history[dateKey].exercises === 'undefined') {
            state.history[dateKey].exercises = [];
        }
    }
}

// Ensure currentDate is set
state.currentDate = new Date().toISOString().split('T')[0];

// Helper to get selected date data
function getSelectedDateData() {
    if (!state.history[state.currentDate]) {
        state.history[state.currentDate] = {
            consumed: { calories: 0, protein: 0, carbs: 0, fats: 0 },
            meals: [],
            water: 0,
            burnedCalories: 0,
            exercises: []
        };
    }
    return state.history[state.currentDate];
}

// Main View Elements
const onboardingContainer = document.getElementById('onboarding');
const mainAppContainer = document.getElementById('main-app');
const onboardingForm = document.getElementById('onboarding-form');
const homeView = document.getElementById('home-view');
const progressView = document.getElementById('progress-view');
const settingsView = document.getElementById('settings-view');

// Nav Buttons
const navHome = document.getElementById('nav-home');
const navProgress = document.getElementById('nav-progress');
const navSettings = document.getElementById('nav-settings');

// DOM Elements
const dateDisplay = document.getElementById('date-display');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const calRing = document.getElementById('cal-ring');
const calRemaining = document.getElementById('cal-remaining');
const pBar = document.getElementById('p-bar');
const cBar = document.getElementById('c-bar');
const fBar = document.getElementById('f-bar');
const pVal = document.getElementById('p-val');
const cVal = document.getElementById('c-val');
const fVal = document.getElementById('f-val');
const pGoal = document.getElementById('p-goal');
const cGoal = document.getElementById('c-goal');
const fGoal = document.getElementById('f-goal');
const userNameDisplay = document.getElementById('user-name-display');

// Water Elements
const waterCountDisplay = document.getElementById('water-count');
const waterTargetDisplay = document.getElementById('water-target');
const waterMinusBtn = document.getElementById('water-minus-btn');
const waterPlusBtn = document.getElementById('water-plus-btn');

// Exercise Elements
const exerciseForm = document.getElementById('exercise-form');
const exerciseDescInput = document.getElementById('exercise-desc-input');
const exerciseSubmitBtn = document.getElementById('exercise-submit-btn');
const exercisesList = document.getElementById('exercises-list');

// Chart Elements
let weightChartInstance = null;
const logWeightForm = document.getElementById('log-weight-form');

// Calculate Goals Based on Profile
function calculateGoals(profile) {
    let bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
    bmr += (profile.gender === 'male') ? 5 : -161;
    const tdee = bmr * profile.activity;
    let dailyGoal = tdee;
    if (profile.goal === 'lose') dailyGoal -= 500;
    if (profile.goal === 'gain') dailyGoal += 300;
    dailyGoal = Math.max(Math.round(dailyGoal), 1200);

    const protein = Math.round(profile.weight * 2);
    const fats = Math.round((dailyGoal * 0.25) / 9);
    const carbs = Math.max(Math.round((dailyGoal - (protein * 4) - (fats * 9)) / 4), 0);

    const waterVolumeMl = profile.weight * 35;
    const waterGoalGlasses = Math.ceil(waterVolumeMl / 250);

    return { dailyGoal, waterGoal: waterGoalGlasses, macros: { protein, carbs, fats } };
}

// Format Date YYYY-MM-DD
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

// Initialize or update Chart.js
function renderChart() {
    const ctx = document.getElementById('weight-chart');
    if (!ctx) return;

    // Sort history by date just in case
    const history = [...state.weightHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = history.map(entry => {
        const d = new Date(entry.date);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const data = history.map(entry => entry.weight);

    if (weightChartInstance) {
        weightChartInstance.data.labels = labels;
        weightChartInstance.data.datasets[0].data = data;
        weightChartInstance.update();
        return;
    }

    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: 'white',
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (context) => `${context.parsed.y} kg` }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f1f5f9' },
                    ticks: { callback: (value) => value + 'k' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// Navigation Logic
function switchView(viewId) {
    [homeView, progressView, settingsView].forEach(view => {
        if (view) {
            view.classList.add('hidden');
            view.classList.remove('active');
        }
    });
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
}

navHome.addEventListener('click', () => {
    navHome.classList.add('active');
    navProgress.classList.remove('active');
    navSettings.classList.remove('active');
    switchView('home-view');
});

navProgress.addEventListener('click', () => {
    navProgress.classList.add('active');
    navHome.classList.remove('active');
    navSettings.classList.remove('active');
    switchView('progress-view');
    renderChart();
});

navSettings.addEventListener('click', () => {
    navSettings.classList.add('active');
    navHome.classList.remove('active');
    navProgress.classList.remove('active');
    switchView('settings-view');

    // Populate form if needed
    document.getElementById('gemini-api-key').value = state.settings.geminiApiKey || '';
});

// Settings Save
document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.settings.geminiApiKey = document.getElementById('gemini-api-key').value.trim();
    localStorage.setItem('macroTrackerState', JSON.stringify(state));
    alert('Configuración guardada correctamente.');
});

// Weight Logging
logWeightForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const weightInput = document.getElementById('new-weight-input');
    const newWeight = parseFloat(weightInput.value);

    if (isNaN(newWeight)) return;

    const todayDateStr = getTodayDateStr();

    // Check if we already logged today
    const existingEntryIndex = state.weightHistory.findIndex(entry => entry.date === todayDateStr);
    if (existingEntryIndex >= 0) {
        state.weightHistory[existingEntryIndex].weight = newWeight;
    } else {
        state.weightHistory.push({ date: todayDateStr, weight: newWeight });
    }

    // Also update current profile weight and recalculate goals
    state.profile.weight = newWeight;
    const calculated = calculateGoals(state.profile);
    state.dailyGoal = calculated.dailyGoal;
    state.dailyWaterGoal = calculated.waterGoal;
    state.macros = calculated.macros;

    localStorage.setItem('macroTrackerState', JSON.stringify(state));
    updateUI();
    renderChart();

    weightInput.value = '';
    alert('¡Peso guardado!');
});

// Onboarding Submission
onboardingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const profile = {
        name: document.getElementById('user-name-input').value,
        age: parseInt(document.getElementById('user-age').value),
        weight: parseFloat(document.getElementById('user-weight').value),
        height: parseInt(document.getElementById('user-height').value),
        gender: document.getElementById('user-gender').value,
        activity: parseFloat(document.getElementById('user-activity').value),
        goal: document.getElementById('user-goal').value
    };

    const calculated = calculateGoals(profile);

    state.profile = profile;
    state.dailyGoal = calculated.dailyGoal;
    state.dailyWaterGoal = calculated.waterGoal;
    state.macros = calculated.macros;
    state.weightHistory = [{ date: getTodayDateStr(), weight: profile.weight }];

    state.history = {}; // clear past if new profile is created
    state.currentDate = getTodayDateStr();
    state.history[state.currentDate] = {
        consumed: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        meals: [],
        water: 0
    };

    localStorage.setItem('macroTrackerState', JSON.stringify(state));
    initializeView();
});

// --- Gemini AI Integration ---
const aiMealBtn = document.getElementById('ai-meal-btn');
const aiImageInput = document.getElementById('ai-image-input');
const aiLoadingOverlay = document.getElementById('ai-loading-overlay');

aiMealBtn.addEventListener('click', () => {
    if (!state.settings || !state.settings.geminiApiKey) {
        alert('Por favor, configura tu API Key de Gemini en la pestaña de ajustes (⚙️) antes de usar esta función.');
        return;
    }
    aiImageInput.click();
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

aiImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    aiLoadingOverlay.classList.remove('hidden');

    try {
        const base64Image = await fileToBase64(file);
        const mimeType = file.type;

        const apiKey = state.settings.geminiApiKey;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const promptText = `Eres un dietista clínico experto. Analiza detalladamente la imagen de esta comida. Identifica los ingredientes visibles y estima el tamaño de sus porciones. Luego, usando la base de datos de nutrición del Departamento de Agricultura de los Estados Unidos (USDA) como referencia, debatiendo internamente, calcula de la forma más exacta y rigurosa posible las calorías y macronutrientes totales. 
Devuelve ÚNICAMENTE un objeto JSON válido con las siguientes claves: "name" (string, nombre descriptivo del plato en español), "calories" (number), "protein" (number en gramos), "carbs" (number en gramos), "fats" (number en gramos). No devuelvas ningún texto extra, ni bloques de código formateados (sin \`\`\`json).`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inlineData: { mimeType: mimeType, data: base64Image } }
                ]
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (!response.ok) {
            throw new Error(rawData.error?.message || 'Error en la llamada a la API');
        }

        const textResponse = rawData.candidates[0].content.parts[0].text;

        let aiResult;
        try {
            // Limpiar posibles bloques markdown
            const cleanedText = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            aiResult = JSON.parse(cleanedText);
        } catch (jsonError) {
            console.error('Failed to parse JSON:', textResponse);
            throw new Error('No se pudo analizar el resultado de la IA.');
        }

        // Fill modal with AI results
        document.getElementById('meal-name').value = aiResult.name || 'Comida detectada';
        document.getElementById('meal-cal').value = aiResult.calories || 0;
        document.getElementById('meal-p').value = aiResult.protein || 0;
        document.getElementById('meal-c').value = aiResult.carbs || 0;
        document.getElementById('meal-f').value = aiResult.fats || 0;

        // Open Modal
        modal.classList.add('active');

    } catch (error) {
        alert(`Error al analizar la imagen: ${error.message}`);
    } finally {
        aiLoadingOverlay.classList.add('hidden');
        aiImageInput.value = ''; // Reset input
    }
});
// Date Navigation Logic
function updateDateDisplay() {
    const todayStr = getTodayDateStr();
    const current = state.currentDate;

    // Format display string
    if (current === todayStr) {
        dateDisplay.textContent = 'Hoy';
        nextDayBtn.disabled = true;
    } else {
        const d = new Date(current + 'T00:00:00');
        // Check if yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
            dateDisplay.textContent = 'Ayer';
        } else {
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            dateDisplay.textContent = `${d.getDate()} ${months[d.getMonth()]}`;
        }
        nextDayBtn.disabled = false;
    }
}

prevDayBtn.addEventListener('click', () => {
    const d = new Date(state.currentDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    state.currentDate = d.toISOString().split('T')[0];
    updateDateDisplay();
    updateUI();
    renderMeals();
});

nextDayBtn.addEventListener('click', () => {
    const d = new Date(state.currentDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const newDateStr = d.toISOString().split('T')[0];
    const todayStr = getTodayDateStr();

    if (newDateStr <= todayStr) {
        state.currentDate = newDateStr;
        updateDateDisplay();
        updateUI();
        renderMeals();
        renderExercises();
    }
});

function initializeView() {
    if (state.profile) {
        // Automatically recalculate on boot to sync legacy formats
        const calculated = calculateGoals(state.profile);
        state.dailyWaterGoal = calculated.waterGoal;

        onboardingContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        userNameDisplay.textContent = state.profile.name;
        pGoal.textContent = state.macros.protein;
        cGoal.textContent = state.macros.carbs;
        fGoal.textContent = state.macros.fats;

        // Default to home view
        switchView('home-view');
        navHome.classList.add('active');
        navProgress.classList.remove('active');
        navSettings.classList.remove('active');

        // Reset display Date (always start on Today)
        state.currentDate = getTodayDateStr();
        updateDateDisplay();

        updateUI();
        renderMeals();
        renderExercises();
    } else {
        onboardingContainer.classList.remove('hidden');
        mainAppContainer.classList.add('hidden');
    }
}

// Modal Elements
const modal = document.getElementById('add-meal-modal');
const addMealBtn = document.getElementById('add-meal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const addMealForm = document.getElementById('add-meal-form');
const mealsList = document.getElementById('meals-list');



// Updates UI based on state
function updateUI() {
    const todayData = getSelectedDateData();
    const remaining = state.dailyGoal - todayData.consumed.calories + (todayData.burnedCalories || 0);
    calRemaining.textContent = Math.max(0, remaining);

    // Progress Ring Calculation (SVG Circle circumference = 2 * PI * 54 ≈ 339)
    const circumference = 2 * Math.PI * 54;
    // Cap progress at 1 to prevent reverse spinning when over max. (Account for burned)
    const netCalories = Math.max(0, todayData.consumed.calories - (todayData.burnedCalories || 0));
    const progress = Math.min(netCalories / state.dailyGoal, 1);
    const offset = circumference - (progress * circumference);
    calRing.style.strokeDashoffset = offset;

    // Macro Bars (Cap at 100%)
    pBar.style.width = `${Math.min((todayData.consumed.protein / state.macros.protein) * 100, 100)}%`;
    cBar.style.width = `${Math.min((todayData.consumed.carbs / state.macros.carbs) * 100, 100)}%`;
    fBar.style.width = `${Math.min((todayData.consumed.fats / state.macros.fats) * 100, 100)}%`;

    pVal.textContent = todayData.consumed.protein;
    cVal.textContent = todayData.consumed.carbs;
    fVal.textContent = todayData.consumed.fats;

    // Water Tracker
    waterCountDisplay.textContent = todayData.water || 0;
    if (waterTargetDisplay) {
        waterTargetDisplay.textContent = `/ ${state.dailyWaterGoal || 8}`;
    }
}

// Render Meals
function renderMeals() {
    const todayData = getSelectedDateData();
    if (todayData.meals.length === 0) {
        mealsList.innerHTML = '<div class="empty-state">No has agregado comidas en este día</div>';
        return;
    }

    // Reverse to show newest first
    const reversedMeals = [...todayData.meals].reverse();

    mealsList.innerHTML = reversedMeals.map(meal => `
        <div class="summary-card" style="padding: 16px; margin-bottom: 0;">
            <div style="flex: 1;">
                <h4 style="margin-bottom: 4px;">${meal.name}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 12px;">
                    <span><span style="color: var(--protein); font-weight: 600;">P:</span> ${meal.protein}g</span>
                    <span><span style="color: var(--carbs); font-weight: 600;">C:</span> ${meal.carbs}g</span>
                    <span><span style="color: var(--fats); font-weight: 600;">G:</span> ${meal.fats}g</span>
                </div>
            </div>
            <div style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center;">
                ${meal.calories} <small style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400; margin-left: 2px;">kcal</small>
                <button class="delete-meal-btn" data-id="${meal.id}" title="Eliminar comida">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Render Exercises
function renderExercises() {
    const todayData = getSelectedDateData();
    if (!exercisesList) return;

    if (todayData.exercises.length === 0) {
        exercisesList.innerHTML = '';
        return;
    }

    const reversedExercises = [...todayData.exercises].reverse();

    exercisesList.innerHTML = reversedExercises.map(ex => `
        <div class="summary-card" style="padding: 12px 16px; margin-bottom: 8px; flex-direction: row; justify-content: space-between; align-items: center; border-left: 4px solid var(--protein);">
            <div style="flex: 1; padding-right: 12px;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600;">${ex.name}</h4>
            </div>
            <div style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center;">
                +${ex.calories} <small style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400; margin-left: 2px;">kcal</small>
                <button class="delete-exercise-btn" data-id="${ex.id}" title="Eliminar ejercicio" style="background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 4px; margin-left: 8px;">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Event Listeners
addMealBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('meal-name').focus();
});

closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

addMealForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newMeal = {
        name: document.getElementById('meal-name').value,
        calories: parseInt(document.getElementById('meal-cal').value) || 0,
        protein: parseInt(document.getElementById('meal-p').value) || 0,
        carbs: parseInt(document.getElementById('meal-c').value) || 0,
        fats: parseInt(document.getElementById('meal-f').value) || 0,
        id: Date.now()
    };

    // Update state
    const todayData = getSelectedDateData();
    todayData.meals.push(newMeal);
    todayData.consumed.calories += newMeal.calories;
    todayData.consumed.protein += newMeal.protein;
    todayData.consumed.carbs += newMeal.carbs;
    todayData.consumed.fats += newMeal.fats;

    // Save, update UI and close modal
    localStorage.setItem('macroTrackerState', JSON.stringify(state));
    updateUI();
    renderMeals();

    addMealForm.reset();
    modal.classList.remove('active');
});

// Delete Meal Listener (Event Delegation)
mealsList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-meal-btn');
    if (!deleteBtn) return;

    if (confirm('¿Estás seguro de que deseas eliminar esta comida?')) {
        const mealId = parseInt(deleteBtn.getAttribute('data-id'));
        const todayData = getSelectedDateData();

        // Find meal to subtract macros
        const mealIndex = todayData.meals.findIndex(m => m.id === mealId);
        if (mealIndex !== -1) {
            const meal = todayData.meals[mealIndex];
            todayData.consumed.calories = Math.max(0, todayData.consumed.calories - meal.calories);
            todayData.consumed.protein = Math.max(0, todayData.consumed.protein - meal.protein);
            todayData.consumed.carbs = Math.max(0, todayData.consumed.carbs - meal.carbs);
            todayData.consumed.fats = Math.max(0, todayData.consumed.fats - meal.fats);

            // Remove from array
            todayData.meals.splice(mealIndex, 1);

            localStorage.setItem('macroTrackerState', JSON.stringify(state));
            updateUI();
            renderMeals();
        }
    }
});

// Water Tracking Listeners
waterPlusBtn.addEventListener('click', () => {
    const data = getSelectedDateData();
    data.water = (data.water || 0) + 1;
    localStorage.setItem('macroTrackerState', JSON.stringify(state));
    updateUI();
});

waterMinusBtn.addEventListener('click', () => {
    const data = getSelectedDateData();
    if (data.water > 0) {
        data.water -= 1;
        localStorage.setItem('macroTrackerState', JSON.stringify(state));
        updateUI();
    }
});

// Text-based AI macro lookup
const searchMacrosBtn = document.getElementById('search-macros-btn');

searchMacrosBtn.addEventListener('click', async () => {
    const mealNameInput = document.getElementById('meal-name');
    const foodName = mealNameInput.value.trim();

    if (!foodName) {
        alert('Por favor, ingresa el nombre de un alimento primero.');
        return;
    }

    if (!state.settings || !state.settings.geminiApiKey) {
        alert('Por favor, configura tu API Key de Gemini en la pestaña de ajustes (⚙️).');
        return;
    }

    aiLoadingOverlay.querySelector('p').textContent = 'Buscando datos nutricionales...';
    aiLoadingOverlay.classList.remove('hidden');

    try {
        const apiKey = state.settings.geminiApiKey;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const promptText = `Actúa como un dietista clínico experto. Usando la base de datos de nutrición del Departamento de Agricultura de los Estados Unidos (USDA) como referencia principal, calcula de la forma más exacta y rigurosa posible los valores nutricionales precisos para: "${foodName}". 
Si no hay una cantidad especificada en la misma consulta, asume y calcula todo en base a 1 porción estándar promedio (ej. 100g, 1 taza, 1 unidad mediana). 
Devuelve ÚNICAMENTE un objeto JSON válido con las claves: "calories" (number), "protein" (number en gramos), "carbs" (number en gramos), "fats" (number en gramos). No devuelvas ningún texto extra, ni bloques de código formateados (sin \`\`\`json).`;

        const requestBody = {
            contents: [{
                parts: [{ text: promptText }]
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (!response.ok) {
            throw new Error(rawData.error?.message || 'Error en la llamada a la API');
        }

        const textResponse = rawData.candidates[0].content.parts[0].text;

        let aiResult;
        try {
            const cleanedText = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            aiResult = JSON.parse(cleanedText);
        } catch (jsonError) {
            console.error('Failed to parse JSON:', textResponse);
            throw new Error('No se pudo analizar el resultado de la IA.');
        }

        // Fill modal with AI results
        document.getElementById('meal-cal').value = aiResult.calories || 0;
        document.getElementById('meal-p').value = aiResult.protein || 0;
        document.getElementById('meal-c').value = aiResult.carbs || 0;
        document.getElementById('meal-f').value = aiResult.fats || 0;

    } catch (error) {
        alert(`Error al buscar los macros: ${error.message}`);
    } finally {
        aiLoadingOverlay.classList.add('hidden');
        aiLoadingOverlay.querySelector('p').textContent = 'Analizando imagen con Gemini...'; // Reset text
    }
});

// Exercise Logging Listener
exerciseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const exerciseDesc = exerciseDescInput.value.trim();

    if (!exerciseDesc) return;

    if (!state.settings || !state.settings.geminiApiKey) {
        alert('Por favor, configura tu API Key de Gemini en la pestaña de ajustes (⚙️) para calcular el ejercicio.');
        return;
    }

    if (!state.profile) {
        alert('Debes completar tu perfil (peso, edad, sexo) para que la IA calcule con precisión.');
        return;
    }

    // Set Loading State on Button
    const originalText = exerciseSubmitBtn.textContent;
    exerciseSubmitBtn.textContent = '...';
    exerciseSubmitBtn.disabled = true;

    try {
        const apiKey = state.settings.geminiApiKey;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const promptText = `Actuando como un fisiólogo del ejercicio. El usuario tiene el siguiente perfil:
- Peso: ${state.profile.weight} kg
- Edad: ${state.profile.age} años
- Sexo: ${state.profile.gender}
El usuario acaba de realizar la siguiente actividad física: "${exerciseDesc}". 
Considerando la información, calcula una estimación clínica de cuántas kilocalorías en total quemó durante esa sesión.
Devuelve ÚNICAMENTE un objeto JSON válido con la clave "burnedCalories" (number) indicando tu cálculo final. No devuelvas ningún texto extra, ni bloques de código formateados (sin \`\`\`json).`;

        const requestBody = {
            contents: [{
                parts: [{ text: promptText }]
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawData = await response.json();

        if (!response.ok) {
            throw new Error(rawData.error?.message || 'Error en la llamada a la API');
        }

        const textResponse = rawData.candidates[0].content.parts[0].text;

        let aiResult;
        try {
            const cleanedText = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            aiResult = JSON.parse(cleanedText);
        } catch (jsonError) {
            console.error('Failed to parse JSON:', textResponse);
            throw new Error('No se pudo analizar el resultado de la IA.');
        }

        const burnedInput = parseInt(aiResult.burnedCalories) || 0;

        if (burnedInput > 0) {
            const todayData = getSelectedDateData();

            // Build the exercise record
            const newExercise = {
                id: Date.now(),
                name: exerciseDesc,
                calories: burnedInput
            };

            todayData.exercises.push(newExercise);
            todayData.burnedCalories += burnedInput;
            localStorage.setItem('macroTrackerState', JSON.stringify(state));
            updateUI();
            renderExercises();
            exerciseForm.reset();

            exerciseSubmitBtn.textContent = `+${burnedInput} kcal`;
            setTimeout(() => {
                exerciseSubmitBtn.textContent = originalText;
                exerciseSubmitBtn.disabled = false;
            }, 3000);
        } else {
            exerciseSubmitBtn.textContent = '0 kcal';
            setTimeout(() => {
                exerciseSubmitBtn.textContent = originalText;
                exerciseSubmitBtn.disabled = false;
            }, 2000);
        }

    } catch (error) {
        alert(`Error al calcular el ejercicio: ${error.message}`);
        exerciseSubmitBtn.textContent = originalText;
        exerciseSubmitBtn.disabled = false;
    }
});

// Delete Exercise Listener (Event Delegation)
if (exercisesList) {
    exercisesList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-exercise-btn');
        if (!deleteBtn) return;

        if (confirm('¿Estás seguro de que deseas eliminar este ejercicio? Se restarán sus calorías de tu reembolso.')) {
            const exId = parseInt(deleteBtn.getAttribute('data-id'));
            const todayData = getSelectedDateData();

            const exIndex = todayData.exercises.findIndex(x => x.id === exId);
            if (exIndex !== -1) {
                const ex = todayData.exercises[exIndex];

                // Subtract from running total
                todayData.burnedCalories = Math.max(0, todayData.burnedCalories - ex.calories);

                // Remove from array
                todayData.exercises.splice(exIndex, 1);

                // Save and re-render everything
                localStorage.setItem('macroTrackerState', JSON.stringify(state));
                updateUI();
                renderExercises();
            }
        }
    });
}

initializeView();
console.log('MacroTracker initialized!');
