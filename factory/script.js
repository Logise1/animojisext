
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DECODIFICAR USUARIO ---
const urlParams = new URLSearchParams(window.location.search);
let rawUser = urlParams.get('user') || urlParams.get('username');

// Auto-detección móvil y LocalStorage
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (!rawUser && localStorage.getItem('factory_user')) {
    rawUser = localStorage.getItem('factory_user');
    window.history.replaceState({}, '', window.location.pathname + "?user=" + rawUser);
}

let playerName = "Jugador Anonimo";
if (rawUser) {
    try {
        let decoded = atob(rawUser);
        playerName = decoded.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        localStorage.setItem('factory_user', rawUser);
    } catch (e) { console.warn("Error decodificando nombre", e); }
} else if (isMobile) {
    // Si es móvil y no hay usuario, forzar login QR (implementado abajo)
}

// Auto-detección móvil
if (isMobile) {
    // Podríamos añadir clases específicas si fuera necesario
}

document.getElementById('playerNameDisplay').innerText = playerName;

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAcMBMfWjiD4NHArV8lMWm7peIsyUKCW-w",
    authDomain: "growagarden-880f6.firebaseapp.com",
    projectId: "growagarden-880f6",
    storageBucket: "growagarden-880f6.firebasestorage.app",
    messagingSenderId: "179827921380",
    appId: "1:179827921380:web:512a931fa3ca411723b7f1",
    measurementId: "G-XTW0SDGGH1"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-factory-id';
let currentUser = null;

// --- CONSTANTES ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE_SIZE = 64;
const BASE_ITEM_SPEED = 2.5;

// --- MATERIALES (Visuales y Valor Base) ---
const MATS = {
    'ore_iron': { name: 'Min. Hierro', color: '#9ca3af', shape: 'arc', value: 5, sprite: 'ore_iron' },
    'ore_copper': { name: 'Min. Cobre', color: '#b45309', shape: 'arc', value: 6, sprite: 'ore_copper' },
    'ore_gold': { name: 'Min. Oro', color: '#fbbf24', shape: 'arc', value: 15, sprite: 'ore_gold' },
    'ore_aluminum': { name: 'Min. Aluminio', color: '#cbd5e1', shape: 'arc', value: 10, sprite: 'ore_aluminum' },
    'ore_silicon': { name: 'Silicio', color: '#14b8a6', shape: 'arc', value: 12, sprite: 'ore_silicon' },
    'ore_diamond': { name: 'Diamante', color: '#67e8f9', shape: 'arc', value: 100, sprite: 'ore_diamond' },

    'ingot_iron': { name: 'Lingote Hierro', color: '#e5e7eb', shape: 'rect', value: 15, sprite: 'ingot_iron' },
    'ingot_copper': { name: 'Lingote Cobre', color: '#d97706', shape: 'rect', value: 18, sprite: 'ingot_copper' },
    'ingot_gold': { name: 'Lingote Oro', color: '#fcd34d', shape: 'rect', value: 45, sprite: 'ingot_gold' },
    'ingot_aluminum': { name: 'Lingote Aluminio', color: '#f1f5f9', shape: 'rect', value: 30, sprite: 'ingot_aluminum' },
    'wafer_silicon': { name: 'Oblea Silicio', color: '#2dd4bf', shape: 'rect', value: 40, sprite: 'wafer_silicon' },

    'wire': { name: 'Cable', color: '#f59e0b', shape: 'coil', value: 25, sprite: 'wire' },
    'plate': { name: 'Placa Metálica', color: '#6b7280', shape: 'plate', value: 40, sprite: 'plate' },
    'gear': { name: 'Engranaje', color: '#4b5563', shape: 'gear', value: 70, sprite: 'gear' },
    'pipe': { name: 'Tubería', color: '#94a3b8', shape: 'pipe', value: 50, sprite: 'pipe' },

    'circuit': { name: 'Circuito', color: '#10b981', shape: 'chip', value: 250, sprite: 'circuit' },
    'processor': { name: 'Procesador', color: '#3b82f6', shape: 'chip', value: 1000, sprite: 'processor' },
    'motor': { name: 'Motor', color: '#ef4444', shape: 'cylinder', value: 500, sprite: 'motor' },
    'battery': { name: 'Batería', color: '#a855f7', shape: 'cylinder', value: 400, sprite: 'battery' },
    'supercomputer': { name: 'Superordenador', color: '#ec4899', shape: 'chip', value: 5000, sprite: 'supercomputer' },
    'quantum_chip': { name: 'Chip Cuántico', color: '#06b6d4', shape: 'chip', value: 10000, sprite: 'quantum_chip' },

    'tank_water': { name: 'Tanque de Agua', color: '#3b82f6', shape: 'cylinder', value: 120, sprite: 'tank_water' },
    'tank_chemical': { name: 'Químicos Industriales', color: '#10b981', shape: 'cylinder', value: 350, sprite: 'tank_chemical' },

    'cristal_cuantico': { name: 'Cristal Cuántico', color: '#a78bfa', shape: 'arc', value: 50000, sprite: 'quantic/cristal_cuantico' },
    'lingote_cuantico': { name: 'Lingote Cuántico', color: '#c084fc', shape: 'rect', value: 200000, sprite: 'quantic/lingote_cuantico' },
    'chip_cuantico_reforzado': { name: 'Chip Cuántico Reforzado', color: '#818cf8', shape: 'chip', value: 1000000, sprite: 'quantic/chip_cuantico_reforzado' },
    'disco_cuantico': { name: 'Disco Cuántico', color: '#6366f1', shape: 'plate', value: 5000000, sprite: 'quantic/disco_cuantico' },
    'agujero_cuantico': { name: 'Agujero Cuántico', color: '#312e81', shape: 'arc', value: 50000000, sprite: 'quantic/agujero_cuantico' }
};

// --- SPRITES ---
const SPRITES = {};
const spriteNames = [
    'assembler_advanced', 'assembler_basic', 'assembler_mega', 'battery',
    'belt_corner_1', 'belt_corner_2', 'belt_cross', 'belt_horizontal', 'belt_vertical',
    'chest_gold', 'chest_iron', 'chest_wood', 'circuit', 'furnace_industrial',
    'furnace_iron', 'furnace_iron_on', 'furnace_mega', 'furnace_stone', 'furnace_stone_on',
    'gear', 'ingot_aluminum', 'ingot_copper', 'ingot_gold', 'ingot_iron',
    'miner_basic', 'miner_drill', 'motor', 'ore_aluminum', 'ore_copper', 'ore_diamond',
    'ore_gold', 'ore_iron', 'ore_silicon', 'pipe', 'plate', 'processor', 'quantum_chip',
    'splitter_down', 'splitter_up', 'supercomputer', 'tank_chemical', 'tank_water',
    'wafer_silicon', 'wire',
    'quantic/cristal_cuantico', 'quantic/lingote_cuantico', 'quantic/chip_cuantico_reforzado',
    'quantic/disco_cuantico', 'quantic/generador_cuantico', 'quantic/agujero_cuantico'
];

let spritesLoaded = 0;
spriteNames.forEach(name => {
    const img = new Image();
    img.src = `textures/factory/${name}.png`;
    img.onload = () => {
        spritesLoaded++;
        SPRITES[name] = img;
    };
});

// --- RECETAS PROGRESIVAS ---
const RECIPES = {
    // HORNOS
    'smelt_iron': { name: 'Fundir Hierro', in: { 'ore_iron': 1 }, out: 'ingot_iron', time: 1.5, type: 'smelter', cost: 0, cat: 'Fundición' },
    'smelt_copper': { name: 'Fundir Cobre', in: { 'ore_copper': 1 }, out: 'ingot_copper', time: 1.5, type: 'smelter', cost: 0, cat: 'Fundición' },
    'smelt_gold': { name: 'Fundir Oro', in: { 'ore_gold': 1 }, out: 'ingot_gold', time: 2.0, type: 'smelter', cost: 300, cat: 'Fundición Avanzada' },
    'smelt_aluminum': { name: 'Fundir Aluminio', in: { 'ore_aluminum': 1 }, out: 'ingot_aluminum', time: 2.0, type: 'smelter', cost: 400, cat: 'Fundición Avanzada' },
    'smelt_silicon': { name: 'Obleas de Silicio', in: { 'ore_silicon': 2 }, out: 'wafer_silicon', time: 3.0, type: 'smelter', cost: 800, cat: 'Alta Tecnología' },

    // ENSAMBLADORES
    'craft_wire': { name: 'Cable de Cobre', in: { 'ingot_copper': 1 }, out: 'wire', time: 1.0, type: 'crafter', cost: 100, cat: 'Componentes Básicos' },
    'craft_plate': { name: 'Placa de Hierro', in: { 'ingot_iron': 2 }, out: 'plate', time: 1.5, type: 'crafter', cost: 150, cat: 'Componentes Básicos' },
    'craft_pipe': { name: 'Tubería', in: { 'ingot_aluminum': 1 }, out: 'pipe', time: 1.5, type: 'crafter', cost: 400, cat: 'Mecánica' },
    'craft_gear': { name: 'Engranaje', in: { 'ingot_iron': 1, 'plate': 1 }, out: 'gear', time: 2.0, type: 'crafter', cost: 300, cat: 'Mecánica' },

    'craft_circuit': { name: 'Circuito Básico', in: { 'wire': 2, 'plate': 1 }, out: 'circuit', time: 2.5, type: 'crafter', cost: 800, cat: 'Electrónica' },
    'craft_battery': { name: 'Batería', in: { 'wire': 2, 'tank_chemical': 1 }, out: 'battery', time: 3.0, type: 'crafter', cost: 1200, cat: 'Electrónica' },
    'craft_motor': { name: 'Motor Industrial', in: { 'gear': 2, 'wire': 3, 'pipe': 1 }, out: 'motor', time: 3.5, type: 'crafter', cost: 2500, cat: 'Mecánica Avanzada' },

    'craft_processor': { name: 'Procesador', in: { 'circuit': 2, 'wafer_silicon': 1, 'ingot_gold': 1 }, out: 'processor', time: 8.0, type: 'crafter', cost: 10000, cat: 'Alta Tecnología' },
    'craft_supercomp': { name: 'Superordenador', in: { 'processor': 2, 'motor': 1, 'battery': 2 }, out: 'supercomputer', time: 15.0, type: 'crafter', cost: 50000, cat: 'Alta Tecnología' },
    'craft_quantum': { name: 'Chip Cuántico', in: { 'processor': 4, 'ore_diamond': 2, 'wafer_silicon': 2 }, out: 'quantum_chip', time: 45.0, type: 'crafter', cost: 500000, cat: 'Futurista' },

    // QUÍMICA
    'craft_water': { name: 'Embotelladora (Agua)', in: { 'pipe': 1, 'plate': 1 }, out: 'tank_water', time: 2.0, type: 'crafter', cost: 800, cat: 'Química Básica' },
    'craft_chemical': { name: 'Síntesis Química', in: { 'tank_water': 1, 'ore_aluminum': 2 }, out: 'tank_chemical', time: 4.0, type: 'crafter', cost: 2500, cat: 'Química Avanzada' },

    'smelt_cristal_cuantico': { name: 'Cristal Cuántico', in: { 'ore_diamond': 3, 'wafer_silicon': 2, 'quantum_chip': 1 }, out: 'cristal_cuantico', time: 30.0, type: 'smelter', cost: 3000000, cat: 'Fundición Cuántica' },
    'smelt_lingote_cuantico': { name: 'Lingote Cuántico', in: { 'cristal_cuantico': 2, 'quantum_chip': 2 }, out: 'lingote_cuantico', time: 60.0, type: 'smelter', cost: 10000000, cat: 'Fundición Cuántica' },

    'craft_chip_reforzado': { name: 'Chip Cuántico Reforzado', in: { 'quantum_chip': 3, 'lingote_cuantico': 2, 'processor': 1 }, out: 'chip_cuantico_reforzado', time: 120.0, type: 'crafter', cost: 35000000, cat: 'Tecnología Cuántica' },
    'craft_disco_cuantico': { name: 'Disco Cuántico', in: { 'chip_cuantico_reforzado': 2, 'cristal_cuantico': 3, 'supercomputer': 1 }, out: 'disco_cuantico', time: 300.0, type: 'crafter', cost: 100000000, cat: 'Tecnología Cuántica' },
    'craft_agujero_cuantico': { name: 'Agujero Cuántico', in: { 'disco_cuantico': 3, 'chip_cuantico_reforzado': 5, 'lingote_cuantico': 10 }, out: 'agujero_cuantico', time: 900.0, type: 'crafter', cost: 300000000, cat: 'Singularidad' }
};

const BUILDINGS = {
    conveyor: { cost: 10, name: 'Cinta Transportadora' },
    generator: { cost: 50, name: 'Minero / Generador' },
    seller: { cost: 50, name: 'Vendedor' },
    splitter2: { cost: 150, name: 'Divisor Doble (1 a 2)', shop: true, info: 'Alterna items hacia su izquierda y derecha.' },
    splitter3: { cost: 300, name: 'Divisor Triple (1 a 3)', shop: true, info: 'Alterna items hacia izq, frente y derecha.' },
    smelter: { cost: 200, name: 'Horno de Fundición', shop: true, info: 'Funde minerales en lingotes.' },
    crafter: { cost: 500, name: 'Ensamblador', shop: true, info: 'Combina items para crear objetos avanzados.' },
    merger: { cost: 200, name: 'Fusionador (2 a 1)', shop: true, info: 'Fusiona 2 líneas en 1. Acepta items por los lados y los empuja al frente.' },
    smart_splitter: { cost: 1000, name: 'Divisor Inteligente', shop: true, info: 'Filtra materiales específicos hacia la izquierda, frente o derecha.' }
};

const DIRECTIONS = [
    { dx: 0, dy: -1, angle: -Math.PI / 2 }, // 0: Arriba
    { dx: 1, dy: 0, angle: 0 },            // 1: Derecha
    { dx: 0, dy: 1, angle: Math.PI / 2 },  // 2: Abajo
    { dx: -1, dy: 0, angle: Math.PI }       // 3: Izquierda
];

// --- GENERACIÓN PROCEDURAL DE MENAS ---
function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return h;
}

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const WORLD_SEED = hashSeed("Antigravity");

// Ore deposit colors for ground tiles
const ORE_DEPOSIT_INFO = {
    'ore_gold': { name: 'Veta de Oro', tint: 'rgba(251, 191, 36, 0.25)', border: 'rgba(251, 191, 36, 0.5)', sprite: 'ore_gold' },
    'ore_aluminum': { name: 'Veta de Aluminio', tint: 'rgba(203, 213, 225, 0.25)', border: 'rgba(203, 213, 225, 0.5)', sprite: 'ore_aluminum' },
    'ore_silicon': { name: 'Veta de Silicio', tint: 'rgba(20, 184, 166, 0.25)', border: 'rgba(20, 184, 166, 0.5)', sprite: 'ore_silicon' },
    'ore_diamond': { name: 'Veta de Diamante', tint: 'rgba(103, 232, 249, 0.25)', border: 'rgba(103, 232, 249, 0.5)', sprite: 'ore_diamond' }
};

function getTileRNG(x, y) {
    const tileSeed = WORLD_SEED ^ (x * 374761393 + y * 668265263 + x * y * 1013904223);
    return mulberry32(tileSeed)();
}

function getOreDeposit(x, y) {
    const val = getTileRNG(x, y);

    // Lógica de Diamantes: Más frecuentes (antes 0.5%) pero con espaciado mínimo de 3 bloques (distancia 4).
    // Para garantizar el espaciado y la aleatoriedad, solo spawnear si es el máximo local en un radio de 3.
    if (val > 0.95) { // Threshold alto para asegurar que sean diamantes "especiales"
        let isLocalMax = true;
        const radius = 3;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (getTileRNG(x + dx, y + dy) > val) {
                    isLocalMax = false;
                    break;
                }
            }
            if (!isLocalMax) break;
        }
        if (isLocalMax) return 'ore_diamond';
    }

    // Probabilidades ajustadas para el resto: Oro 2%, Silicio 3%, Aluminio 5% (sobre el val base)
    if (val < 0.02) return 'ore_gold';
    if (val < 0.05) return 'ore_silicon';
    if (val < 0.10) return 'ore_aluminum';
    return null;
}

// --- ESTADO DEL JUEGO ---
let state = {
    money: 400,
    gridSize: 5,
    maxGenerators: 3, // Límite inicial
    map: {}, // key: "x,y", value: { type, dir, config, inventory, outBuffer, timer, splitIndex }
    items: [],
    unlockedRecipes: ['smelt_iron', 'smelt_copper'],
    unlockedBuildings: ['conveyor', 'generator', 'seller'],
    tool: 'cursor',
    buildDir: 1,
    isPaused: false,
    showBottlenecks: false,
    backups: [], // Historial de copias de seguridad
    lastBackupTime: Date.now()
};

let selectedTile = null;
let isDraggingPan = false;
let isDraggingBuild = false;
let lastBuiltGrid = null;
let camera = { x: 0, y: 0, zoom: 1 };
let lastSaveTime = 0;
let earningsLog = [];

function logEarning(amount) {
    earningsLog.push({ time: Date.now(), amount });
    const cutoff = Date.now() - 60000;
    earningsLog = earningsLog.filter(e => e.time > cutoff);
}

function getEarningsRate() {
    const now = Date.now();
    const last10s = earningsLog.filter(e => e.time > now - 10000).reduce((s, e) => s + e.amount, 0);
    const last60s = earningsLog.filter(e => e.time > now - 60000).reduce((s, e) => s + e.amount, 0);
    return { per10s: last10s, perMin: last60s };
}

// Funciones Auxiliares
function countGenerators() {
    let count = 0;
    for (let k in state.map) if (state.map[k].type === 'generator') count++;
    return count;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 3000);
}

// --- FIREBASE INICIALIZACIÓN ---
const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
                await signInWithCustomToken(auth, __initial_auth_token);
            } catch (tokenError) {
                console.warn("Token mismatch, usando Auth Anónimo para permitir guardado.", tokenError);
                await signInAnonymously(auth);
            }
        } else {
            await signInAnonymously(auth);
        }
    } catch (e) {
        console.error("Auth error", e);
        document.getElementById('saveStatus').innerText = "Error Auth";
    }
};

initAuth();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadGameFromCloud();
        setupLeaderboardListener();
    }
});



async function saveGameToCloud() {
    if (!currentUser) return;

    try {
        const saveRef = doc(db, 'artifacts', currentAppId, 'public', 'data', 'saves', playerName);
        const mapObj = {};
        for (let [k, v] of Object.entries(state.map)) mapObj[k] = { ...v };

        await setDoc(saveRef, {
            name: playerName,
            money: state.money,
            gridSize: state.gridSize,
            maxGenerators: state.maxGenerators,
            map: mapObj,
            unlockedRecipes: state.unlockedRecipes,
            unlockedBuildings: state.unlockedBuildings,
            backups: state.backups, // Guardar backups en la nube también
            timestamp: Date.now()
        });
        document.getElementById('saveStatus').innerText = "Guardado ✅";
        setTimeout(() => document.getElementById('saveStatus').innerText = "", 2000);
    } catch (e) { console.error("Error saving:", e); }
}

async function loadGameFromCloud() {
    if (!currentUser) return;
    try {
        document.getElementById('saveStatus').innerText = "Cargando...";
        const saveRef = doc(db, 'artifacts', currentAppId, 'public', 'data', 'saves', playerName);
        const docSnap = await getDoc(saveRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            state.money = data.money;
            state.gridSize = data.gridSize || 5;
            state.maxGenerators = data.maxGenerators || 3;
            state.map = data.map || {};
            state.unlockedRecipes = data.unlockedRecipes || ['smelt_iron', 'smelt_copper'];
            state.unlockedBuildings = data.unlockedBuildings || ['conveyor', 'generator', 'seller'];
            state.backups = data.backups || [];
            state.items = [];
        }
        updateUI();
        document.getElementById('saveStatus').innerText = "Cargado ✅";
        setTimeout(() => document.getElementById('saveStatus').innerText = "", 2000);
    } catch (e) { console.error("Error loading:", e); }
}

function setupLeaderboardListener() {
    const savesRef = collection(db, 'artifacts', currentAppId, 'public', 'data', 'saves');
    onSnapshot(savesRef, (snapshot) => {
        let allSaves = [];
        snapshot.forEach(doc => allSaves.push(doc.data()));
        allSaves.sort((a, b) => b.money - a.money);

        const lbContainer = document.getElementById('leaderboardContent');
        lbContainer.innerHTML = '';

        if (allSaves.length === 0) {
            lbContainer.innerHTML = '<div class="text-center text-gray-400 mt-10">Aún no hay jugadores registrados.</div>';
            return;
        }

        allSaves.slice(0, 50).forEach((save, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = `<span class="text-gray-500 w-6 inline-block text-center">${index + 1}</span>`;

            const isMe = save.name === playerName;
            const row = document.createElement('div');
            row.className = `flex justify-between items-center p-3 mb-2 rounded-lg border ${isMe ? 'bg-yellow-900/40 border-yellow-500' : 'bg-gray-800 border-gray-700'}`;
            row.innerHTML = `
                        <div class="flex items-center gap-3 font-bold text-lg">
                            ${medal} <span class="${isMe ? 'text-yellow-400' : 'text-gray-200'}">${save.name}</span>
                        </div>
                        <div class="text-green-400 font-mono font-bold text-xl">$${save.money.toLocaleString()}</div>
                    `;
            lbContainer.appendChild(row);
        });
    }, (error) => console.error(error));
}

setInterval(() => {
    if (Date.now() - lastSaveTime > 5000) {
        saveGameToCloud();
        lastSaveTime = Date.now();
    }
    // Backup cada 5 minutos
    if (!state.lastBackupTime) state.lastBackupTime = Date.now();
    if (Date.now() - state.lastBackupTime > 300000) {
        createBackup();
        state.lastBackupTime = Date.now();
    }
}, 5000);

window.createBackup = function() {
    const snapshot = {
        money: state.money,
        gridSize: state.gridSize,
        maxGenerators: state.maxGenerators,
        map: JSON.parse(JSON.stringify(state.map)),
        unlockedRecipes: [...state.unlockedRecipes],
        unlockedBuildings: [...state.unlockedBuildings],
        time: Date.now()
    };
    
    state.backups.unshift(snapshot);
    if (state.backups.length > 6) state.backups.pop(); // Max 6 backups (30 min)
    saveGameToCloud();
    console.log("Backup creado");
    
    // Si el modal está abierto, refrescar la lista
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && !settingsModal.classList.contains('hidden')) {
        renderBackups();
    }
    showToast("¡Copia de seguridad creada!");
};

window.toggleSettings = function () {
    const el = document.getElementById('settingsModal');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) renderBackups();
};

function renderBackups() {
    const container = document.getElementById('backupsList');
    container.innerHTML = '';
    
    if (state.backups.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 italic py-8 border-2 border-dashed border-gray-800 rounded-xl">No hay backups disponibles aún...</div>';
        return;
    }

    state.backups.forEach((b, i) => {
        const date = new Date(b.time);
        const diff = Math.round((Date.now() - b.time) / 60000);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const div = document.createElement('div');
        div.className = "bg-gray-800 border border-gray-700 p-4 rounded-xl flex justify-between items-center hover:border-blue-500 transition-colors group";
        div.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-200">${timeStr}</span>
                    <span class="text-[10px] bg-gray-900 px-2 py-0.5 rounded text-gray-400">Hace ${diff} min</span>
                </div>
                <div class="text-xs text-green-400 font-mono mt-1">$${b.money.toLocaleString()} | ${b.gridSize}x${b.gridSize}</div>
            </div>
            <button onclick="window.restoreBackup(${i})" class="bg-blue-600 hover:bg-blue-500 group-hover:scale-105 transition-all px-4 py-2 rounded-lg font-bold text-xs shadow-lg text-white">
                Restaurar
            </button>
        `;
        container.appendChild(div);
    });
}

window.restoreBackup = function(index) {
    if (!confirm("¿Estás seguro de que quieres restaurar este backup? Perderás el progreso actual desde esa hora.")) return;
    
    const b = state.backups[index];
    state.money = b.money;
    state.gridSize = b.gridSize;
    state.maxGenerators = b.maxGenerators;
    state.map = JSON.parse(JSON.stringify(b.map));
    state.unlockedRecipes = [...b.unlockedRecipes];
    state.unlockedBuildings = [...b.unlockedBuildings];
    state.items = []; // Limpiar items sueltos para evitar inconsistencias
    
    updateUI();
    saveGameToCloud();
    window.toggleSettings();
    showToast("¡Backup restaurado con éxito!");
};

window.togglePause = function () {
    state.isPaused = !state.isPaused;
    const btn = document.getElementById('btnPause');
    const icon = document.getElementById('pauseIcon');
    const text = document.getElementById('pauseText');

    if (state.isPaused) {
        btn.classList.replace('bg-blue-600/90', 'bg-orange-600/90');
        btn.classList.replace('border-blue-400', 'border-orange-400');
        icon.src = 'textures/factory/playbtn.png';
    } else {
        btn.classList.replace('bg-orange-600/90', 'bg-blue-600/90');
        btn.classList.replace('border-orange-400', 'border-blue-400');
        icon.src = 'textures/factory/pausebtn.png';
    }
};

window.toggleBottlenecks = function () {
    state.showBottlenecks = !state.showBottlenecks;
    const btn = document.getElementById('btnBottlenecks');
    if (state.showBottlenecks) {
        btn.classList.replace('bg-gray-600/80', 'bg-red-600/90');
        btn.classList.replace('border-gray-400', 'border-red-400');
        showToast("Visualización de cuellos de botella activada");
    } else {
        btn.classList.replace('bg-red-600/90', 'bg-gray-600/80');
        btn.classList.replace('border-red-400', 'border-gray-400');
        showToast("Visualización de cuellos de botella desactivada");
    }
};

window.clearAllItems = function () {
    state.items = [];
    showToast("¡Todos los items eliminados!");
};

// --- SISTEMA UI DEL JUEGO ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false; // Pixel Perfect rendering
    if (camera.x === 0 && camera.y === 0) {
        camera.x = (state.gridSize * TILE_SIZE) / 2;
        camera.y = (state.gridSize * TILE_SIZE) / 2;
    }
}
window.addEventListener('resize', resize);
resize();

window.toggleShop = function () {
    const el = document.getElementById('shopModal');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) shopTab('buildings');
};

window.toggleLeaderboard = function () {
    const el = document.getElementById('leaderboardModal');
    el.classList.toggle('hidden');
};

window.shopTab = function (tab) {
    document.getElementById('shopMoney').innerText = state.money.toLocaleString();
    const content = document.getElementById('shopContent');

    document.getElementById('tab-buildings').className = `px-4 py-2 rounded-lg font-bold shadow ${tab === 'buildings' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`;
    document.getElementById('tab-recipes').className = `px-4 py-2 rounded-lg font-bold shadow ${tab === 'recipes' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`;

    content.innerHTML = '';

    if (tab === 'buildings') {
        const upgCost = Math.floor(500 * Math.pow(1.6, state.maxGenerators - 3));
        const mapUpgCost = Math.floor(Math.pow(state.gridSize, 2) * 200);

        const upgContainer = document.createElement('div');
        upgContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6";

        // Tarjeta Mineros
        const genDiv = document.createElement('div');
        genDiv.className = "bg-indigo-900/40 p-4 rounded-xl border border-indigo-500 flex flex-col justify-between shadow-[0_0_15px_rgba(99,102,241,0.2)]";
        genDiv.innerHTML = `
                    <div class="mb-3">
                        <h3 class="text-xl font-bold text-indigo-300">📈 Expandir Límite de Mineros (+1)</h3>
                        <p class="text-sm text-indigo-200/70 mt-1">Aumenta la cantidad máxima de generadores que puedes tener simultáneamente.</p>
                        <p class="text-xs text-white mt-2 bg-indigo-950/50 inline-block px-2 py-1 rounded">Límite actual: ${state.maxGenerators}</p>
                    </div>
                    <button onclick="buyGenLimit()" class="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg font-bold shadow text-white transition whitespace-nowrap">$${upgCost.toLocaleString()}</button>
                `;

        // Tarjeta Mapa
        const mapDiv = document.createElement('div');
        mapDiv.className = "bg-emerald-900/40 p-4 rounded-xl border border-emerald-500 flex flex-col justify-between shadow-[0_0_15px_rgba(16,185,129,0.2)]";
        mapDiv.innerHTML = `
                    <div class="mb-3">
                        <h3 class="text-xl font-bold text-emerald-300">🗺️ Expandir Terreno (+1)</h3>
                        <p class="text-sm text-emerald-200/70 mt-1">Aumenta el tamaño del mapa de la fábrica añadiendo una fila y una columna nueva.</p>
                        <p class="text-xs text-white mt-2 bg-emerald-950/50 inline-block px-2 py-1 rounded">Tamaño actual: ${state.gridSize}x${state.gridSize}</p>
                    </div>
                    <button onclick="buyMapSize()" class="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg font-bold shadow text-white transition whitespace-nowrap">$${mapUpgCost.toLocaleString()}</button>
                `;

        upgContainer.appendChild(genDiv);
        upgContainer.appendChild(mapDiv);
        content.appendChild(upgContainer);

        // Edificios normales
        for (let key in BUILDINGS) {
            if (BUILDINGS[key].shop) {
                const isOwned = state.unlockedBuildings.includes(key);
                let spriteKey = 'belt_horizontal';
                if (key === 'splitter2') spriteKey = 'splitter_down';
                if (key === 'splitter3') spriteKey = 'splitter_up';
                if (key === 'smelter') spriteKey = 'furnace_iron';
                if (key === 'crafter') spriteKey = 'assembler_basic';
                if (key === 'merger') spriteKey = 'splitter_down';
                if (key === 'quantum_generator') spriteKey = 'quantic/generador_cuantico';

                const div = document.createElement('div');
                div.className = "bg-gray-800 p-4 rounded-xl border border-gray-700 mb-3 flex justify-between items-center";
                div.innerHTML = `
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-700">
                                    <img src="textures/factory/${spriteKey}.png" class="w-10 h-10 object-contain">
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-white">${BUILDINGS[key].name}</h3>
                                    <p class="text-sm text-gray-400">${BUILDINGS[key].info}</p>
                                </div>
                            </div>
                            ${isOwned ?
                        `<span class="text-green-400 font-bold bg-green-900/30 px-3 py-1 rounded">Comprado</span>` :
                        `<button onclick="buyBuilding('${key}')" class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold shadow text-white transition">$${BUILDINGS[key].cost}</button>`
                    }
                        `;
                content.appendChild(div);
            }
        }
    } else {
        // Recetas con cálculo de beneficio neto
        const categories = {};
        for (let key in RECIPES) {
            let cat = RECIPES[key].cat;
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ id: key, ...RECIPES[key] });
        }

        for (let cat in categories) {
            const title = document.createElement('h3');
            title.className = "text-xl font-bold text-purple-300 mt-6 mb-3 border-b border-purple-900 pb-1";
            title.innerText = cat;
            content.appendChild(title);

            const grid = document.createElement('div');
            grid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";

            categories[cat].forEach(rec => {
                const isOwned = state.unlockedRecipes.includes(rec.id);
                const outMat = MATS[rec.out];
                const inStr = Object.entries(rec.in).map(([k, v]) => `${v}x ${MATS[k].name}`).join(' + ');

                // Calcular rentabilidad
                const outValue = outMat.value;
                let inValue = 0;
                for (let k in rec.in) inValue += MATS[k].value * rec.in[k];
                const profit = outValue - inValue;
                const profitStr = profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`;
                const profitClass = profit >= 0 ? 'bg-green-900/40 text-green-400 border-green-800' : 'bg-red-900/40 text-red-500 border-red-800';

                const div = document.createElement('div');
                div.className = "bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between";
                div.innerHTML = `
                            <div class="mb-3">
                                <div class="flex justify-between items-start">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-700">
                                            <img src="textures/factory/${outMat.sprite}.png" class="w-8 h-8 object-contain">
                                        </div>
                                        <h4 class="font-bold text-white text-lg">${rec.name}</h4>
                                    </div>
                                    <span class="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">${rec.type === 'smelter' ? 'Horno' : 'Ensamblador'}</span>
                                </div>
                                <p class="text-xs text-orange-300 mt-2">Requiere: ${inStr}</p>
                                <div class="mt-2 flex gap-2 text-xs">
                                    <span class="bg-gray-900 px-2 py-1 rounded border border-gray-600">Venta final: $${outValue}</span>
                                    <span class="${profitClass} font-bold px-2 py-1 rounded border">Beneficio Neto: ${profitStr}</span>
                                </div>
                            </div>
                            <div class="text-right mt-2">
                                ${isOwned ?
                        `<span class="text-green-400 font-bold text-sm bg-green-900/30 px-3 py-1 rounded">Desbloqueado</span>` :
                        `<button onclick="buyRecipe('${rec.id}')" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold shadow text-sm text-white w-full transition">$${rec.cost.toLocaleString()}</button>`
                    }
                            </div>
                        `;
                grid.appendChild(div);
            });
            content.appendChild(grid);
        }
    }
};

window.buyGenLimit = function () {
    const cost = Math.floor(500 * Math.pow(1.6, state.maxGenerators - 3));
    if (state.money >= cost) {
        state.money -= cost;
        state.maxGenerators++;
        shopTab('buildings');
        updateUI();
        saveGameToCloud();
        showToast("¡Límite de mineros ampliado!");
    } else {
        showToast("No tienes suficiente dinero.");
    }
};

window.buyMapSize = function () {
    const cost = Math.floor(Math.pow(state.gridSize, 2) * 200);
    if (state.money >= cost) {
        state.money -= cost;
        state.gridSize++;
        shopTab('buildings');
        updateUI();
        saveGameToCloud();
        showToast("¡Terreno expandido!");
    } else {
        showToast("No tienes suficiente dinero.");
    }
};

window.buyBuilding = function (key) {
    const cost = BUILDINGS[key].cost;
    if (state.money >= cost && !state.unlockedBuildings.includes(key)) {
        state.money -= cost;
        state.unlockedBuildings.push(key);
        shopTab('buildings');
        updateUI();
        saveGameToCloud();
    }
};

window.buyRecipe = function (key) {
    const cost = RECIPES[key].cost;
    if (state.money >= cost && !state.unlockedRecipes.includes(key)) {
        state.money -= cost;
        state.unlockedRecipes.push(key);
        shopTab('recipes');
        updateUI();
        saveGameToCloud();
    }
};

let smoothEarnings10s = 0;
let smoothEarningsMin = 0;

function updateEarningsDisplay() {
    const rates = getEarningsRate();
    const smooth = 8;
    smoothEarnings10s += (rates.per10s - smoothEarnings10s) / smooth;
    smoothEarningsMin += (rates.perMin - smoothEarningsMin) / smooth;
    // Snap to target if very close to avoid floating forever
    if (Math.abs(rates.per10s - smoothEarnings10s) < 0.5) smoothEarnings10s = rates.per10s;
    if (Math.abs(rates.perMin - smoothEarningsMin) < 0.5) smoothEarningsMin = rates.perMin;
    const el10s = document.getElementById('earnings10s');
    const elMin = document.getElementById('earningsPerMin');
    if (el10s) el10s.innerText = '$' + Math.round(smoothEarnings10s).toLocaleString();
    if (elMin) elMin.innerText = '$' + Math.round(smoothEarningsMin).toLocaleString();
}

setInterval(updateEarningsDisplay, 100);

function updateUI() {
    document.getElementById('moneyDisplay').innerText = state.money.toLocaleString();
    updateEarningsDisplay();
    document.getElementById('gridSizeDisplay').innerText = state.gridSize;
    document.getElementById('gridSizeDisplay2').innerText = state.gridSize;

    // Stats Mineros
    document.getElementById('genCountDisplay').innerText = countGenerators();
    document.getElementById('maxGenDisplay').innerText = state.maxGenerators;

    // Toolbar active state
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.replace('border-blue-500', 'border-transparent'));
    const btn = document.getElementById(`tool-${state.tool}`);
    if (btn) btn.classList.replace('border-transparent', 'border-blue-500');

    // Show unlocked buildings
    ['smelter', 'crafter', 'splitter2', 'splitter3', 'merger', 'quantum_generator'].forEach(b => {
        if (state.unlockedBuildings.includes(b)) {
            document.getElementById(`tool-${b}`).classList.remove('hidden');
        }
    });
}

window.setTool = function (t) {
    if (BUILDINGS[t]?.shop && !state.unlockedBuildings.includes(t)) return;
    state.tool = t;
    closeInspector();
    updateUI();
};

// --- ENTRADA (MOUSE) ---
function getScreenToWorld(mx, my) {
    const worldX = (mx - canvas.width / 2) / camera.zoom + camera.x;
    const worldY = (my - canvas.height / 2) / camera.zoom + camera.y;
    return { worldX, worldY };
}
function getGridPos(wx, wy) {
    return { gx: Math.floor(wx / TILE_SIZE), gy: Math.floor(wy / TILE_SIZE) };
}

let dragStartPos = null;
canvas.addEventListener('mousedown', (e) => {
    const { worldX, worldY } = getScreenToWorld(e.clientX, e.clientY);
    dragStartPos = { x: e.clientX, y: e.clientY };

    if (e.button === 2 || state.tool === 'cursor') {
        isDraggingPan = true;
    } else if (e.button === 0) {
        isDraggingBuild = true;
        lastBuiltGrid = null;
        buildAtMouse(e.clientX, e.clientY);
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDraggingPan) {
        camera.x -= e.movementX / camera.zoom;
        camera.y -= e.movementY / camera.zoom;
    } else if (isDraggingBuild) {
        buildAtMouse(e.clientX, e.clientY);
    }
});

window.addEventListener('mouseup', (e) => {
    if (isDraggingPan && state.tool === 'cursor' && e.button === 0) {
        const dx = e.clientX - dragStartPos.x;
        const dy = e.clientY - dragStartPos.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            const w = getScreenToWorld(e.clientX, e.clientY);
            const g = getGridPos(w.worldX, w.worldY);
            selectTile(g.gx, g.gy);
        }
    }
    isDraggingPan = false;
    if (isDraggingBuild) saveGameToCloud();
    isDraggingBuild = false;
});

canvas.addEventListener('wheel', (e) => {
    const zoomSpeed = 0.1;
    const factor = e.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed;
    const w = getScreenToWorld(e.clientX, e.clientY);
    camera.zoom = Math.max(0.2, Math.min(camera.zoom * factor, 3.0));
    camera.x = w.worldX - (e.clientX - canvas.width / 2) / camera.zoom;
    camera.y = w.worldY - (e.clientY - canvas.height / 2) / camera.zoom;
});

// --- SOPORTE TÁCTIL (Pinch-to-zoom y Dos dedos para mover) ---
let lastTouchPos = null;
let lastTouchDist = null;
let isPanningTouch = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const { worldX, worldY } = getScreenToWorld(touch.clientX, touch.clientY);
        
        if (state.tool === 'cursor') {
            // Un dedo selecciona en modo cursor
            const g = getGridPos(worldX, worldY);
            selectTile(g.gx, g.gy);
        } else {
            // Un dedo construye en otros modos
            isDraggingBuild = true;
            buildAtMouse(touch.clientX, touch.clientY);
        }
    } else if (e.touches.length === 2) {
        isDraggingBuild = false; // Cancelar construcción si entra un segundo dedo
        isPanningTouch = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchPos = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        lastTouchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDraggingBuild) {
        buildAtMouse(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && isPanningTouch) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        // Pan
        if (lastTouchPos) {
            camera.x -= (currentMid.x - lastTouchPos.x) / camera.zoom;
            camera.y -= (currentMid.y - lastTouchPos.y) / camera.zoom;
        }

        // Zoom (pinch)
        if (lastTouchDist && lastTouchDist > 0) {
            const zoomFactor = currentDist / lastTouchDist;
            const oldZoom = camera.zoom;
            camera.zoom = Math.max(0.2, Math.min(camera.zoom * zoomFactor, 3.0));
            
            // Ajustar cámara para que el zoom sea hacia el centro de los dedos
            const { worldX, worldY } = getScreenToWorld(currentMid.x, currentMid.y);
            camera.x = worldX - (currentMid.x - canvas.width / 2) / camera.zoom;
            camera.y = worldY - (currentMid.y - canvas.height / 2) / camera.zoom;
        }

        lastTouchPos = currentMid;
        lastTouchDist = currentDist;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        isPanningTouch = false;
        lastTouchPos = null;
        lastTouchDist = null;
    }
    if (e.touches.length === 0) {
        if (isDraggingBuild) saveGameToCloud();
        isDraggingBuild = false;
    }
});

window.addEventListener('keydown', (e) => {
    if (!selectedTile) return;

    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.key === 'Backspace' && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
            return;
        }
        if (e.key === 'Backspace') e.preventDefault();
        deleteSelected();
        return;
    } else if (e.key === 'e' || e.key === 'E') {
        window.rotateSelected(1);
        return;
    } else if (e.key === 'q' || e.key === 'Q') {
        window.rotateSelected(-1);
        return;
    }

    if (dx !== 0 || dy !== 0) {
        // Prevenir scroll si usamos las flechitas, a menos que estemos en un combobox
        if (e.key.startsWith('Arrow')) {
            if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                return; // Dejar que el select nativo cambie de opción
            }
            e.preventDefault();
        }

        const [gx, gy] = selectedTile.split(',').map(Number);
        const nx = gx + dx;
        const ny = gy + dy;

        if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
            const nextKey = `${nx},${ny}`;
            // Mover la máquina seleccionada físicamente en el mapa si la celda destino está libre
            const cell = state.map[selectedTile];
            if (!state.map[nextKey] && cell) {
                state.map[nextKey] = cell;
                delete state.map[selectedTile];

                // Recalcular si es un extractor
                if (cell.type === 'generator') {
                    const deposit = getOreDeposit(nx, ny);
                    cell.config = deposit || 'ore_iron';
                }

                selectTile(nx, ny); // Mantiene el componente seleccionado y actualiza la UI
                saveGameToCloud();
            }
        }
    }
});

// --- LÓGICA DE CONSTRUCCIÓN ---
function buildAtMouse(mx, my) {
    const { worldX, worldY } = getScreenToWorld(mx, my);
    const { gx, gy } = getGridPos(worldX, worldY);
    const key = `${gx},${gy}`;

    if (gx < 0 || gy < 0 || gx >= state.gridSize || gy >= state.gridSize) return;

    // Auto-dirección de cintas (o divisores)
    if ((state.tool === 'conveyor' || state.tool.startsWith('splitter') || state.tool === 'merger') && lastBuiltGrid) {
        if (lastBuiltGrid.gx !== gx || lastBuiltGrid.gy !== gy) {
            const dx = gx - lastBuiltGrid.gx;
            const dy = gy - lastBuiltGrid.gy;
            if (Math.abs(dx) > Math.abs(dy)) state.buildDir = dx > 0 ? 1 : 3;
            else state.buildDir = dy > 0 ? 2 : 0;
        }
    }

    const existing = state.map[key];
    if (existing && existing.type === state.tool && existing.dir === state.buildDir) {
        lastBuiltGrid = { gx, gy };
        return;
    }

    // Límite de Mineros
    if (state.tool === 'generator' && (!existing || existing.type !== 'generator')) {
        if (countGenerators() >= state.maxGenerators) {
            showToast(`Límite máximo de mineros (${state.maxGenerators}) alcanzado.`);
            return;
        }
    }

    const cost = BUILDINGS[state.tool].cost;
    if (state.money >= cost) {
        if (existing) refundBuilding(existing);

        state.money -= cost;

        let cfg = null;
        if (state.tool === 'generator') {
            const deposit = getOreDeposit(gx, gy);
            cfg = deposit || 'ore_iron'; // Auto-detect deposit, default iron
        }
        if (state.tool === 'smelter') cfg = state.unlockedRecipes.find(r => RECIPES[r].type === 'smelter') || 'smelt_iron';
        if (state.tool === 'crafter') cfg = state.unlockedRecipes.find(r => RECIPES[r].type === 'crafter') || 'craft_wire';
        if (state.tool === 'merger') cfg = '1.0,1.0'; // leftTime,rightTime

        state.map[key] = {
            type: state.tool,
            dir: state.buildDir,
            config: cfg,
            isActive: true, // Nuevo: Soporte para encender/apagar
            inventory: {},
            outBuffer: null,
            timer: 0,
            splitIndex: 0 // Para divisores
        };

        updateUI();
        lastBuiltGrid = { gx, gy };
    } else if (!isDraggingBuild) {
        showToast("Falta dinero para construir esto.");
    }
}

function refundBuilding(buildingData) {
    const refund = Math.floor(BUILDINGS[buildingData.type].cost * 0.5);
    state.money += refund;
}

// --- INSPECTOR ---
window.selectTile = function (gx, gy) {
    const key = `${gx},${gy}`;
    selectedTile = key; // Siempre guardamos donde está el cursor visual

    const cell = state.map[key];
    const insp = document.getElementById('inspectorPanel');

    if (!cell) {
        insp.classList.add('hidden'); // Ocultar UI pero mantener cursor en mapa
        return;
    }

    insp.classList.remove('hidden');
    document.getElementById('inspTitle').innerText = BUILDINGS[cell.type].name;

    let html = '';

    if (cell.type === 'generator') {
        const deposit = getOreDeposit(gx, gy);
        if (deposit) {
            // Miner is on a deposit - locked to that ore
            const depInfo = ORE_DEPOSIT_INFO[deposit];
            const matInfo = MATS[deposit];
            html += `<div class="flex items-center gap-2 bg-amber-900/30 p-2 rounded border border-amber-700 mb-2">
                        <img src="textures/factory/${matInfo.sprite}.png" class="w-6 h-6 object-contain">
                        <span class="text-sm text-amber-300 font-bold">Extrayendo: ${matInfo.name}</span>
                     </div>
                     <div class="text-xs text-gray-400">⛏️ Este minero está sobre una ${depInfo.name}. El mineral está fijado.</div>`;
        } else {
            // No deposit under miner
            if (cell.config !== 'ore_iron' && cell.config !== 'ore_copper') {
                // Persistent rare ore from before a world gen change
                const matInfo = MATS[cell.config];
                html += `<div class="flex items-center gap-2 bg-orange-900/30 p-2 rounded border border-orange-700 mb-2">
                            <img src="textures/factory/${matInfo?.sprite}.png" class="w-6 h-6 object-contain">
                            <span class="text-sm text-orange-300 font-bold">Inercia: ${matInfo?.name}</span>
                         </div>
                         <div class="text-[10px] text-orange-400/70 mb-2 italic">⚠️ La veta desapareció, pero la máquina conserva su configuración.</div>`;
            }

            html += `<label class="text-xs text-gray-400">Mineral a Extraer:</label>
                     <select id="selConfig" class="bg-gray-700 text-white p-2 rounded outline-none border border-gray-600 w-full">
                        <option value="ore_iron" ${cell.config === 'ore_iron' ? 'selected' : ''}>Hierro</option>
                        <option value="ore_copper" ${cell.config === 'ore_copper' ? 'selected' : ''}>Cobre</option>
                     </select>
                     <div class="text-xs text-gray-500 mt-1">💡 Coloca un minero sobre una veta para extraer minerales raros.</div>`;
        }
        
        // UPGRADE SYSTEM FOR MINERS
        const upgLvl = cell.upgradeLevel || 0;
        const baseCost = 400;
        const upgCost = baseCost * Math.pow(2.2, upgLvl);
        const speedMult = Math.min(Math.pow(1.5, upgLvl), 2.5).toFixed(2);
        const isMax = Math.pow(1.5, upgLvl) >= 2.5;

        html += `<div class="mt-4 border-t border-gray-600 pt-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-indigo-300 font-bold">Nivel Mejora: ${upgLvl}</span>
                        <span class="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-900 rounded border border-gray-700">Velocidad: x${speedMult}</span>
                    </div>
                    ${isMax ? 
                        `<div class="w-full bg-gray-700/50 py-2 rounded-lg text-xs font-bold text-center text-indigo-400 border border-indigo-900/50">MÁXIMO ALCANZADO</div>` :
                        `<button onclick="upgradeMachine('${gx}', '${gy}')" class="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-xs font-bold shadow text-white transition-colors">
                            Mejorar Producción ($${Math.floor(upgCost).toLocaleString()})
                        </button>`
                    }
                 </div>`;
    } else if (cell.type === 'quantum_generator') {
        html += `<div class="flex items-center gap-2 bg-purple-900/30 p-2 rounded border border-purple-700">
                    <img src="textures/factory/quantum_chip.png" class="w-6 h-6 object-contain">
                    <span class="text-sm text-purple-300 font-bold">Produciendo: Chip Cuántico</span>
                 </div>
                 <div class="text-xs text-gray-400 mt-1">⏱️ Velocidad: 1 chip cada 30 segundos</div>`;
    } else if (cell.type === 'smelter' || cell.type === 'crafter') {
        const machineType = cell.type;
        html += `<label class="text-xs text-gray-400">Receta Asignada:</label>
                         <select id="selConfig" class="bg-gray-700 text-white p-2 rounded outline-none border border-gray-600">`;

        let hasRecipes = false;
        state.unlockedRecipes.forEach(rKey => {
            const rec = RECIPES[rKey];
            if (rec && rec.type === machineType) {
                html += `<option value="${rKey}" ${cell.config === rKey ? 'selected' : ''}>${rec.name}</option>`;
                hasRecipes = true;
            }
        });
        if (!hasRecipes) html += `<option value="">-- Compra recetas en tienda --</option>`;
        html += `</select>`;

        if (cell.config && RECIPES[cell.config]) {
            html += `<div class="mt-2 text-xs text-gray-400 border-t border-gray-600 pt-2">Inventario:</div>`;
            const req = RECIPES[cell.config].in;
            for (let mat in req) {
                let has = cell.inventory[mat] || 0;
                let color = has >= req[mat] ? 'text-green-400' : 'text-orange-400';
                let mInfo = MATS[mat];
                html += `<div class="flex justify-between items-center text-xs bg-gray-900 p-1.5 rounded mb-1 border border-gray-700">
                                    <div class="flex items-center gap-2">
                                        <img src="textures/factory/${mInfo?.sprite}.png" class="w-5 h-5 object-contain">
                                        <span>${mInfo?.name || mat}</span>
                                    </div>
                                    <span class="${color} font-bold">${has} / ${req[mat]}</span>
                                 </div>`;
            }
            if (cell.outBuffer) {
                html += `<div class="text-[10px] text-yellow-400 mt-1">Bloqueado: Salida llena.</div>`;
            }
        }

        // SISTEMA DE MEJORAS (Velocidad)
        const upgLvl = cell.upgradeLevel || 0;
        const baseCosta = cell.type === 'smelter' ? 500 : 1000;
        const upgCost = baseCosta * Math.pow(2, upgLvl);
        const speedMult = Math.pow(1.4, upgLvl).toFixed(1);

        html += `<div class="mt-4 border-t border-gray-600 pt-3">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs text-purple-300 font-bold">Nivel: ${upgLvl + 1}</span>
                                <span class="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-900 rounded border border-gray-700">Velocidad: x${speedMult}</span>
                            </div>
                            <button onclick="upgradeMachine('${gx}', '${gy}')" class="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-xs font-bold shadow text-white transition-colors">
                                Mejorar ($${upgCost.toLocaleString()})
                            </button>
                         </div>`;


    } else if (cell.type === 'conveyor' || cell.type === 'splitter2' || cell.type === 'splitter3') {
        const upgLvl = cell.upgradeLevel || 0;
        let baseCostCalc = 200;
        if (cell.type.startsWith('splitter')) baseCostCalc = 500;
        const upgCost = baseCostCalc * Math.pow(2, upgLvl);
        const speedMult = Math.pow(1.4, upgLvl).toFixed(1);

        let descText = cell.type === 'conveyor' ? 'Transporte básico de materiales.' : 'Divide el flujo de materiales.';

        html += `<div class="mb-4">
                    <p class="text-sm text-gray-300">${descText}</p>
                 </div>
                 <div class="mt-4 border-t border-gray-600 pt-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-purple-300 font-bold">Nivel: ${upgLvl + 1}</span>
                        <span class="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-900 rounded border border-gray-700">Velocidad: x${speedMult}</span>
                    </div>
                    <button onclick="upgradeMachine('${gx}', '${gy}')" class="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-xs font-bold shadow text-white transition-colors">
                        Mejorar Velocidad ($${upgCost.toLocaleString()})
                    </button>
                 </div>`;

    } else if (cell.type === 'smart_splitter') {
        const f = cell.filters || { 3: '*', 0: '*', 1: '*' };
        const matsTable = Object.keys(MATS);
        const getOpts = (current) => {
            let opts = `<option value="*">* (Cualquiera)</option>`;
            matsTable.forEach(m => {
                opts += `<option value="${m}" ${current === m ? 'selected' : ''}>${MATS[m].name}</option>`;
            });
            return opts;
        };

        html += `<div class="mb-3">
                    <p class="text-[10px] text-gray-400">Configura qué material sale por cada lado:</p>
                 </div>
                 <div class="space-y-3">
                    <div>
                        <label class="text-[10px] text-emerald-400 font-bold uppercase">⬅️ Izquierda</label>
                        <select id="selSmart3" class="bg-gray-700 text-white p-1.5 rounded outline-none border border-emerald-700 w-full mt-1 text-xs">
                            ${getOpts(f[3])}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] text-blue-400 font-bold uppercase">⬆️ Frente</label>
                        <select id="selSmart0" class="bg-gray-700 text-white p-1.5 rounded outline-none border border-blue-700 w-full mt-1 text-xs">
                            ${getOpts(f[0])}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] text-orange-400 font-bold uppercase">➡️ Derecha</label>
                        <select id="selSmart1" class="bg-gray-700 text-white p-1.5 rounded outline-none border border-orange-700 w-full mt-1 text-xs">
                            ${getOpts(f[1])}
                        </select>
                    </div>
                 </div>`;
    } else if (cell.type === 'merger') {
        const parts = (cell.config || '1.0,1.0').split(',');
        const leftTime = parseFloat(parts[0]) || 1.0;
        const rightTime = parseFloat(parts[1]) || 1.0;
        const activeSide = (cell.splitIndex || 0) % 2;
        const sideLabels = ['⬅️ Izquierda', '➡️ Derecha'];
        const timeOpts = [0.5, 1.0, 2.0, 3.0, 5.0];
        const timeLabels = ['0.5s', '1.0s', '2.0s', '3.0s', '5.0s'];

        let leftOpts = timeOpts.map((v, i) => `<option value="${v}" ${leftTime === v ? 'selected' : ''}>${timeLabels[i]}</option>`).join('');
        let rightOpts = timeOpts.map((v, i) => `<option value="${v}" ${rightTime === v ? 'selected' : ''}>${timeLabels[i]}</option>`).join('');

        html += `<div class="mb-3">
                    <p class="text-sm text-gray-300">Fusiona 2 líneas laterales en 1. Cicla entre entradas con tiempo independiente.</p>
                 </div>
                 <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs text-emerald-400 font-bold">⬅️ Izquierda</label>
                        <select id="selMergerLeft" class="bg-gray-700 text-white p-1.5 rounded outline-none border border-emerald-700 w-full mt-1 text-xs">
                            ${leftOpts}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-blue-400 font-bold">➡️ Derecha</label>
                        <select id="selMergerRight" class="bg-gray-700 text-white p-1.5 rounded outline-none border border-blue-700 w-full mt-1 text-xs">
                            ${rightOpts}
                        </select>
                    </div>
                 </div>
                 <div class="mt-3 flex items-center gap-2 p-2 rounded border ${activeSide === 0 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-blue-900/30 border-blue-700'}">
                    <span class="text-lg">${activeSide === 0 ? '⬅️' : '➡️'}</span>
                    <span class="text-sm font-bold ${activeSide === 0 ? 'text-emerald-300' : 'text-blue-300'}">Activo: ${sideLabels[activeSide]}</span>
                 </div>`;

        const upgLvl = cell.upgradeLevel || 0;
        const upgCost = 300 * Math.pow(2, upgLvl);
        const speedMult = Math.pow(1.4, upgLvl).toFixed(1);

        html += `<div class="mt-4 border-t border-gray-600 pt-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-purple-300 font-bold">Nivel: ${upgLvl + 1}</span>
                        <span class="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-900 rounded border border-gray-700">Velocidad: x${speedMult}</span>
                    </div>
                    <button onclick="upgradeMachine('${gx}', '${gy}')" class="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-xs font-bold shadow text-white transition-colors">
                        Mejorar Velocidad ($${upgCost.toLocaleString()})
                    </button>
                 </div>`;
    } else {
        html = `<p class="text-sm text-gray-400 italic">No requiere configuración extra.</p>`;
    }

    // Botón Global de Encendido/Apagado
    const canPower = (cell.type !== 'conveyor' && !cell.type.startsWith('splitter') && cell.type !== 'merger' && cell.type !== 'seller');
    if (canPower) {
        const active = (cell.isActive !== false);
        html += `<div class="mt-4 pt-4 border-t border-gray-700">
                    <button onclick="toggleMachinePower('${gx}', '${gy}')" 
                        class="w-full flex items-center justify-between p-3 rounded-xl border transition-all ${active ? 'bg-green-600/20 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-600/20 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-red-500'}"></div>
                            <span class="text-sm font-bold uppercase tracking-wider">${active ? 'Encendido' : 'Apagado'}</span>
                        </div>
                        <span class="text-xs ${active ? 'text-green-300' : 'text-red-300'} px-2 py-1 bg-black/30 rounded font-mono">${active ? 'ON' : 'OFF'}</span>
                    </button>
                 </div>`;
    }

    document.getElementById('inspConfig').innerHTML = html;

    const selNode = document.getElementById('selConfig');
    if (selNode) {
        selNode.onchange = (e) => {
            const c = state.map[selectedTile];
            if (c) {
                c.config = e.target.value;
                c.inventory = {};
                c.outBuffer = null;
                c.timer = 0;
                selectTile(gx, gy);
                saveGameToCloud();
            }
        };
    }

    const selLeft = document.getElementById('selMergerLeft');
    const selRight = document.getElementById('selMergerRight');
    if (selLeft && selRight) {
        const updateMerger = () => {
            const c = state.map[selectedTile];
            if (c) {
                c.config = `${selLeft.value},${selRight.value}`;
                saveGameToCloud();
            }
        };
        selLeft.onchange = updateMerger;
        selRight.onchange = updateMerger;
    }

    const s0 = document.getElementById('selSmart0');
    const s1 = document.getElementById('selSmart1');
    const s3 = document.getElementById('selSmart3');
    if (s0 && s1 && s3) {
        const updateSmart = () => {
            const c = state.map[selectedTile];
            if (c) {
                c.filters = { 0: s0.value, 1: s1.value, 3: s3.value };
                saveGameToCloud();
            }
        };
        s0.onchange = updateSmart;
        s1.onchange = updateSmart;
        s3.onchange = updateSmart;
    }
};

window.closeInspector = function () {
    selectedTile = null;
    document.getElementById('inspectorPanel').classList.add('hidden');
};

window.upgradeMachine = function (gx, gy) {
    const key = `${gx},${gy}`;
    const cell = state.map[key];
    if (cell && (cell.type === 'generator' || cell.type === 'smelter' || cell.type === 'crafter' || cell.type === 'conveyor' || cell.type.startsWith('splitter') || cell.type === 'merger')) {
        const upgLvl = cell.upgradeLevel || 0;

        // Verificar límite de 2.5x para el minero
        if (cell.type === 'generator' && Math.pow(1.5, upgLvl) >= 2.5) {
            showToast("¡Este minero ya está al máximo!");
            return;
        }

        let baseCost = 1000;
        if (cell.type === 'generator') baseCost = 400;
        if (cell.type === 'smelter') baseCost = 500;
        if (cell.type === 'conveyor') baseCost = 200;
        if (cell.type.startsWith('splitter')) baseCost = 500;
        if (cell.type === 'merger') baseCost = 300;

        const upgCost = Math.floor(baseCost * Math.pow(cell.type === 'generator' ? 2.2 : 2, upgLvl));
        if (state.money >= upgCost) {
            state.money -= upgCost;
            cell.upgradeLevel = upgLvl + 1;
            updateUI();
            selectTile(gx, gy); // Refrescar el inspector visualmente
            saveGameToCloud();
            showToast(cell.type === 'generator' ? "¡Extracción mejorada!" : "¡Máquina acelerada!");
        } else {
            showToast("No tienes suficiente dinero.");
        }
    }
};

window.toggleMachinePower = function (gx, gy) {
    const key = `${gx},${gy}`;
    const cell = state.map[key];
    if (cell) {
        cell.isActive = (cell.isActive === false) ? true : false;
        selectTile(gx, gy);
        saveGameToCloud();
        showToast(cell.isActive ? "⚡ Máquina encendida" : "💤 Máquina apagada");
    }
};

window.rotateSelected = function (inc = 1) {
    if (!selectedTile) return;
    const cell = state.map[selectedTile];
    if (cell) {
        // Rotación bilateral: (dir + inc + 4) % 4 asegura valores positivos
        cell.dir = (cell.dir + inc + 4) % 4;
        saveGameToCloud();
        // Forzar redibujado de la UI si el inspector está abierto
        const [gx, gy] = selectedTile.split(',').map(Number);
        selectTile(gx, gy);
    }
};

window.deleteSelected = function () {
    if (!selectedTile) return;
    const cell = state.map[selectedTile];
    if (cell) {
        refundBuilding(cell);
        delete state.map[selectedTile];
        updateUI();
        closeInspector();
        saveGameToCloud();
    }
};

// --- LÓGICA DE ACTUALIZACIÓN ---
function isPosOccupiedByItem(x, y) {
    return state.items.some(i => (i.x === x && i.y === y && !i.moving) || (i.nx === x && i.ny === y));
}

function updateLogic(dt) {
    // 1. Procesar Máquinas
    for (let key in state.map) {
        const cell = state.map[key];
        const [gx, gy] = key.split(',').map(Number);

        // Omitir si la máquina está apagada
        if (cell.isActive === false && cell.type !== 'conveyor' && !cell.type.startsWith('splitter') && cell.type !== 'merger') {
            continue;
        }

        if (cell.type === 'generator') {
            cell.timer += dt;
            let baseProdTime = 1.0;
            if (cell.config === 'ore_diamond') baseProdTime = 4.0;
            else if (cell.config === 'ore_gold' || cell.config === 'ore_silicon') baseProdTime = 2.0;

            const speedMultiplier = Math.min(Math.pow(1.5, cell.upgradeLevel || 0), 2.5);
            const actualProdTime = baseProdTime / speedMultiplier;

            if (cell.timer >= actualProdTime) {
                state.items.push({ type: cell.config, x: gx, y: gy, nx: gx, ny: gy, progress: 0, moving: false, idleTime: 0 });
                cell.timer -= actualProdTime; // Mantener excedente para fluidez
            }
        }
        else if (cell.type === 'quantum_generator') {
            cell.timer += dt;
            const speed = 30.0;
            if (cell.timer >= speed) {
                state.items.push({ type: 'quantum_chip', x: gx, y: gy, nx: gx, ny: gy, progress: 0, moving: false, idleTime: 0 });
                cell.timer = 0;
            }
        }
        else if (cell.type === 'smelter' || cell.type === 'crafter') {
            const recipe = RECIPES[cell.config];
            if (!recipe) continue;

            if (cell.outBuffer) {
                state.items.push({ type: cell.outBuffer, x: gx, y: gy, nx: gx, ny: gy, progress: 0, moving: false, idleTime: 0 });
                cell.outBuffer = null;
                if (selectedTile === key) selectTile(gx, gy);
            }

            if (!cell.outBuffer) {
                let canCraft = true;
                for (let reqMat in recipe.in) {
                    if ((cell.inventory[reqMat] || 0) < recipe.in[reqMat]) {
                        canCraft = false; break;
                    }
                }

                if (canCraft) {
                    cell.timer += dt;
                    const speedMultiplier = Math.pow(1.4, cell.upgradeLevel || 0);
                    const actualTimeRequired = recipe.time / speedMultiplier;

                    if (cell.timer >= actualTimeRequired) {
                        for (let reqMat in recipe.in) {
                            cell.inventory[reqMat] -= recipe.in[reqMat];
                        }
                        cell.outBuffer = recipe.out;
                        cell.timer -= actualTimeRequired; // mantener excedente si va rapido
                        if (selectedTile === key) selectTile(gx, gy);
                    }
                } else {
                    cell.timer = 0;
                }
            }
        }
        // Merger: ciclar entre entradas con tiempos por lado
        else if (cell.type === 'merger') {
            cell.timer = (cell.timer || 0) + dt;
            const parts = (cell.config || '1.0,1.0').split(',');
            const times = [parseFloat(parts[0]) || 1.0, parseFloat(parts[1]) || 1.0];
            const activeSide = (cell.splitIndex || 0) % 2;
            const currentCycleTime = times[activeSide];
            if (cell.timer >= currentCycleTime) {
                cell.timer -= currentCycleTime;
                cell.splitIndex = (activeSide + 1) % 2;
                if (selectedTile === key) selectTile(gx, gy);
            }
        }
    }

    // 2. Mover Objetos
    for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];

        if (!item.moving) {
            const cell = state.map[`${item.x},${item.y}`];

            if (cell) {
                if (cell.type === 'seller') {
                    const val = MATS[item.type]?.value || 0;
                    state.money += val;
                    logEarning(val);
                    state.items.splice(i, 1);
                    updateUI();
                    continue;
                }

                // Lógica de dirección (Cinta normal vs Divisores)
                let pushDir = cell.dir;
                let isSplitter = false;

                if (cell.type === 'splitter2') {
                    isSplitter = true;
                    // Alterna entre Izquierda y Derecha (relativo a cell.dir)
                    const dirs = [(cell.dir + 3) % 4, (cell.dir + 1) % 4];
                    pushDir = dirs[(cell.splitIndex || 0) % 2];
                } else if (cell.type === 'splitter3') {
                    isSplitter = true;
                    // Alterna entre Izquierda, Frente y Derecha
                    const dirs = [(cell.dir + 3) % 4, cell.dir, (cell.dir + 1) % 4];
                    pushDir = dirs[(cell.splitIndex || 0) % 3];
                } else if (cell.type === 'smart_splitter') {
                    isSplitter = true;
                    const f = cell.filters || { 0: '*', 1: '*', 3: '*' };
                    const l = (cell.dir + 3) % 4;
                    const r = (cell.dir + 1) % 4;
                    const fwd = cell.dir;

                    if (f[3] && f[3] !== '*' && f[3] === item.type) pushDir = l;
                    else if (f[0] && f[0] !== '*' && f[0] === item.type) pushDir = fwd;
                    else if (f[1] && f[1] !== '*' && f[1] === item.type) pushDir = r;
                    else {
                        // Priority for '*' catch-all
                        if (f[0] === '*') pushDir = fwd;
                        else if (f[1] === '*') pushDir = r;
                        else if (f[3] === '*') pushDir = l;
                        else pushDir = fwd;
                    }
                }

                const nx = item.x + DIRECTIONS[pushDir].dx;
                const ny = item.y + DIRECTIONS[pushDir].dy;

                if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
                    const nextCell = state.map[`${nx},${ny}`];
                    let canMove = false;
                    let acceptedByMachine = false;

                    if (nextCell) {
                        if (nextCell.type === 'conveyor' || nextCell.type.startsWith('splitter') || nextCell.type === 'seller') {
                            canMove = true;
                        } else if (nextCell.type === 'merger') {
                            // Merger solo acepta del lado activo según su ciclo
                            const mergerLeftDir = (nextCell.dir + 3) % 4;
                            const mergerRightDir = (nextCell.dir + 1) % 4;
                            const fromDx = item.x - nx;
                            const fromDy = item.y - ny;
                            const isFromLeft = (fromDx === DIRECTIONS[mergerLeftDir].dx && fromDy === DIRECTIONS[mergerLeftDir].dy);
                            const isFromRight = (fromDx === DIRECTIONS[mergerRightDir].dx && fromDy === DIRECTIONS[mergerRightDir].dy);
                            const activeSide = (nextCell.splitIndex || 0) % 2; // 0=left, 1=right
                            if ((activeSide === 0 && isFromLeft) || (activeSide === 1 && isFromRight)) {
                                canMove = true;
                            }
                        } else if (nextCell.type === 'smelter' || nextCell.type === 'crafter') {
                            const rec = RECIPES[nextCell.config];
                            if (rec && rec.in[item.type]) {
                                canMove = true;
                                acceptedByMachine = true;
                            }
                        }
                    }

                    if (canMove) {
                        item.moving = true;
                        item.nx = nx;
                        item.ny = ny;
                        item.destMachine = acceptedByMachine ? `${nx},${ny}` : null;

                        // Incrementar el divisor solo si se movió exitosamente
                        if (isSplitter) cell.splitIndex++;
                        item.idleTime = 0; // Reset idle time when moving starts
                    }
                }
            }

            // Lógica de desaparición por inactividad (si no se movió y no está en una máquina procesadora)
            if (!item.moving) {
                item.idleTime = (item.idleTime || 0) + dt;
                if (item.idleTime >= 3.0) {
                    state.items.splice(i, 1);
                    continue;
                }
            }
        } else {
            const currentCell = state.map[`${item.x},${item.y}`];
            const beltSpeedMult = currentCell ? Math.pow(1.4, currentCell.upgradeLevel || 0) : 1;
            item.progress += BASE_ITEM_SPEED * beltSpeedMult * dt;
            if (item.progress >= 1.0) {
                item.x = item.nx;
                item.y = item.ny;
                item.progress = 0;
                item.moving = false;

                if (item.destMachine) {
                    const targetCell = state.map[item.destMachine];
                    if (targetCell) {
                        targetCell.inventory[item.type] = (targetCell.inventory[item.type] || 0) + 1;
                        state.items.splice(i, 1);
                        if (selectedTile === item.destMachine) {
                            const [gx, gy] = item.destMachine.split(',').map(Number);
                            selectTile(gx, gy);
                        }
                    }
                }
            }
        }
    }
}

// --- RENDERIZADO ---
function drawShape(ctx, shape, size) {
    ctx.beginPath();
    const s = size * 0.4;
    if (shape === 'arc') {
        ctx.arc(0, 0, s, 0, Math.PI * 2);
    } else if (shape === 'rect') {
        ctx.rect(-s, -s * 0.8, s * 2, s * 1.6);
    } else if (shape === 'chip') {
        ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
        ctx.moveTo(-s, -s * 0.5); ctx.lineTo(-s * 0.8, -s * 0.5);
        ctx.moveTo(-s, 0); ctx.lineTo(-s * 0.8, 0);
        ctx.moveTo(-s, s * 0.5); ctx.lineTo(-s * 0.8, s * 0.5);
        ctx.moveTo(s, -s * 0.5); ctx.lineTo(s * 0.8, -s * 0.5);
        ctx.moveTo(s, 0); ctx.lineTo(s * 0.8, 0);
        ctx.moveTo(s, s * 0.5); ctx.lineTo(s * 0.8, s * 0.5);
    } else if (shape === 'coil') {
        ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
        ctx.stroke(); ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    } else if (shape === 'plate') {
        ctx.rect(-s, -s * 0.4, s * 2, s * 0.8);
    } else if (shape === 'gear') {
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.rect(-s * 0.2, -s, s * 0.4, s * 2);
        }
        ctx.fill(); ctx.beginPath(); ctx.fillStyle = '#11111b';
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    } else if (shape === 'pipe') {
        ctx.rect(-s * 0.2, -s, s * 0.4, s * 2);
    } else if (shape === 'cylinder') {
        ctx.rect(-s * 0.6, -s, s * 1.2, s * 2);
    }
    ctx.fill();
    if (shape === 'chip' || shape === 'coil') ctx.stroke();
}

let mouseHoverX = -1; let mouseHoverY = -1;
let animOffset = 0;

function draw() {
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Calcular tiles visibles en pantalla
    const halfW = (canvas.width / 2) / camera.zoom;
    const halfH = (canvas.height / 2) / camera.zoom;
    const viewLeft = camera.x - halfW;
    const viewRight = camera.x + halfW;
    const viewTop = camera.y - halfH;
    const viewBottom = camera.y + halfH;
    const tileStartX = Math.floor(viewLeft / TILE_SIZE) - 1;
    const tileEndX = Math.ceil(viewRight / TILE_SIZE) + 1;
    const tileStartY = Math.floor(viewTop / TILE_SIZE) - 1;
    const tileEndY = Math.ceil(viewBottom / TILE_SIZE) + 1;

    // Suelo infinito + menas procedurales
    for (let ty = tileStartY; ty <= tileEndY; ty++) {
        for (let tx = tileStartX; tx <= tileEndX; tx++) {
            const px = tx * TILE_SIZE;
            const py = ty * TILE_SIZE;
            const inGrid = (tx >= 0 && tx < state.gridSize && ty >= 0 && ty < state.gridSize);

            // Fondo del tile
            ctx.fillStyle = inGrid ? '#1e1e2e' : '#16161e';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Ore deposit tint
            const deposit = getOreDeposit(tx, ty);
            if (deposit && ORE_DEPOSIT_INFO[deposit]) {
                const dInfo = ORE_DEPOSIT_INFO[deposit];
                ctx.fillStyle = dInfo.tint;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                // Small ore icon in center
                if (SPRITES[dInfo.sprite]) {
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(SPRITES[dInfo.sprite], px + TILE_SIZE * 0.25, py + TILE_SIZE * 0.25, TILE_SIZE * 0.5, TILE_SIZE * 0.5);
                    ctx.globalAlpha = 1.0;
                } else {
                    // Fallback: colored dot
                    ctx.fillStyle = dInfo.border;
                    ctx.beginPath();
                    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Grid lines
            ctx.strokeStyle = inGrid ? '#313244' : '#1a1a2a';
            ctx.lineWidth = 1;
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
    }

    // Borde del área construible
    ctx.strokeStyle = '#585b70';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(0, 0, state.gridSize * TILE_SIZE, state.gridSize * TILE_SIZE);
    ctx.setLineDash([]);

    animOffset = (Date.now() / 30) % 20;

    // Edificios
    for (let key in state.map) {
        const cell = state.map[key];
        const [gx, gy] = key.split(',').map(Number);
        ctx.save();
        ctx.translate(gx * TILE_SIZE + TILE_SIZE / 2, gy * TILE_SIZE + TILE_SIZE / 2);

        if (selectedTile === key) {
            ctx.shadowColor = '#89b4fa';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#89b4fa';
            ctx.lineWidth = 3;
            ctx.strokeRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            ctx.shadowBlur = 0;
        }

        if (cell.isActive === false && cell.type !== 'conveyor' && !cell.type.startsWith('splitter') && cell.type !== 'merger') {
            ctx.filter = 'grayscale(100%) brightness(0.5)';
        }

        if (cell.type === 'conveyor') {
            // Lógica avanzada de conexión de cintas
            const outDir = cell.dir;
            const inDirs = [];
            const neighbors = [
                { dx: 0, dy: -1, dirInto: 2, label: 0 }, // Arriba
                { dx: 1, dy: 0, dirInto: 3, label: 1 },  // Derecha
                { dx: 0, dy: 1, dirInto: 0, label: 2 },  // Abajo
                { dx: -1, dy: 0, dirInto: 1, label: 3 }  // Izquierda
            ];

            neighbors.forEach(n => {
                const neighbor = state.map[`${gx + n.dx},${gy + n.dy}`];
                if (neighbor) {
                    let pointsToUs = false;
                    const nt = neighbor.type;
                    const nd = neighbor.dir;

                    if (nt === 'conveyor' || nt === 'generator' || nt === 'smelter' || nt === 'crafter' || nt === 'merger') {
                        pointsToUs = (nd === n.dirInto);
                    } else if (nt === 'splitter2') {
                        // Splitter2 sale por los lados (L y R relativo a su dir)
                        pointsToUs = (n.dirInto === (nd + 3) % 4 || n.dirInto === (nd + 1) % 4);
                    } else if (nt === 'splitter3') {
                        // Splitter3 sale por L, R y Frente
                        pointsToUs = (n.dirInto === (nd + 3) % 4 || n.dirInto === nd || n.dirInto === (nd + 1) % 4);
                    }

                    if (pointsToUs) inDirs.push(n.label);
                }
            });

            const oppositeDir = (outDir + 2) % 4;
            const sideL = (outDir + 3) % 4;
            const sideR = (outDir + 1) % 4;

            const maskL = inDirs.includes(sideL);
            const maskR = inDirs.includes(sideR);
            const maskOpp = inDirs.includes(oppositeDir);

            let spriteName = '';
            let angle = 0;
            let scaleX = 1;

            // Lógica Maestra de Conexiones
            if (maskL && maskR && maskOpp) {
                spriteName = 'belt_cross';
                angle = DIRECTIONS[outDir].angle;
            } else if (maskL && maskR) {
                spriteName = 'belt_corner_2';
                // In: L+R, Out: Forward(outDir)
                angle = (outDir === 0) ? 0 :
                    (outDir === 1) ? Math.PI / 2 :
                        (outDir === 2) ? Math.PI : -Math.PI / 2;
            } else if (maskL && !maskOpp) {
                spriteName = 'belt_corner_1';
                // Base: In Up(0), Out Right(1)
                angle = (outDir === 1) ? 0 :
                    (outDir === 2) ? Math.PI / 2 :
                        (outDir === 3) ? Math.PI : -Math.PI / 2;
            } else if (maskR && !maskOpp) {
                spriteName = 'belt_corner_1';
                // Use scaleX = -1
                angle = (outDir === 3) ? 0 :
                    (outDir === 0) ? Math.PI / 2 :
                        (outDir === 1) ? Math.PI : -Math.PI / 2;
                scaleX = -1;
            } else {
                // RECTA: Usamos siempre belt_horizontal ajustado según la dirección
                // (belt_vertical era un sprite incorrecto que causaba los triples)
                spriteName = 'belt_horizontal';
                angle = DIRECTIONS[outDir].angle;
            }

            if (SPRITES[spriteName]) {
                ctx.rotate(angle);
                ctx.scale(scaleX, 1);
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                // Fallback con flechas animadas
                ctx.fillStyle = '#313244';
                ctx.fillRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                ctx.rotate(DIRECTIONS[outDir].angle);
                ctx.strokeStyle = '#585b70'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                const arrowSize = 5;
                for (let i = -1; i <= 3; i++) {
                    const x = (i * 20) + animOffset - TILE_SIZE / 2;
                    if (x > -TILE_SIZE / 2 && x < TILE_SIZE / 2) {
                        ctx.beginPath(); ctx.moveTo(x - arrowSize, -arrowSize); ctx.lineTo(x, 0); ctx.lineTo(x - arrowSize, arrowSize); ctx.stroke();
                    }
                }
            }
        } else if (cell.type === 'splitter2' || cell.type === 'splitter3' || cell.type === 'merger' || cell.type === 'smart_splitter') {
            let spriteName = (cell.type === 'splitter2' || cell.type === 'merger') ? 'splitter_down' : 'splitter_up';
            if (cell.type === 'smart_splitter') spriteName = 'splitter_up';
            
            if (SPRITES[spriteName]) {
                let drawAngle = DIRECTIONS[cell.dir].angle;
                if (cell.type === 'splitter2') drawAngle -= Math.PI / 2;
                if (cell.type === 'merger') drawAngle += Math.PI / 2;

                if (cell.type === 'merger') {
                    ctx.filter = 'hue-rotate(120deg) saturate(1.3)';
                } else if (cell.type === 'smart_splitter') {
                    ctx.filter = 'hue-rotate(280deg) brightness(1.2)';
                }
                ctx.rotate(drawAngle);
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                if (cell.type === 'merger') {
                    ctx.filter = 'none';
                    // Flecha indicadora del lado activo
                    const activeSide = (cell.splitIndex || 0) % 2;
                    ctx.strokeStyle = activeSide === 0 ? '#34d399' : '#60a5fa';
                    ctx.fillStyle = activeSide === 0 ? '#34d399' : '#60a5fa';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    // Flecha apuntando al lado activo (izq=arriba, der=abajo en espacio rotado)
                    const arrowY = activeSide === 0 ? -18 : 18;
                    const arrowTip = activeSide === 0 ? -24 : 24;
                    ctx.beginPath();
                    ctx.moveTo(-6, arrowY);
                    ctx.lineTo(0, arrowTip);
                    ctx.lineTo(6, arrowY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, arrowTip, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Diseño Visual Divisores (Fallback)
                ctx.fillStyle = cell.type === 'splitter2' ? '#4f46e5' : '#7e22ce';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(-15, 0); ctx.lineTo(0, 0);
                if (cell.type === 'splitter2') {
                    ctx.moveTo(0, 0); ctx.lineTo(0, -15); ctx.moveTo(0, 0); ctx.lineTo(0, 15);
                    ctx.moveTo(-5, -10); ctx.lineTo(0, -15); ctx.lineTo(5, -10);
                    ctx.moveTo(-5, 10); ctx.lineTo(0, 15); ctx.lineTo(5, 10);
                } else {
                    ctx.moveTo(0, 0); ctx.lineTo(0, -15); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 15);
                    ctx.moveTo(-5, -10); ctx.lineTo(0, -15); ctx.lineTo(5, -10);
                    ctx.moveTo(-5, 10); ctx.lineTo(0, 15); ctx.lineTo(5, 10);
                    ctx.moveTo(10, -5); ctx.lineTo(15, 0); ctx.lineTo(10, 5);
                }
                ctx.stroke();
            }

        } else if (cell.type === 'generator') {
            let spriteName = 'miner_basic';
            if (cell.config === 'ore_diamond' || cell.config === 'ore_gold') spriteName = 'miner_drill';

            if (SPRITES[spriteName]) {
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#a6e3a1';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#11111b';
                ctx.font = 'bold 24px font-mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('M', 0, 0);
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.fillStyle = '#2e3440';
                ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(28, 0); ctx.lineTo(18, 6); ctx.fill();
            }
        } else if (cell.type === 'seller') {
            let spriteName = 'chest_iron';
            if (state.money > 50000) spriteName = 'chest_gold';
            else if (state.money < 1000) spriteName = 'chest_wood';

            if (SPRITES[spriteName]) {
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#f38ba8';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#11111b'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('$', 0, 0);
            }
        } else if (cell.type === 'smelter') {
            let spriteName = (cell.timer > 0) ? 'furnace_iron_on' : 'furnace_iron';
            if (cell.config === 'smelt_silicon' || cell.config === 'smelt_gold') {
                spriteName = 'furnace_mega';
            } else if (cell.config === 'smelt_aluminum') {
                spriteName = 'furnace_industrial';
            }

            if (SPRITES[spriteName]) {
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#fab387';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#11111b'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('H', 0, -5);
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.fillStyle = '#2e3440';
                ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(28, 0); ctx.lineTo(18, 6); ctx.fill();
            }
            // Progress bar overlay
            if (cell.timer > 0 && RECIPES[cell.config]) {
                const speedMult = Math.pow(1.4, cell.upgradeLevel || 0);
                const actualTime = RECIPES[cell.config].time / speedMult;
                let p = Math.min(cell.timer / actualTime, 1.0);
                ctx.fillStyle = '#11111b'; ctx.fillRect(-15, 12, 30, 4);
                ctx.fillStyle = '#a6e3a1'; ctx.fillRect(-15, 12, 30 * p, 4);
            }
        } else if (cell.type === 'crafter') {
            let spriteName = 'assembler_basic';
            if (cell.config === 'craft_quantum' || cell.config === 'craft_supercomp' || cell.config === 'craft_chip_reforzado' || cell.config === 'craft_disco_cuantico' || cell.config === 'craft_agujero_cuantico') {
                spriteName = 'assembler_mega';
            } else if (cell.config === 'craft_processor' || cell.config === 'craft_motor') {
                spriteName = 'assembler_advanced';
            }

            if (SPRITES[spriteName]) {
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.drawImage(SPRITES[spriteName], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#d946ef';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#11111b'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Ens', 0, -5);
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.fillStyle = '#2e3440';
                ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(28, 0); ctx.lineTo(18, 6); ctx.fill();
            }
            if (cell.timer > 0 && RECIPES[cell.config]) {
                const speedMult = Math.pow(1.4, cell.upgradeLevel || 0);
                const actualTime = RECIPES[cell.config].time / speedMult;
                let p = Math.min(cell.timer / actualTime, 1.0);
                ctx.fillStyle = '#11111b'; ctx.fillRect(-15, 14, 30, 4);
                ctx.fillStyle = '#a6e3a1'; ctx.fillRect(-15, 14, 30 * p, 4);
            }
        } else if (cell.type === 'quantum_generator') {
            const qgSprite = 'quantic/generador_cuantico';
            if (SPRITES[qgSprite]) {
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.drawImage(SPRITES[qgSprite], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#7c3aed';
                ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('QG', 0, 0);
                ctx.rotate(DIRECTIONS[cell.dir].angle);
                ctx.fillStyle = '#2e3440';
                ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(28, 0); ctx.lineTo(18, 6); ctx.fill();
            }
            if (cell.timer > 0) {
                let p = Math.min(cell.timer / 5.0, 1.0);
                ctx.fillStyle = '#11111b'; ctx.fillRect(-15, 14, 30, 4);
                ctx.fillStyle = '#c084fc'; ctx.fillRect(-15, 14, 30 * p, 4);
            }
        }

        if (state.showBottlenecks) {
            let isBottleneck = false;
            const recipe = RECIPES[cell.config];
            if (recipe && recipe.in) {
                for (let mat in recipe.in) {
                    const has = cell.inventory[mat] || 0;
                    const req = recipe.in[mat];
                    if (has > req * 5) {
                        isBottleneck = true;
                        break;
                    }
                }
            }
            if (isBottleneck) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.fillRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(-TILE_SIZE / 2 + 4, -TILE_SIZE / 2 + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('SATURADO', 0, 0);
            }
        }
        ctx.restore();
    }

    // Items
    state.items.forEach(item => {
        const drawX = (item.x + (item.nx - item.x) * item.progress) * TILE_SIZE + TILE_SIZE / 2;
        const drawY = (item.y + (item.ny - item.y) * item.progress) * TILE_SIZE + TILE_SIZE / 2;

        ctx.save();
        ctx.translate(drawX, drawY);

        const mInfo = MATS[item.type];
        if (mInfo) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
            ctx.shadowBlur = 8;

            if (SPRITES[mInfo.sprite]) {
                ctx.drawImage(SPRITES[mInfo.sprite], -TILE_SIZE / 4, -TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);
            } else {
                ctx.fillStyle = mInfo.color;
                ctx.strokeStyle = '#11111b';
                ctx.lineWidth = 1;
                drawShape(ctx, mInfo.shape, TILE_SIZE);
            }
            ctx.shadowBlur = 0; // Resetear brillo para no afectar otros renders si acaso
        }
        ctx.restore();
    });

    // Fantasma Constructor
    if (mouseHoverX >= 0 && mouseHoverX < state.gridSize && mouseHoverY >= 0 && mouseHoverY < state.gridSize && state.tool !== 'cursor') {
        ctx.save();
        ctx.translate(mouseHoverX * TILE_SIZE + TILE_SIZE / 2, mouseHoverY * TILE_SIZE + TILE_SIZE / 2);
        ctx.globalAlpha = 0.5;

        let spriteKey = null;
        if (state.tool === 'conveyor') spriteKey = (state.buildDir % 2 === 0) ? 'belt_vertical' : 'belt_horizontal';
        if (state.tool === 'splitter2') spriteKey = 'splitter_down';
        if (state.tool === 'splitter3') spriteKey = 'splitter_up';
        if (state.tool === 'generator') spriteKey = 'miner_basic';
        if (state.tool === 'seller') spriteKey = 'chest_iron';
        if (state.tool === 'smelter') spriteKey = 'furnace_iron';
        if (state.tool === 'crafter') spriteKey = 'assembler_basic';
        if (state.tool === 'merger') spriteKey = 'splitter_down';
        if (state.tool === 'quantum_generator') spriteKey = 'quantic/generador_cuantico';

        if (state.tool === 'smart_splitter') spriteKey = 'splitter_up';

        if (spriteKey && SPRITES[spriteKey]) {
            if (state.tool !== 'seller') {
                let drawAngle = DIRECTIONS[state.buildDir].angle;
                if (state.tool === 'splitter2') drawAngle -= Math.PI / 2;
                if (state.tool === 'merger') drawAngle += Math.PI / 2;
                ctx.rotate(drawAngle);
            }
            if (state.tool === 'merger') {
                ctx.filter = 'hue-rotate(120deg) saturate(1.3)';
            } else if (state.tool === 'smart_splitter') {
                ctx.filter = 'hue-rotate(280deg) brightness(1.2)';
            }
            ctx.drawImage(SPRITES[spriteKey], -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            if (state.tool === 'merger' || state.tool === 'smart_splitter') {
                ctx.filter = 'none';
            }
        } else {
            let color = '#fff';
            if (state.tool === 'conveyor') color = '#89b4fa';
            if (state.tool === 'splitter2') color = '#4f46e5';
            if (state.tool === 'splitter3') color = '#7e22ce';
            if (state.tool === 'generator') color = '#a6e3a1';
            if (state.tool === 'seller') color = '#f38ba8';
            if (state.tool === 'smelter') color = '#fab387';
            if (state.tool === 'crafter') color = '#d946ef';
            if (state.tool === 'quantum_generator') color = '#7c3aed';
            if (state.tool === 'merger') color = '#22c55e';

            ctx.fillStyle = color;
            ctx.fillRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);

            ctx.rotate(DIRECTIONS[state.buildDir].angle);
            if (state.tool === 'conveyor') {
                ctx.strokeStyle = '#11111b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, 0); ctx.lineTo(-5, 5); ctx.moveTo(5, -5); ctx.lineTo(10, 0); ctx.lineTo(5, 5); ctx.stroke();
            } else if (state.tool.startsWith('splitter')) {
                ctx.fillStyle = '#11111b'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = '#11111b'; ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(25, 0); ctx.lineTo(5, 10); ctx.fill();
            }
        }

        ctx.restore();
    }

    // Resaltar tile seleccionado
    if (selectedTile) {
        const [gx, gy] = selectedTile.split(',').map(Number);
        ctx.save();
        ctx.translate(gx * TILE_SIZE + TILE_SIZE / 2, gy * TILE_SIZE + TILE_SIZE / 2);
        ctx.strokeStyle = '#cba6f7'; // Morado
        ctx.lineWidth = 3;

        // Efecto de pulso
        const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(203, 166, 247, ${0.1 + pulse * 0.2})`;

        ctx.fillRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(-TILE_SIZE / 2 + 1.5, -TILE_SIZE / 2 + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
        ctx.restore();
    }

    ctx.restore();
}

canvas.addEventListener('mousemove', (e) => {
    const { worldX, worldY } = getScreenToWorld(e.clientX, e.clientY);
    const g = getGridPos(worldX, worldY);
    mouseHoverX = g.gx; mouseHoverY = g.gy;
});

let lastTime = 0;
function loop(ts) {
    let dt = (ts - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = ts;

    if (!state.isPaused) {
        updateLogic(dt);
    }
    draw();
    requestAnimationFrame(loop);
}

// --- CONTROLES MÓVILES ---
window.moveSelected = function (dx, dy) {
    if (!selectedTile) return;
    const [gx, gy] = selectedTile.split(',').map(Number);
    const nx = gx + dx;
    const ny = gy + dy;
    if (nx >= 0 && nx < state.gridSize && ny >= 0 && ny < state.gridSize) {
        const nextKey = `${nx},${ny}`;
        const cell = state.map[selectedTile];
        if (!state.map[nextKey] && cell) {
            state.map[nextKey] = cell;
            delete state.map[selectedTile];
            if (cell.type === 'generator') {
                const deposit = getOreDeposit(nx, ny);
                cell.config = deposit || 'ore_iron';
            }
            selectTile(nx, ny);
            saveGameToCloud();
        }
    }
};

window.buildAtPointer = function () {
    // Construir en el centro de la vista actual o donde esté el hover
    const mx = window.innerWidth / 2;
    const my = window.innerHeight / 2;
    buildAtMouse(mx, my);
};

// --- QR SCANNER LOGIN ---
if (isMobile && !rawUser) {
    const loginOverlay = document.getElementById('mobileLoginOverlay');
    loginOverlay.classList.remove('hidden');

    const html5QrCode = new Html5Qrcode("reader");
    const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, qrConfig, (decodedText) => {
        // Formato esperado: Time: ISOString | Params: ?user=... | User: ...
        try {
            const parts = decodedText.split('|');
            const timePart = parts[0].replace('Time: ', '').trim();
            const paramPart = parts[1].replace('Params: ', '').trim();

            // Validar timestamp (máximo 60 segundos de antigüedad)
            const qrTime = new Date(timePart).getTime();
            const now = new Date().getTime();

            if (now - qrTime > 60000) {
                showToast("El código QR ha expirado. Genera uno nuevo.");
                return;
            }

            const scanParams = new URLSearchParams(paramPart);
            const user = scanParams.get('user');

            if (user) {
                html5QrCode.stop();
                localStorage.setItem('factory_user', user);
                window.location.href = window.location.pathname + "?user=" + user;
            }
        } catch (e) {
            console.error("Error procesando QR", e);
        }
    });
}

updateUI();
requestAnimationFrame((ts) => { lastTime = ts; loop(ts); });
