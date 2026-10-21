/* Лицо Луры v4 — «живая мультяшка».
 *
 * Глаз — замкнутый контур из N точек с «веками»: верх t и низ b (отрицательное значение выгибает половину
 * в обратную сторону). Кольцо из макета непрерывно перетекает в дугу «∩» (улыбка глазами), «∪» (сон),
 * полоску (моргание) и смешивается с особыми формами: сердце, звезда, крестик, спираль, «> <», «^», ромб.
 * Без бровей и зрачков: всё выражают форма глаз, рот, ресницы, голова, частицы и ритм.
 *
 * Как в анимационном кино:
 * - параметры живут на пружинах; цель = эмоция + жест (клип) + режим (слушает/думает) + «жизнь» (дыхание);
 * - смена эмоции — в три фазы: замах (anticipation) → перелёт (overshoot) → успокоение; у каждой эмоции
 *   своя «физика» (радость — мягче и с перелётом, грусть — тяжелее, злость — резче);
 * - сжатие-растяжение с сохранением объёма, ресницы догоняют голову (follow-through), взгляд — по дугам;
 * - моргание: быстро закрыть, чуть подержать, открыть с перелётом; двойное, медленное, «хлоп-хлоп»,
 *   асимметричное, при смене взгляда;
 * - рот проговаривает гласные (а/о/у/и) с паузами на знаках препинания;
 * - без дела скучает, зевает, напевает, потом засыпает; касания — буп, подмигивание, хихиканье,
 *   «ай» по глазу, растягивание пальцем, щекотка, головокружение.
 */

const NS = "http://www.w3.org/2000/svg";
const N = 72;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Геометрия макета в координатах viewBox 0 0 1000 640 (центр лица — 500×330).
const C = { x: 500, y: 330 };
const EYE = [{ x: 323.1, y: 315.5 }, { x: 677.0, y: 315.5 }];
const MOUTH = { x: 500, y: 473 };
// Ресницы левого глаза: угол корня на контуре, направление (градусы, экранные координаты), длина.
const LASHES = [
  { root: 223.3, dir: 213.3, len: 94, flex: 0.7 },
  { root: 203.9, dir: 198.7, len: 92.5, flex: 1 },
  { root: 188.2, dir: 183.4, len: 92.6, flex: 1.3 },
];

// Нейтральное лицо = макет. Всё, что меняет эмоция или жест, — здесь.
const P0 = {
  ew: 112, et: 136, eb: 136, sw: 32,
  lw: 1, rw: 1, lt: 1, rt: 1, lb: 1, rb: 1, lidL: 0, lidR: 0,
  rot: 0, edx: 0, edy: 0, sep: 0,
  heart: 0, star: 0, cross: 0, spiral: 0, chev: 0, caret: 0, diamond: 0,
  mw: 66, mct: 26, mcb: 26, mwave: 0, mfreq: 2, mskew: 0, mdx: 0, mdy: 0, mfill: 0, msw: 17.5,
  mcat: 0, mround: 0, mtri: 0, mtongue: 0, mtx: 0, cheek: 0,
  lash: 0, lashL: 0, lashR: 0, lashLen: 1, lashCurl: 0, lashA: 1,
  tilt: 0, hx: 0, hy: 0, scale: 1,
  blush: 0, tears: 0, sweat: 0, sparkle: 0, hearts: 0, zz: 0, quest: 0, vein: 0,
  notes: 0, steam: 0, orbit: 0, tilde: 0, bang: 0, splash: 0, flame: 0, dream: 0, confetti: 0,
  aura: 0.34, auraSize: 1,
  bounce: 0, bounceHz: 1.6, tremble: 0, sway: 0.25, nod: 0, wobble: 0, spin: 0,
};

// Пружины по группам: глаза и рот — быстрые с перелётом, ресницы — упругие, фон и поведение — мягкие.
const SPRING = { k: 170, z: 0.62 };
const SPRINGS = {};
for (const key of ["ew", "et", "eb", "lw", "rw", "lt", "rt", "lb", "rb", "lidL", "lidR", "rot", "edx", "edy", "sep", "sw"]) {
  SPRINGS[key] = { k: 230, z: 0.56 };
}
for (const key of ["mw", "mct", "mcb", "mwave", "mskew", "mdx", "mdy", "mfill", "msw", "mfreq", "mcat", "mround", "mtri",
  "mtongue", "mtx", "cheek"]) SPRINGS[key] = { k: 260, z: 0.6 };
for (const key of ["lash", "lashL", "lashR", "lashLen", "lashCurl", "lashA"]) SPRINGS[key] = { k: 190, z: 0.42 };
for (const key of ["heart", "star", "cross", "spiral", "chev", "caret", "diamond"]) SPRINGS[key] = { k: 210, z: 0.78 };
for (const key of ["tilt", "hx", "hy", "scale"]) SPRINGS[key] = { k: 150, z: 0.58 };
const SLOW = ["blush", "tears", "sweat", "sparkle", "hearts", "zz", "quest", "vein", "notes", "steam", "orbit", "tilde", "bang",
  "splash", "flame", "dream", "confetti", "aura", "auraSize", "bounce", "bounceHz", "tremble", "sway", "nod", "wobble", "spin"];
for (const key of SLOW) SPRINGS[key] = { k: 60, z: 0.95 };
const PHYSICAL = new Set(Object.keys(P0).filter((key) => !SLOW.includes(key))); // на них влияет «физика» эмоции

/* Замах перед эмоцией (anticipation): короткий клип в обратную сторону, через lead секунд — сама эмоция. */
const INTRO = {
  crouch: { lead: 0.12, frames: [[0, {}], [0.07, { hy: 12, scale: -0.045, et: -30, eb: -22 }], [0.12, { hy: 9, scale: -0.035 }], [0.2, {}]] },
  jump: { lead: 0.13, after: "hop", frames: [[0, {}], [0.08, { hy: 16, scale: -0.06, et: -34, eb: -26 }], [0.13, { hy: 12 }], [0.18, {}]] },
  gasp: { lead: 0.1, frames: [[0, {}], [0.05, { scale: -0.07, et: -70, eb: -64 }], [0.1, { scale: -0.05, et: -40 }], [0.16, {}]] },
  lean: { lead: 0.1, frames: [[0, {}], [0.08, { tilt: -6, hx: -10 }], [0.16, {}]] },
  puff: { lead: 0.09, frames: [[0, {}], [0.07, { scale: 0.035, sw: 3, hy: -4 }], [0.14, {}]] },
  sink: { lead: 0, frames: [[0, {}], [0.3, { hy: -4 }], [0.5, {}]] },
};

/* Жесты (клипы): добавки к целям пружин по ключевым кадрам [время, {параметр: добавка}]; события — [время, имя]. */
const CLIPS = {
  hop: { frames: [[0, {}], [0.11, { hy: -48, scale: 0.05 }], [0.2, { hy: -52, scale: 0.04 }], [0.34, { hy: 5, scale: -0.04 }],
    [0.48, {}]], events: [[0, "stretch"], [0.3, "land"]] },
  yawn: { frames: [[0, {}], [0.3, { hy: -10, tilt: -5, mw: -24, mct: -48, mcb: 40, mround: 0.85, mfill: 0.35, chev: 0.85,
    scale: 0.025 }], [1.15, { hy: -12, tilt: -6, mw: -24, mct: -50, mcb: 42, mround: 0.85, mfill: 0.35, chev: 0.85, scale: 0.03 }],
    [1.5, { hy: 3 }], [1.7, {}]] },
  ack: { frames: [[0, {}], [0.1, { hy: 11, tilt: 2 }], [0.22, { hy: -3 }], [0.36, {}]], events: [[0.04, "blink"]] },
  giggle: { frames: [[0, {}], [0.08, { hy: -9, et: -46, eb: -40, mcat: 0.6 }], [0.16, { hy: 0, et: -46, eb: -40, mcat: 0.6 }],
    [0.24, { hy: -8, et: -46, eb: -40, mcat: 0.6 }], [0.32, { hy: 0, et: -46, eb: -40, mcat: 0.6 }],
    [0.4, { hy: -6, et: -46, eb: -40, mcat: 0.6 }], [0.5, { et: -30, eb: -26 }], [0.7, {}]] },
  hmm: { frames: [[0, {}], [0.18, { mwave: 5, mdx: 12, mw: -12, mfreq: 1 }], [0.45, { mwave: 4, mdx: 10, mw: -10 }], [0.7, {}]] },
  wow: { frames: [[0, {}], [0.1, { ew: 14, et: 26, eb: 22, scale: 0.035, mround: 0.6, mw: -30 }],
    [0.6, { ew: 12, et: 22, eb: 20, mround: 0.5, mw: -26 }], [0.9, {}]] },
  sigh: { frames: [[0, {}], [0.3, { hy: -7, scale: 0.02 }], [0.75, { hy: 9, scale: -0.02, et: -24 }], [1.0, {}]] },
  shake: { frames: [[0, {}], [0.08, { hx: -16, tilt: -3 }], [0.18, { hx: 14, tilt: 3 }], [0.28, { hx: -10 }], [0.38, { hx: 6 }], [0.5, {}]] },
  lick: { frames: [[0, {}], [0.15, { mtongue: 0.35, mtx: -1.3 }], [0.4, { mtongue: 0.35, mtx: 0.2 }], [0.6, {}]] },
  purr: { frames: [[0, {}], [0.25, { hy: 5, tilt: 2 }], [0.6, {}]] },
  peek: { frames: [[0, {}], [0.5, {}]], events: [[0, "peek"]] },
  ouch: { frames: [[0, {}], [0.06, { scale: -0.05, hy: 6 }], [0.3, { scale: -0.02 }], [0.45, {}]] },
};

/* Эмоции: цели параметров + взгляд + моргание + замах + «физика» + фоновый мотив + слово для табло.
 * Слегка преувеличенные — как у мультяшного персонажа: лицо должно читаться с одного взгляда. */
export const EMOTIONS = {
  calm: { label: "Спокойна", word: "СПОКОЙНА", p: {}, gaze: "idle" },
  warm: { label: "Тепло", word: "ТЕПЛО", gaze: "idle", intro: "crouch", physics: { k: 0.9, z: 0.04 },
    p: { et: 126, eb: 106, mw: 74, mct: 31, mcb: 31, blush: 0.6, aura: 0.5, lashCurl: 0.25, lash: 4, tilt: -3,
      sway: 0.45 } },
  happy: { label: "Счастлива", word: "СЧАСТЛИВА", gaze: "idle", intro: "crouch", physics: { k: 1, z: -0.06 },
    p: { et: 134, eb: 58, mw: 82, mct: 30, mcb: 46, mfill: 0.15, aura: 0.62, lash: 8, blush: 0.35, bounce: 0.35,
      bounceHz: 1.4 } },
  joy: { label: "Радуется", word: "РАДУЕТСЯ", gaze: "center", kick: 1.3, intro: "jump", physics: { k: 1.05, z: -0.1 },
    overshoot: 0.25,
    p: { et: 124, eb: -100, ew: 116, mw: 94, mct: 8, mcb: 74, mfill: 1, sparkle: 1, aura: 0.9, lash: 12,
      lashLen: 1.1, scale: 1.04, blush: 0.45, bounce: 1, bounceHz: 2.1 } },
  playful: { label: "Игривая", word: "ИГРИВАЯ", gaze: "side", intro: "lean", physics: { k: 1.05, z: -0.08 },
    p: { rt: 0.95, rb: -0.85, mskew: 18, mw: 72, mct: 18, mcb: 34, mfill: 0.25, tilt: 7, blush: 0.25, lash: 6,
      lashR: 6, sway: 0.6, mcat: 0.25 } },
  sarcastic: { label: "Язвит", word: "ЯЗВИТ", gaze: "roll", intro: "lean",
    p: { lt: 0.32, rt: 0.32, lb: 0.92, rb: 0.92, mskew: 24, mct: 6, mcb: 6, mw: 58, mdx: 16, tilt: -5, lashL: -8,
      lashR: 14, lidR: 0.15 } },
  surprised: { label: "Удивлена", word: "УДИВЛЕНА", gaze: "center", blink: 0.25, kick: 1.7, intro: "gasp", flutter: true,
    physics: { k: 1.25, z: -0.08 }, overshoot: 0.2,
    p: { ew: 126, et: 164, eb: 160, lash: 18, lashLen: 1.2, mw: 22, mct: -24, mcb: 26, mround: 0.75, mdy: 14, scale: 1.06,
      aura: 0.62, sep: 8 } },
  sad: { label: "Грустит", word: "ГРУСТИТ", gaze: "down", blink: 0.7, blinkSpeed: 0.55, intro: "sink",
    physics: { k: 0.65, z: 0.1 },
    p: { rot: -0.2, et: 110, eb: 128, edy: 14, mct: -18, mcb: -18, mw: 50, mdy: 12, lash: -20, lashCurl: -0.2,
      tilt: 4, hy: 10, aura: 0.16, sway: 0.15 } },
  worried: { label: "Волнуется", word: "ВОЛНУЕТСЯ", gaze: "darting", blink: 1.5,
    p: { rot: -0.13, ew: 116, et: 148, eb: 142, mct: -6, mcb: 2, mwave: 7, mfreq: 2.2, mw: 46, sweat: 1, lash: 8,
      aura: 0.3, tremble: 0.15 } },
  hurt: { label: "Обижена", word: "ОБИЖЕНА", gaze: "downside", blink: 0.8, blinkSpeed: 0.7, intro: "sink",
    physics: { k: 0.75, z: 0.06 },
    p: { rot: -0.22, et: 98, eb: 124, edy: 12, mct: -14, mcb: -4, mwave: 4, mfreq: 2, mw: 40, mdx: -8, tears: 0.35,
      lash: -22, tilt: 7, aura: 0.14 } },
  irritated: { label: "Раздражена", word: "РАЗДРАЖЕНА", gaze: "side", intro: "puff", physics: { k: 1.2, z: 0.02 },
    motif: { every: [3, 5], clip: "steam" },
    p: { rot: 0.13, lt: 0.42, rt: 0.42, eb: 116, mct: -3, mcb: -3, mw: 50, mskew: -9, lash: -12, aura: 0.28,
      sw: 34 } },
  angry: { label: "Злится", word: "ЗЛИТСЯ", gaze: "center", blink: 0.5, kick: 1.4, intro: "puff", physics: { k: 1.4, z: 0.04 },
    motif: { every: [2, 3.5], clip: "steam" },
    p: { rot: 0.32, lt: 0.24, rt: 0.24, eb: 102, ew: 108, mct: -16, mcb: 4, mwave: 6, mfreq: 6, mw: 60, vein: 1,
      lash: -30, lashLen: 1.12, aura: 0.5, sw: 37, scale: 1.03, tremble: 0.7 } },
  sleepy: { label: "Сонная", word: "СОННАЯ", gaze: "down", blink: 0.35, blinkSpeed: 0.45, physics: { k: 0.6, z: 0.15 },
    motif: { every: [9, 14], clip: "yawn" },
    p: { lt: 0.12, rt: 0.12, lb: 0.9, rb: 0.9, mw: 28, mct: 2, mcb: 16, lash: -14, zz: 0.55, aura: 0.14, nod: 1,
      sway: 0.1 } },
  sleeping: { label: "Спит", word: "СПИТ", gaze: "center", blink: 0, physics: { k: 0.55, z: 0.2 },
    p: { et: -30, eb: 30, mw: 15, mct: -9, mcb: 11, zz: 1, lash: -24, aura: 0.1, sway: 0.05 } },
  thinking: { label: "Думает", word: "ДУМАЕТ", gaze: "up", intro: "lean", motif: { every: [1.4, 2], clip: "hmm" },
    p: { lt: 0.78, mw: 34, mskew: 14, mdx: 22, mct: 4, mcb: 4, tilt: -7, lash: 4 } },
  love: { label: "Влюблена", word: "ВЛЮБЛЕНА", gaze: "center", kick: 1.1, intro: "crouch", physics: { k: 0.95, z: -0.05 },
    p: { heart: 1, ew: 120, blush: 0.85, hearts: 1, mw: 72, mct: 30, mcb: 42, mfill: 0.2, aura: 0.85, lashA: 0.55,
      bounce: 0.45, bounceHz: 1.3, scale: 1.03 } },
  shy: { label: "Смущена", word: "СМУЩЕНА", gaze: "downside", intro: "sink",
    p: { ew: 100, et: 116, eb: 90, blush: 1, mw: 34, mwave: 3, mct: 10, mcb: 10, tilt: 9, hy: 12, lash: -6,
      scale: 0.97 } },
  excited: { label: "В восторге", word: "В ВОСТОРГЕ", gaze: "center", kick: 1.5, intro: "jump", physics: { k: 1.1, z: -0.12 },
    overshoot: 0.3,
    p: { star: 1, ew: 122, mw: 88, mct: 8, mcb: 66, mfill: 1, sparkle: 1, aura: 1, scale: 1.07, lash: 16,
      bounce: 1.3, bounceHz: 2.6, lashA: 0.8 } },
  confused: { label: "Растеряна", word: "РАСТЕРЯНА", gaze: "idle", intro: "lean",
    p: { lw: 1.14, rw: 0.86, lt: 1.12, rt: 0.8, mwave: 8, mfreq: 2.5, mw: 48, mct: 2, mcb: 6, tilt: 10, quest: 1,
      lashL: 8, lashR: -8 } },
  proud: { label: "Гордится", word: "ГОРДИТСЯ", gaze: "center", intro: "puff",
    p: { eb: -102, et: 112, mw: 72, mskew: 10, mct: 24, mcb: 24, hy: -16, tilt: -7, lash: 14, aura: 0.62,
      scale: 1.04, sparkle: 0.25 } },
  scared: { label: "Испугалась", word: "ИСПУГАЛАСЬ", gaze: "darting", kick: 1.2, intro: "gasp", blink: 1.6,
    physics: { k: 1.3, z: -0.04 },
    p: { ew: 92, et: 152, eb: 150, sw: 29, scale: 0.9, mw: 40, mct: -8, mcb: 18, mwave: 8, mfreq: 3.5, sweat: 1,
      lash: 24, aura: 0.24, tremble: 1, sep: -10 } },
  bored: { label: "Скучает", word: "СКУЧАЕТ", gaze: "sidedown", blink: 0.6, blinkSpeed: 0.6, physics: { k: 0.7, z: 0.1 },
    motif: { every: [10, 16], clip: "yawn" },
    p: { lt: 0.18, rt: 0.18, eb: 108, mw: 40, mct: 0, mcb: 0, mdx: -10, aura: 0.14, sway: 0.2 } },
  curious: { label: "Любопытно", word: "ЛЮБОПЫТНО", gaze: "idle", intro: "lean",
    p: { lw: 1.1, rw: 0.94, lt: 1.06, rt: 0.82, mw: 18, mct: -10, mcb: 14, mround: 0.5, tilt: -11, lash: 10, lashL: 6 } },
  laugh: { label: "Хохочет", word: "ХОХОЧЕТ", gaze: "center", kick: 1.3, intro: "crouch", physics: { k: 1.1, z: -0.1 },
    p: { chev: 1, mw: 98, mct: 6, mcb: 80, mfill: 1, sparkle: 0.5, aura: 0.92, scale: 1.04, lashA: 0.65,
      bounce: 1.6, bounceHz: 4.2, blush: 0.3 } },
  crying: { label: "Плачет", word: "ПЛАЧЕТ", gaze: "down", blink: 0.9, blinkSpeed: 0.6, intro: "sink",
    physics: { k: 0.7, z: 0.06 },
    p: { rot: -0.22, et: 104, eb: 120, edy: 14, mct: -14, mcb: 14, mwave: 6, mfreq: 2.5, mfill: 0.55, mw: 52,
      mdy: 12, lash: -22, tilt: 4, hy: 10, tears: 1, tremble: 0.3, aura: 0.14 } },
  wink: { label: "Подмигивает", word: "ПОДМИГИВАЕТ", gaze: "center", intro: "lean",
    p: { rt: 0.92, rb: -0.86, mskew: 12, mw: 76, mct: 28, mcb: 36, mfill: 0.15, tilt: 5, sparkle: 0.35,
      lashR: 10 } },
  dizzy: { label: "Кружится", word: "КРУЖИТСЯ", gaze: "center", blink: 0,
    p: { spiral: 1, mwave: 9, mfreq: 2, mw: 50, mct: 2, mcb: 8, lashA: 0.45, wobble: 1, spin: 1, orbit: 1 } },
  focused: { label: "Собрана", word: "СОБРАНА", gaze: "center",
    p: { et: 114, eb: 114, ew: 106, mw: 46, mct: 9, mcb: 9, lash: 8, aura: 0.45, sep: -6 } },
  listening: { label: "Слушает", word: "СЛУШАЕТ", gaze: "center",
    p: { ew: 116, et: 142, eb: 140, mw: 30, mct: 12, mcb: 12, tilt: -7, lash: 6 } },

  delighted: { label: "Умилена", word: "МИЛО", gaze: "center", intro: "crouch",
    p: { et: 125, eb: -88, mw: 54, mct: 25, mcb: 38, blush: .85, hearts: .4, sway: .5 } },
  relieved: { label: "Выдохнула", word: "УФФ", gaze: "down", blinkSpeed: .65,
    p: { et: 80, eb: -48, mw: 52, mct: 18, mcb: 18, tilt: -3, sway: .3 } },
  skeptical: { label: "Сомневается", word: "СЕРЬЁЗНО?", gaze: "side", intro: "lean",
    p: { lt: .35, rt: .78, mw: 42, mct: 0, mcb: 0, mskew: 14, tilt: -8, lashR: 12 } },
  mischievous: { label: "Шалит", word: "ХИ-ХИ", gaze: "side", intro: "lean",
    p: { lt: .6, rt: .9, mw: 62, mct: 20, mcb: 30, mskew: 16, mcat: .3, blush: .4, tilt: 6 } },
  anticipates: { label: "Предвкушает", word: "ЖДУ", gaze: "center", intro: "crouch",
    p: { et: 150, eb: 125, mw: 50, mct: 12, mcb: 28, sparkle: .45, blush: .3, bounce: .3 } },
  tender: { label: "Нежная", word: "РЯДОМ", gaze: "center", blinkSpeed: .7,
    p: { et: 108, eb: 70, mw: 60, mct: 26, mcb: 26, blush: .65, tilt: -5, sway: .3 } },
  inquisitive: { label: "Исследует", word: "ИНТЕРЕСНО", gaze: "idle", intro: "lean",
    p: { lt: 1.1, rt: .85, mw: 28, mct: 0, mcb: 14, quest: .5, tilt: 10, lashL: 10 } },
  daydream: { label: "Мечтает", word: "МЕЧТАЕТ", gaze: "up", blinkSpeed: .7,
    p: { et: 115, eb: 84, mw: 60, mct: 23, mcb: 23, blush: .5, sway: .7, tilt: -6 } },
  reconciled: { label: "Помирились", word: "МИР", gaze: "center", intro: "crouch",
    p: { et: 110, eb: -78, mw: 65, mct: 24, mcb: 36, blush: .7, hearts: .3, sway: .4 } },
  // ----- новые -----
  cozy: { label: "Мурчит", word: "МУРЧИТ", gaze: "center", blink: 0.5, blinkSpeed: 0.6, intro: "crouch",
    physics: { k: 0.75, z: 0.08 }, motif: { every: [1.8, 2.6], clip: "purr" },
    p: { et: 120, eb: -96, mcat: 1, mw: 44, mct: 6, mcb: 6, blush: 0.85, tilde: 0.8, sway: 0.6, lash: 6, lashCurl: 0.3,
      aura: 0.6, tilt: -4 } },
  giggle: { label: "Хихикает", word: "ХИХИКАЕТ", gaze: "center", kick: 1.1, intro: "crouch", physics: { k: 1.1, z: -0.08 },
    motif: { every: [0.9, 1.4], clip: "giggle" },
    p: { et: 90, eb: -70, ew: 104, mcat: 0.7, mw: 40, mct: 10, mcb: 16, mfill: 0.2, bounce: 0.7, bounceHz: 4, blush: 0.4,
      lashA: 0.8, aura: 0.7 } },
  pout: { label: "Дуется", word: "ДУЕТСЯ", gaze: "sideglance", intro: "puff", motif: { every: [2, 3], clip: "peek" },
    physics: { k: 0.9, z: 0.04 },
    p: { ew: 104, et: 120, eb: 120, lidL: 0.25, lidR: 0.25, mw: 36, mct: -7, mcb: -7, mround: 0, cheek: 0, blush: 0.9,
      hx: -20, tilt: 8, lash: -6, aura: 0.3 } },
  determined: { label: "Решительна", word: "РЕШИТЕЛЬНА", gaze: "center", intro: "puff", physics: { k: 1.3, z: 0.05 },
    p: { diamond: 0.55, ew: 106, et: 104, eb: 110, rot: 0.12, mw: 56, mct: 2, mcb: 2, msw: 19, flame: 0.8, scale: 1.05,
      hy: -4, lash: -10, aura: 0.7 } },
  laughcry: { label: "Плачет от смеха", word: "ДО СЛЁЗ", gaze: "center", kick: 1.3, intro: "crouch",
    physics: { k: 1.1, z: -0.1 },
    p: { chev: 1, mw: 98, mct: 6, mcb: 80, mfill: 1, splash: 1, tears: 0.6, bounce: 1.4, bounceHz: 4.2, tremble: 0.3,
      aura: 0.92, lashA: 0.65, blush: 0.35 } },
  shocked: { label: "Ошарашена", word: "ОШАРАШЕНА", gaze: "center", blink: 0.15, kick: 1.8, intro: "gasp", freeze: 0.6,
    flutter: true, physics: { k: 1.4, z: -0.1 }, overshoot: 0.3,
    p: { ew: 130, et: 168, eb: 166, sw: 26, mw: 22, mct: -28, mcb: 28, mround: 1, mfill: 0.15, bang: 1, scale: 1.07,
      sep: 10, lash: 22, lashLen: 1.2, tremble: 0.35, aura: 0.6 } },
  dreamy: { label: "Мечтает", word: "МЕЧТАЕТ", gaze: "dreamup", blink: 0.4, blinkSpeed: 0.5, physics: { k: 0.7, z: 0.1 },
    p: { lt: 0.45, rt: 0.45, eb: 110, mw: 50, mct: 18, mcb: 18, dream: 1, sway: 0.5, wobble: 0.22, blush: 0.4,
      lashCurl: 0.3, lash: 4, aura: 0.5 } },
  sly: { label: "Хитрая", word: "ХИТРИТ", gaze: "slide", intro: "lean",
    p: { lidL: 0.75, lidR: 0.3, rot: 0.06, ew: 108, et: 110, eb: 92, mskew: 30, mct: 12, mcb: 16, mw: 52, mdx: 18, tilt: -6,
      lashL: -6, lashR: 10, aura: 0.45 } },
  yum: { label: "Вкусно", word: "ВКУСНО", gaze: "center", intro: "crouch", motif: { every: [1.5, 2.4], clip: "lick" },
    p: { et: 124, eb: -100, mw: 52, mct: 22, mcb: 30, mtongue: 1, mtx: 0.7, blush: 0.5, bounce: 0.3, bounceHz: 1.6,
      aura: 0.6 } },
  oops: { label: "Ой", word: "ОЙ", gaze: "darting", intro: "gasp", blink: 1.4,
    p: { ew: 118, et: 150, eb: 148, mwave: 7, mfreq: 3, mw: 40, mct: 2, mcb: 6, sweat: 1, scale: 0.94, hy: 6, lash: 10,
      aura: 0.35 } },
  tired: { label: "Устала", word: "УСТАЛА", gaze: "down", blink: 0.55, blinkSpeed: 0.45, intro: "sink",
    physics: { k: 0.65, z: 0.12 }, motif: { every: [6, 10], clip: "yawn" },
    p: { lt: 0.3, rt: 0.3, eb: 120, ew: 108, mw: 34, mct: -4, mcb: -2, hy: 8, sway: 0.15, lash: -12, aura: 0.2 } },
  party: { label: "Праздник", word: "ПРАЗДНИК", gaze: "center", kick: 1.5, intro: "jump", physics: { k: 1.1, z: -0.12 },
    overshoot: 0.3,
    p: { star: 0.8, ew: 120, mw: 90, mct: 8, mcb: 66, mfill: 1, confetti: 1, sparkle: 0.6, aura: 1, scale: 1.06, lash: 14,
      bounce: 1.1, bounceHz: 2.4 } },
};

// ----- формы глаз (в единичных координатах; старт — восток, по часовой, как у основы) -----

function sampleHeart() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const u = (i / N) * TAU + Math.PI / 2;
    const x = 16 * Math.sin(u) ** 3;
    const y = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
    out.push([x / 16, (y - 2.5) / 14.5]);
  }
  return out;
}

function sampleStar() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const r = 0.34 + 0.66 * Math.abs(Math.cos(2 * a)) ** 6;
    out.push([r * Math.cos(a), r * Math.sin(a) * 1.08]);
  }
  return out;
}

function alongPolyline(vertices) {
  // N точек, равномерно по длине ломаной
  const seg = [];
  let total = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    seg.push(len);
    total += len;
  }
  const out = [];
  for (let i = 0; i < N; i++) {
    let d = (i / N) * total;
    let j = 0;
    while (j < seg.length - 1 && d > seg[j]) {
      d -= seg[j];
      j++;
    }
    const f = seg[j] ? d / seg[j] : 0;
    const [x1, y1] = vertices[j];
    const [x2, y2] = vertices[j + 1];
    out.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]);
  }
  return out;
}

const CROSS = alongPolyline([[0, 0], [0.62, 0.62], [0, 0], [-0.62, 0.62], [0, 0], [-0.62, -0.62], [0, 0],
  [0.62, -0.62], [0, 0]]);
const CHEV = alongPolyline([[-0.62, -0.72], [0.66, 0], [-0.62, 0.72], [0.66, 0], [-0.62, -0.72]]);
const CARET = alongPolyline([[0.78, 0.3], [0, -0.42], [-0.78, 0.3], [0, -0.42], [0.78, 0.3]]); // «^» — туда и обратно
const DIAMOND = alongPolyline([[0.82, 0], [0, 0.56], [-0.82, 0], [0, -0.56], [0.82, 0]]);
const HEART = sampleHeart();
const STAR = sampleStar();

function spiralAt(phase) {
  const out = [];
  const half = N / 2;
  for (let i = 0; i < N; i++) {
    const s = i < half ? i / half : (N - i) / half; // туда и обратно по той же спирали
    const a = s * TAU * 2.1 + phase;
    const r = 0.06 + s * 0.88;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

// ----- рот: формы гласных (виземы) -----

const VISEME = {
  a: { open: 1, wide: 1, round: 0 },
  o: { open: 0.8, wide: 0.62, round: 0.9 },
  u: { open: 0.45, wide: 0.42, round: 1 },
  i: { open: 0.32, wide: 1.15, round: 0 },
  m: { open: 0, wide: 0.95, round: 0 },
  rest: { open: 0, wide: 1, round: 0 },
};
const VOWEL = { а: "a", я: "a", о: "o", ё: "o", у: "u", ю: "u", и: "i", ы: "i", е: "i", э: "i",
  a: "a", o: "o", u: "u", i: "i", e: "i", y: "i" };
const LABIAL = new Set(["б", "п", "м", "в", "ф", "b", "p", "m", "v", "f"]);

/** Текст → очередь слогов для рта (≈10 слогов в секунду, паузы на знаках). */
function syllables(text) {
  const out = [];
  for (const ch of String(text).toLowerCase()) {
    if (VOWEL[ch]) out.push({ shape: VOWEL[ch], ms: 78 });
    else if (LABIAL.has(ch)) out.push({ shape: "m", ms: 26 });
    else if (ch === "," || ch === "—" || ch === ":" || ch === ";") out.push({ shape: "rest", ms: 120 });
    else if (ch === "." || ch === "!" || ch === "?" || ch === "…" || ch === "\n") out.push({ shape: "rest", ms: 220 });
  }
  return out;
}

// ----- утилиты -----

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const f1 = (v) => Math.round(v * 10) / 10;
const smooth = (t) => t * t * (3 - 2 * t);

function smoothClosed(points) {
  // Catmull-Rom → кубические Безье, замкнутый контур
  const n = points.length;
  let d = `M${f1(points[0][0])},${f1(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + "Z";
}

function smoothOpen(points) {
  let d = `M${f1(points[0][0])},${f1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
}

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// дешёвый плавный шум для дрожи и микродвижений
function noise(t, seed) {
  return Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 5.9 + seed * 4.1) * 0.2;
}

/** Время жизни частицы → масштаб «рождения»: 0 → 1.2 → 1. */
function birth(life) {
  if (life < 0.12) return lerp(0, 1.2, smooth(life / 0.12));
  if (life < 0.25) return lerp(1.2, 1, (life - 0.12) / 0.13);
  return 1 - Math.max(0, life - 0.75) * 1.6; // к концу чуть сжимается
}

let uid = 0;

export class Face {
  /**
   * @param {HTMLElement} host — контейнер; внутрь кладётся <svg>
   * @param {{small?: boolean, particles?: boolean, viewBox?: string, idle?: boolean}} options
   *   idle — скучать и засыпать без дела (только главное лицо)
   */
  constructor(host, options = {}) {
    this.small = Boolean(options.small);
    this.particlesOn = options.particles !== false && !this.small && !REDUCED;
    this.idleOn = Boolean(options.idle) && !REDUCED;
    this.id = `lura${++uid}`;
    this.x = { ...P0 };
    this.v = Object.fromEntries(Object.keys(P0).map((k) => [k, 0]));
    this.target = { ...P0 };
    this.off = Object.fromEntries(Object.keys(P0).map((k) => [k, 0])); // добавки жестов этого кадра
    this.emotion = "calm";
    this.base = "calm";
    this.baseIntensity = 0.6;
    this.reactTimer = 0;
    this.chain = []; // очередь реакций [[эмоция, мс]]
    this.time = rand(0, 100);
    this.gaze = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ax: 0, ay: 0, next: 0, follow: 0, flip: 0 };
    this.blink = { next: rand(1.2, 3.5), last: -10, eyes: [{ t: -1, hold: 0, speed: 1 }, { t: -1, hold: 0, speed: 1 }],
      queue: [] };
    this.blinkRate = 1;
    this.blinkSpeed = 1;
    this.squash = { x: 0, v: 0 };
    this.pull = { x: 0, v: 0, target: 0 }; // растягивание пальцем
    this.flap = { x: 0, v: 0 }; // ресницы догоняют голову
    this.lastHy = 0;
    this.spinPhase = 0;
    this.particles = [];
    this.spawn = {};
    this.paused = false;
    this.tapCount = 0;
    this.tapReset = 0;
    this.eyeTaps = [-10, -10];
    this.onInteraction = options.onInteraction || null;
    this.touchMood = null;
    this.nextExplore = 180;
    // поверх настроения: слушает (ты печатаешь), думает (пишет ответ), говорит (ответ пришёл)
    this.mode = "";
    this.modeAmt = 0;
    this.modeV = 0;
    this.modeTime = 0;
    this.thinkDots = 0;
    this.talk = 0;
    this.speech = []; // очередь слогов
    this.speechT = 0;
    this.vis = { open: 0, wide: 1, round: 0, vo: 0, vw: 0, vr: 0 };
    this.clips = []; // активные жесты
    this.pending = null; // эмоция после замаха
    this.lastApply = -10;
    this.freezeUntil = 0;
    this.phys = { k: 1, z: 0 };
    this.physTarget = { k: 1, z: 0 };
    this.dayK = 1; // характер дня: утром и ночью — медленнее
    this.motifAt = Infinity;
    this.idle = 0;
    this.idleMood = "";
    this.waiting = false;
    this.glanceAt = 0;
    this.onBlink = null;
    this.build(host, options.viewBox || (this.small ? "88 118 824 430" : "0 0 1000 640"));
    this.render();
    Face.all.add(this);
    Face.start();
  }

  build(host, viewBox) {
    const svg = el("svg", { viewBox, class: "lura-face", role: "img", "aria-label": "Лура" });
    const defs = el("defs", {}, svg);
    const aura = el("radialGradient", { id: `${this.id}-aura` }, defs);
    // цвет — классами из app.css (style-атрибуты запрещены CSP приложения и на телефоне не работали бы)
    el("stop", { offset: "0%", class: "aura-0" }, aura);
    el("stop", { offset: "42%", class: "aura-1" }, aura);
    el("stop", { offset: "100%", class: "aura-2" }, aura);
    const blush = el("radialGradient", { id: `${this.id}-blush` }, defs);
    el("stop", { offset: "0%", class: "blush-0" }, blush);
    el("stop", { offset: "100%", class: "blush-1" }, blush);

    this.auraEl = this.small ? null : el("ellipse", { cx: C.x, cy: C.y + 20, rx: 460, ry: 330,
      fill: `url(#${this.id}-aura)` }, svg);
    this.head = el("g", {}, svg);
    this.blushEl = EYE.map(() => el("ellipse", { rx: 112, ry: 43, fill: `url(#${this.id}-blush)`, opacity: 0 },
      this.head));
    const stroke = { fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" };
    this.eyeEl = EYE.map(() => el("path", { ...stroke }, this.head));
    this.lashEl = [];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < LASHES.length; i++) this.lashEl.push(el("path", { ...stroke, "stroke-width": 24 }, this.head));
    }
    this.mouthEl = el("path", { ...stroke, fill: "currentColor", "fill-opacity": 0 }, this.head);
    this.tongueEl = el("path", { ...stroke, "stroke-width": 12, opacity: 0 }, this.head);
    // Anime blush strokes replace the old parentheses around the mouth.
    this.cheekEl = [0, 1].map(() => el("path", { fill: "none", stroke: "var(--blush, #ff96be)",
      "stroke-width": 9, "stroke-linecap": "round", opacity: 0 }, this.head));
    // значки поверх лица
    this.sweatEl = el("path", { d: "M0,-26 C10,-10 15,0 0,14 C-15,0 -10,-10 0,-26Z", fill: "none",
      stroke: "currentColor", "stroke-width": 7, "stroke-linejoin": "round", opacity: 0 }, this.head);
    this.veinEl = el("g", { opacity: 0, fill: "none", stroke: "currentColor", "stroke-width": 9,
      "stroke-linecap": "round" }, this.head);
    for (const d of ["M-28,-8 C-18,-10 -10,-18 -8,-28", "M8,-28 C10,-18 18,-10 28,-8", "M28,8 C18,10 10,18 8,28",
      "M-8,28 C-10,18 -18,10 -28,8"]) el("path", { d }, this.veinEl);
    // «?» — контуром (без шрифта: одинаково везде)
    this.questEl = el("path", { d: "M-20,-34 C-20,-62 28,-64 28,-34 C28,-14 2,-12 2,8 M2,30 L2,31", fill: "none",
      stroke: "currentColor", "stroke-width": 13, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 },
    this.head);
    // «!!!» шока
    this.bangEl = el("g", { opacity: 0, fill: "none", stroke: "currentColor", "stroke-width": 12, "stroke-linecap": "round" },
      this.head);
    for (const [x, a] of [[-46, -14], [0, 0], [46, 14]]) {
      el("path", { d: "M0,-40 L0,-2 M0,20 L0,21", transform: `translate(${x},0) rotate(${a})` }, this.bangEl);
    }
    // «…» — думает долго
    this.dotsEl = el("g", { opacity: 0, fill: "currentColor" }, this.head);
    this.dotEls = [-34, 0, 34].map((x) => el("circle", { cx: x, cy: 0, r: 11 }, this.dotsEl));
    this.fx = el("g", {}, svg);
    this.svg = svg;
    host.appendChild(svg);
  }

  // ----- управление -----

  /** Основная эмоция (настроение). intensity 0..1 — насколько ярко. */
  setEmotion(name, { intensity = 0.8, kick = true } = {}) {
    if (!EMOTIONS[name]) name = "calm";
    this.base = name;
    this.baseIntensity = intensity;
    if (this.reactTimer <= 0 && !this.idleMood) this.apply(this.touchMood || name, intensity, kick);
  }

  /** Короткая реакция (на кнопку, касание, слово), потом — обратно к настроению. */
  react(name, ms = 1600, intensity = 0.9) {
    if (!EMOTIONS[name]) return;
    this.chain = [];
    this.reactTimer = ms / 1000;
    this.apply(name, intensity, true);
  }

  /** Несколько реакций подряд: [["dizzy", 2200], ["oops", 1200]]. */
  reactSeq(list) {
    const [first, ...rest] = list.filter(([name]) => EMOTIONS[name]);
    if (!first) return;
    this.react(first[0], first[1]);
    this.chain = rest;
  }

  apply(name, intensity, kick) {
    const emo = EMOTIONS[name];
    const intro = emo.intro && INTRO[emo.intro];
    const now = this.time;
    if (kick && !REDUCED && intro && intro.lead > 0 && name !== this.emotion && now - this.lastApply > 0.3) {
      // замах: короткое движение в обратную сторону, эмоция — следом
      this.play(intro);
      this.pending = { name, intensity, at: now + intro.lead, after: intro.after };
      this.lastApply = now;
      return;
    }
    this.lastApply = now;
    this.commit(name, intensity, kick);
    if (kick && intro?.after) this.play(CLIPS[intro.after]);
  }

  commit(name, intensity, kick) {
    const emo = EMOTIONS[name];
    const k = 0.6 + 0.55 * clamp(intensity, 0, 1);
    for (const key of Object.keys(P0)) {
      const goal = emo.p[key] ?? P0[key];
      this.target[key] = key === "bounceHz" || key === "mfreq" ? goal : P0[key] + (goal - P0[key]) * k;
    }
    this.pending = null;
    this.emotion = name;
    this.gazeMode = emo.gaze || "idle";
    this.blinkRate = emo.blink ?? 1;
    this.blinkSpeed = emo.blinkSpeed ?? 1;
    this.physTarget = { k: emo.physics?.k ?? 1, z: emo.physics?.z ?? 0 };
    this.gaze.next = 0;
    this.motifAt = emo.motif ? this.time + rand(...emo.motif.every) * 0.6 : Infinity;
    if (emo.freeze) this.freezeUntil = this.time + emo.freeze;
    if (REDUCED || !kick) return;
    // перелёт: толчок скорости к новой цели — поза «проскакивает» и пружинит назад
    const over = emo.overshoot ?? 0.12;
    for (const key of PHYSICAL) {
      const s = SPRINGS[key] || SPRING;
      this.v[key] += (this.target[key] - this.x[key]) * Math.sqrt(s.k) * over;
    }
    this.squash.v += 3.6 * (emo.kick || 1.1) * (this.small ? 0.6 : 1);
    if (emo.flutter) this.blink.queue.push(this.time + 0.4, this.time + 0.56, this.time + 0.7); // «хлоп-хлоп»
  }

  /** Жест поверх эмоции (клип — добавки к целям пружин по ключевым кадрам). */
  play(clip, { gain = 1 } = {}) {
    if (!clip || REDUCED) return;
    if (this.clips.length >= 3) this.clips.shift();
    const duration = clip.frames[clip.frames.length - 1][0];
    this.clips.push({ clip, t: 0, duration, gain, fired: new Set() });
  }

  /** Жест по имени: yawn, ack, giggle, hmm, wow, sigh, shake, lick, purr, peek, hop, steam. */
  gesture(name) {
    if (name === "steam") {
      this.spawnBurst("steam", 2);
      return;
    }
    this.play(CLIPS[name]);
  }

  /** Говорит: рот проговаривает реплику по гласным, не меняя настроения. */
  speak(text = "") {
    if (REDUCED || !text) return;
    const queue = syllables(text);
    if (!queue.length) {
      this.talk = clamp(0.4 + String(text).length * 0.03, 0.4, 1.6);
      return;
    }
    this.speech.push(...queue);
    // отстаёт от текста (длинный черновик) — говорит быстрее, но не дольше ~3 с на очередь
    const total = this.speech.reduce((sum, s) => sum + s.ms, 0);
    if (total > 3000) {
      const k = 3000 / total;
      for (const s of this.speech) s.ms = Math.max(22, s.ms * k);
    }
    this.poke();
  }

  /** Слушает, пока ты печатаешь: смотрит вниз, на поле ввода. */
  listen(on) {
    if (on) this.setMode("listen");
    else if (this.mode === "listen") this.setMode("");
  }

  /** Каждая набранная буква — маленький кивок и взгляд чуть в сторону, как будто читает. */
  keystroke() {
    this.listen(true);
    this.poke();
    this.waiting = false;
    this.gaze.tx = clamp(this.gaze.tx + rand(-0.12, 0.12), -0.35, 0.35);
    this.gaze.follow = 0;
    if (!REDUCED) this.squash.v += 0.7;
  }

  /** «Ого, сколько пишешь» — глаза шире. */
  wow() {
    this.play(CLIPS.wow);
  }

  /** «Приняла» — кивок и моргание (ты отправил сообщение). */
  ack() {
    this.poke();
    this.play(CLIPS.ack);
  }

  /** Ждёт твоего ответа — иногда поглядывает на поле ввода. */
  waitReply(on) {
    this.waiting = on;
    this.glanceAt = this.time + rand(6, 9);
  }

  /** Думает, пока пишет ответ: глаза вверх-в сторону, голова чуть набок; долго — «…» над головой. */
  think(on) {
    if (on) this.setMode("think");
    else if (this.mode === "think") this.setMode("");
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeTime = 0;
    this.gaze.next = 0;
    this.gaze.follow = 0;
    this.poke();
  }

  /** Встряхнули телефон — голова кругом, потом «ой». */
  shaken() {
    this.poke();
    this.reactSeq([["dizzy", 2200], ["oops", 1300]]);
  }

  /** Характер дня: час 0–23 → темп движений (утром и ночью — медленнее). */
  setDayHour(hour) {
    this.dayK = hour >= 23 || hour < 6 ? 0.8 : hour < 10 ? 0.88 : hour >= 20 ? 0.94 : 1;
  }

  /** Что-то произошло (касание, сообщение) — перестаёт скучать, просыпается. */
  poke() {
    this.nextExplore = 180;
    const wasIdle = this.idleMood;
    this.idle = 0;
    if (!wasIdle) return;
    this.idleMood = "";
    this.target.notes = 0;
    this.reactTimer = 0;
    if (wasIdle === "sleepy") this.reactSeq([["surprised", 650]]); // «о! я тут»
    else this.apply(this.base, this.baseIntensity, true);
  }

  lookAt(x, y, hold = 1.2) {
    this.gazeTo(x, y);
    this.gaze.follow = hold;
  }

  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    Face.start();
  }

  /** Касания: тап — «буп», серия — веселее, по глазу — «ай», долгое — гладят, тянешь вниз — растягивается,
   * щекотка — хихикает, быстрые свайпы туда-сюда — голова кругом. Ведёшь — смотрит за пальцем. */
  attach(target, { haptic } = {}) {
    let downAt = 0;
    let moved = false;
    let petTimer = 0;
    let petting = false;
    let petBeat = 0;
    let start = null;
    let last = null;
    let path = 0;
    let turns = 0;
    let lastDx = 0;
    let swipes = [];
    const rect = () => this.svg.getBoundingClientRect();
    const toView = (event) => { // экран → координаты viewBox
      const ctm = this.svg.getScreenCTM?.();
      if (!ctm || typeof DOMPoint !== "function") return null;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    };
    const look = (event) => {
      const r = rect();
      const nx = ((event.clientX - r.left) / r.width - 0.5) * 2.4;
      const ny = ((event.clientY - r.top) / r.height - 0.5) * 2.4;
      this.lookAt(nx, ny, 1.4);
    };
    target.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || downAt) return;
      target.setPointerCapture?.(event.pointerId);
      this.poke();
      downAt = performance.now();
      moved = false;
      start = { x: event.clientX, y: event.clientY };
      last = { ...start, t: downAt };
      path = 0;
      turns = 0;
      lastDx = 0;
      look(event);
      clearTimeout(petTimer);
      petTimer = setTimeout(() => {
        if (moved) return;
        petting = true;
        this.onInteraction?.("hold");
        this.react("cozy", 60000, 1); // гладят: ^^, мурчит, сердечки
        this.target.hearts = 0.6;
        this.target.tilt = this.gaze.x * 8;
        this.target.hx = this.gaze.x * 18;
        haptic?.("soft");
        // One tactile response per hold, not continuous vibration.
      }, 520);
    });
    target.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" || downAt) look(event);
      if (!downAt || !start) return;
      const now = performance.now();
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      path += Math.hypot(dx, dy);
      if (Math.abs(dx) > 3 && lastDx !== 0 && Math.sign(dx) !== Math.sign(lastDx)) turns += 1;
      if (Math.abs(dx) > 3) lastDx = dx;
      last = { x: event.clientX, y: event.clientY, t: now };
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) moved = true;
      // тянешь вниз — лицо резиново растягивается
      const down = event.clientY - start.y;
      const side = Math.abs(event.clientX - start.x);
      if (down > 12 && down > side * 1.2) {
        this.pull.target = clamp(down / 170, 0, 1);
        if (this.pull.target > 0.6 && !this.pulledFx) {
          this.pulledFx = true;
          haptic?.("light");
        }
      }
      // щекотка: много мелких движений туда-сюда
      if (turns >= 6 && path > 260 && now - downAt < 1400 && !petting && this.emotion !== "giggle") {
        this.onInteraction?.("tickle");
        this.react("giggle", 1800);
        haptic?.("light");
        turns = 0;
        path = 0;
      }
    });
    const up = (event) => {
      clearTimeout(petTimer);
      clearInterval(petBeat);
      const now = performance.now();
      if (event && this.pull.target > 0.15) this.onInteraction?.("pull");
      if (this.pull.target > 0.05) { // отпустил — пружинит с перелётом
        this.pull.v -= this.pull.target * 14;
        this.pull.target = 0;
        this.pulledFx = false;
        if (start && event && event.clientY - start.y > 120) this.reactSeq([["surprised", 500], ["giggle", 1200]]);
      }
      if (petting) {
        if (event) this.onInteraction?.("pet");
        petting = false;
        this.reactTimer = 0.01;
        this.react("happy", 1400);
      } else if (downAt && start && event) {
        const dx = event.clientX - start.x;
        const dt = now - downAt;
        if (Math.abs(dx) > 60 && dt < 280) { // свайп в сторону
          this.onInteraction?.("swipe");
          swipes = swipes.filter((t) => now - t < 1500);
          swipes.push(now);
          this.lookAt(Math.sign(dx), 0, 0.5);
          if (swipes.length >= 3) {
            swipes = [];
            this.reactSeq([["dizzy", 2200], ["oops", 1100]]);
            haptic?.("heavy");
          }
        } else if (dt < 420 && !moved) {
          this.tap(toView(event), haptic);
        }
      }
      downAt = 0;
      start = null;
    };
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", () => up(null));
    target.addEventListener("pointerleave", () => { if (!downAt) this.gaze.follow = 0; });
  }

  /** Тап: по глазу — «ай!» (моргает этим глазом, второй раз — дуется), иначе «буп» по нарастающей. */
  tap(point, haptic) {
    const region = point && EYE.some(eye => Math.hypot(point.x - eye.x, point.y - eye.y) < 130) ? "eye" : "tap";
    this.onInteraction?.(region);
    this.tapCount += 1;
    this.tapReset = 3.5;
    if (this.tapCount >= 20) {
      this.tapCount = 0;
      this.react("angry", 2500);
      this.onInteraction?.("overpoke");
      haptic?.("medium");
      return;
    }
    if (point) {
      for (let side = 0; side < 2; side++) {
        const eye = EYE[side];
        if (Math.hypot(point.x - eye.x, point.y - eye.y) < 130) {
          const now = this.time;
          if (now - this.eyeTaps[side] < 1.5) {
            this.eyeTaps[side] = -10;
            this.react("pout", 1500);
            haptic?.("medium");
          } else {
            this.eyeTaps[side] = now;
            this.blinkEye(side, 0.22);
            this.play(CLIPS.ouch);
            haptic?.("light");
          }
          return;
        }
      }
    }
    this.boop(haptic, point);
  }

  boop(haptic, point = null) {
    const n = this.tapCount;
    const pick = this.touchMood ? "angry" : n >= 16 ? "irritated" : n >= 10 ? "pout" : n >= 6 ? "giggle" : n >= 3 ? "playful" : n === 2 ? "wink"
      : ["surprised", "shy", "playful", "curious"][Math.floor(Math.random() * 4)];
    this.react(pick, 1600);
    this.squash.v -= 4.5;
    if (point) this.v.hx += (point.x - C.x) * -0.5; // голова «отскакивает» от пальца
    haptic?.(n >= 7 ? "heavy" : n >= 3 ? "medium" : "light");
  }

  // ----- кадр -----

  step(dt) {
    if (this.paused) return;
    this.time += dt;
    const t = this.time;
    if (this.pending && t >= this.pending.at) {
      const { name, intensity, after } = this.pending;
      this.commit(name, intensity, true);
      if (after) this.play(CLIPS[after]);
    }
    if (this.reactTimer > 0) {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) {
        const next = this.chain.shift();
        if (next) {
          this.reactTimer = next[1] / 1000;
          this.apply(next[0], 0.9, true);
        } else {
          this.apply(this.touchMood || this.idleMood || this.base, this.baseIntensity, true);
        }
      }
    }
    if (this.tapReset > 0) {
      this.tapReset -= dt;
      if (this.tapReset <= 0) this.tapCount = 0;
    }
    this.updateIdle(dt);
    this.updateMotif();
    this.updateClips(dt);
    // «физика» эмоции и дня перетекает плавно
    this.phys.k += (this.physTarget.k * this.dayK - this.phys.k) * Math.min(1, dt * 3);
    this.phys.z += (this.physTarget.z - this.phys.z) * Math.min(1, dt * 3);
    // пружины: цель = эмоция + жесты
    for (const key in this.x) {
      const s = SPRINGS[key] || SPRING;
      const physical = PHYSICAL.has(key);
      const k = physical ? s.k * this.phys.k : s.k;
      const z = physical ? clamp(s.z + this.phys.z, 0.3, 1.2) : s.z;
      const c = 2 * z * Math.sqrt(k);
      const goal = this.target[key] + this.off[key];
      const a = k * (goal - this.x[key]) - c * this.v[key];
      this.v[key] += a * dt;
      this.x[key] += this.v[key] * dt;
    }
    // «слушает/думает» — плавно появляется и уходит
    const goal = this.mode ? 1 : 0;
    this.modeV += (90 * (goal - this.modeAmt) - 2 * 0.9 * Math.sqrt(90) * this.modeV) * dt;
    this.modeAmt += this.modeV * dt;
    this.modeTime += dt;
    const dotsGoal = this.mode === "think" && this.modeTime > 4 ? 1 : 0;
    this.thinkDots += (dotsGoal - this.thinkDots) * Math.min(1, dt * 6);
    if (this.mode === "think" && this.modeTime > 1.4 && Math.random() < dt / 1.6) this.play(CLIPS.hmm, { gain: 0.7 });
    if (this.talk > 0) this.talk = Math.max(0, this.talk - dt);
    this.updateSpeech(dt);
    // сжатие-растяжение
    const sq = this.squash;
    sq.v += (-260 * sq.x - 2 * 0.32 * Math.sqrt(260) * sq.v) * dt;
    sq.x += sq.v * dt;
    // растягивание пальцем: пружина с перелётом
    const pl = this.pull;
    pl.v += (300 * (pl.target - pl.x) - 2 * 0.35 * Math.sqrt(300) * pl.v) * dt;
    pl.x += pl.v * dt;
    // ресницы догоняют голову
    const hy = this.x.hy;
    const vy = (hy - this.lastHy) / Math.max(dt, 0.001);
    this.lastHy = hy;
    const fl = this.flap;
    fl.v += (140 * (clamp(-vy * 0.012 - sq.v * 0.06, -1.4, 1.4) - fl.x) - 2 * 0.38 * Math.sqrt(140) * fl.v) * dt;
    fl.x += fl.v * dt;
    this.updateGaze(dt, t);
    this.updateBlink(dt);
    this.spinPhase += REDUCED ? 0 : dt * 5.5 * this.x.spin;
    if (this.particlesOn) this.updateParticles(dt, t);
    this.render();
  }

  updateClips(dt) {
    const off = this.off;
    for (const key in off) off[key] = 0;
    for (const item of this.clips) {
      item.t += dt;
      const { frames, events } = item.clip;
      for (const [at, name] of events || []) {
        if (item.t >= at && !item.fired.has(at)) {
          item.fired.add(at);
          this.clipEvent(name);
        }
      }
      let i = 0;
      while (i < frames.length - 2 && item.t > frames[i + 1][0]) i++;
      const [t0, a] = frames[i];
      const [t1, b] = frames[Math.min(i + 1, frames.length - 1)];
      const f = t1 > t0 ? smooth(clamp((item.t - t0) / (t1 - t0), 0, 1)) : 1;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in off)) continue;
        off[key] += lerp(a[key] || 0, b[key] || 0, f) * item.gain;
      }
    }
    this.clips = this.clips.filter((item) => item.t < item.duration);
  }

  clipEvent(name) {
    if (name === "blink") this.startBlink("normal");
    else if (name === "stretch") this.squash.v += 4.5;
    else if (name === "land") this.squash.v -= 5.5;
    else if (name === "peek") this.lookAt(0, 0, 0.55); // косой взгляд на человека
  }

  /** Фоновый мотив эмоции: зевок у сонной, «хм» у думающей, облизывается от вкусного… */
  updateMotif() {
    if (this.time < this.motifAt) return;
    const motif = EMOTIONS[this.emotion]?.motif;
    if (!motif) {
      this.motifAt = Infinity;
      return;
    }
    this.motifAt = this.time + rand(...motif.every);
    this.gesture(motif.clip);
  }

  /** Без дела: ждёт ответа и поглядывает на поле ввода, через 40 с скучает и зевает, через 100 с засыпает. */
  updateIdle(dt) {
    if (!this.idleOn) return;
    this.idle += dt;
    if (this.waiting && this.time > this.glanceAt && this.idle > 6) {
      this.glanceAt = this.time + rand(6, 10);
      this.lookAt(0, 0.9, 1.1);
    }
    if (this.reactTimer > 0 || this.mode) return;
    if (this.touchMood) return;
    if (this.idle > this.nextExplore && this.idle < 480) {
      this.nextExplore = this.idle + rand(25, 50);
      this.lookAt(rand(-1, 1), rand(-0.7, 1), 3);
      this.react(["inquisitive", "daydream", "mischievous"][Math.floor(Math.random() * 3)], 2800);
    }
    if (this.idle > 600 && this.idleMood !== "sleepy") {
      this.idleMood = "sleepy";
      this.target.notes = 0;
      this.apply("sleepy", 0.8, true);
    } else if (this.idle > 120 && !this.idleMood) {
      this.idleMood = "bored";
      this.apply("bored", 0.7, true);
    }
    if (this.idleMood === "bored") {
      this.target.notes = Math.sin(this.time * 0.35) > 0.75 ? 0.6 : 0; // иногда напевает
    }
  }

  /** Рот проговаривает очередь слогов; формы плавно перетекают (быстрые пружины). */
  updateSpeech(dt) {
    let goal = VISEME.rest;
    if (this.speech.length) {
      this.speechT += dt * 1000;
      while (this.speech.length && this.speechT >= this.speech[0].ms) {
        this.speechT -= this.speech[0].ms;
        this.speech.shift();
      }
      if (this.speech.length) goal = VISEME[this.speech[0].shape] || VISEME.rest;
    } else {
      this.speechT = 0;
      if (this.talk > 0) { // без текста: ритмичные «слоги»
        const s = Math.max(0, Math.sin(this.time * 15.5) * 0.65 + Math.sin(this.time * 6.1 + 1.3) * 0.35);
        goal = { open: s * 0.8, wide: 1, round: 0 };
      }
    }
    const v = this.vis;
    const k = 900;
    const c = 2 * 0.7 * Math.sqrt(k);
    v.vo += (k * (goal.open - v.open) - c * v.vo) * dt;
    v.open += v.vo * dt;
    v.vw += (k * (goal.wide - v.wide) - c * v.vw) * dt;
    v.wide += v.vw * dt;
    v.vr += (k * (goal.round - v.round) - c * v.vr) * dt;
    v.round += v.vr * dt;
  }

  /** Новая точка взгляда: по дуге (а не по прямой), при большом переводе — иногда моргает. */
  gazeTo(x, y) {
    const g = this.gaze;
    const nx = clamp(x, -1, 1);
    const ny = clamp(y, -1, 1);
    const dx = nx - g.tx;
    const dy = ny - g.ty;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05 && !REDUCED) {
      const side = Math.random() < 0.5 ? -1 : 1;
      g.ax = (-dy / dist) * dist * 0.09 * side;
      g.ay = (dx / dist) * dist * 0.09 * side;
    }
    if (dist > 0.6 && Math.random() < 0.4 && this.time - this.blink.last > 0.6) this.startBlink("normal");
    g.tx = nx;
    g.ty = ny;
  }

  updateGaze(dt, t) {
    const g = this.gaze;
    if (g.follow > 0) {
      g.follow -= dt;
    } else if (this.mode === "listen") {
      g.tx += (0 - g.tx) * Math.min(1, dt * 0.6);
      g.ty = 0.92;
    } else if (this.mode === "think" && t >= g.next) {
      this.gazeTo(g.tx > 0 ? rand(-0.65, -0.4) : rand(0.4, 0.65), rand(-0.85, -0.6));
      g.next = t + rand(1.1, 2.2);
    } else if (t >= g.next) {
      const mode = this.gazeMode;
      const fixed = { center: [0, 0], down: [0.05, 0.85], downside: [0.6, 0.75], up: [-0.6, -0.8],
        side: [0.75, 0.05], sidedown: [-0.7, 0.45], roll: [0.55, -0.85], sideglance: [-0.8, 0.12],
        dreamup: [0.1, -0.75] }[mode];
      if (fixed) {
        this.gazeTo(fixed[0] + rand(-0.08, 0.08), fixed[1] + rand(-0.06, 0.06));
        g.next = t + rand(0.9, 2.4);
      } else if (mode === "darting") {
        this.gazeTo(rand(-0.85, 0.85), rand(-0.5, 0.5));
        g.next = t + rand(0.25, 0.7);
      } else if (mode === "slide") { // хитрая: глаза скользят в сторону и обратно
        g.flip = 1 - g.flip;
        this.gazeTo(g.flip ? rand(0.6, 0.8) : rand(-0.1, 0.1), rand(-0.05, 0.1));
        g.next = t + rand(1.2, 2);
      } else {
        this.gazeTo(Math.random() < 0.35 ? 0 : rand(-0.45, 0.45), Math.random() < 0.35 ? 0 : rand(-0.3, 0.3));
        g.next = t + rand(0.9, 3.4);
      }
    }
    // саккада: быстро и с маленьким перелётом; дуга затухает к концу движения
    const k = 520;
    const c = 2 * 0.72 * Math.sqrt(k);
    g.vx += (k * (g.tx - g.x) - c * g.vx) * dt;
    g.vy += (k * (g.ty - g.y) - c * g.vy) * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    const decay = Math.exp(-dt / 0.09);
    g.ax *= decay;
    g.ay *= decay;
  }

  // ----- моргание -----

  /** Виды: normal, double, slow, asym (одно веко чуть позже). */
  startBlink(kind = "normal") {
    const b = this.blink;
    if (b.eyes.some((e) => e.t !== -1)) return;
    b.last = this.time;
    const speed = kind === "slow" ? 0.45 : this.blinkSpeed;
    const hold = kind === "slow" ? 0.12 : 0;
    b.eyes[0] = { t: 0, hold, speed };
    b.eyes[1] = { t: kind === "asym" ? -0.03 : 0, hold, speed };
    if (kind === "double") b.queue.push(this.time + 0.3);
    this.onBlink?.(); // иконка на вкладке моргает вместе с ней
  }

  /** Моргнуть одним глазом (тап по глазу, подмигивание); hold — сколько держать закрытым. */
  blinkEye(side, hold = 0.2) {
    this.blink.eyes[side] = { t: 0, hold, speed: 1.2 };
  }

  updateBlink(dt) {
    const b = this.blink;
    for (const eye of b.eyes) {
      if (eye.t === -1) continue;
      eye.t += dt;
      const total = (0.07 + 0.14) / eye.speed + 0.04 + eye.hold;
      if (eye.t > total) eye.t = -1;
    }
    if (b.queue.length && this.time >= b.queue[0]) {
      b.queue.shift();
      this.startBlink("normal");
    }
    if (b.eyes.some((e) => e.t !== -1)) return;
    b.next -= dt;
    if (b.next <= 0) {
      if (this.blinkRate > 0) {
        const roll = Math.random();
        this.startBlink(this.blinkSpeed < 0.7 ? "slow" : roll < 0.14 ? "double" : roll < 0.24 ? "asym" : "normal");
      }
      b.next = this.blinkRate > 0 ? rand(2.2, 5.6) / this.blinkRate : 1e9;
    }
  }

  /** Насколько закрыт глаз: быстро закрыть (70 мс), подержать, открыть (140 мс) с перелётом — глаз чуть шире. */
  blinkAmount(side) {
    const e = this.blink.eyes[side];
    if (!e || e.t < 0) return 0;
    const close = 0.07 / e.speed;
    const hold = 0.04 + e.hold;
    const open = 0.14 / e.speed;
    if (e.t < close) return (e.t / close) ** 2;
    if (e.t < close + hold) return 1;
    const q = clamp((e.t - close - hold) / open, 0, 1);
    return (1 - q) ** 2 - 0.12 * Math.sin(Math.PI * q) * q;
  }

  // контур глаза: основа (веки) + особые формы
  eyePoints(side, x, gaze, blink, nodLid) {
    const mirror = side === 0 ? 1 : -1;
    const w = x.ew * (side === 0 ? x.lw : x.rw);
    const lidDrop = clamp(side === 0 ? x.lidL : x.lidR, 0, 1);
    // глаз дальше от взгляда — веко чуть ниже (поворот головы без зрачков)
    const far = Math.max(0, -gaze.x * mirror) * 0.07;
    let top = x.et * (side === 0 ? x.lt : x.rt) * (1 - lidDrop * 0.85) * (1 - far);
    let bot = x.eb * (side === 0 ? x.lb : x.rb);
    const open = clamp((top + bot) / 200, 0, 1);
    const lid = clamp(blink * open + nodLid, -0.12, 1);
    top = lerp(top, 5, lid);
    bot = lerp(bot, 5, lid);
    const cx = EYE[side].x + x.edx + gaze.x * 15 - mirror * x.sep;
    const cy = EYE[side].y + x.edy + gaze.y * 11;
    const rot = x.rot * mirror;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const shapes = x.heart + x.star + x.cross + x.spiral + x.chev + x.caret + x.diamond;
    const special = clamp(shapes, 0, 1);
    const sum = shapes || 1;
    const size = w * 1.02;
    const spiral = x.spiral > 0.01 ? spiralAt(this.spinPhase * mirror) : null;
    const lean = 1 + gaze.x * mirror * 0.05; // глаз со стороны взгляда чуть крупнее
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = (i / N) * TAU;
      const su = Math.sin(u);
      let px = w * lean * Math.cos(u);
      let py = (su < 0 ? top : bot) * su;
      if (special > 0.001) {
        let sx = 0;
        let sy = 0;
        const add = (shape, weight) => {
          if (weight <= 0.001) return;
          sx += shape[i][0] * weight;
          sy += shape[i][1] * weight;
        };
        add(HEART, x.heart);
        add(STAR, x.star);
        add(CROSS, x.cross);
        add(CARET, x.caret);
        add(DIAMOND, x.diamond);
        if (spiral) add(spiral, x.spiral);
        if (x.chev > 0.001) {
          sx += CHEV[i][0] * mirror * x.chev;
          sy += CHEV[i][1] * x.chev;
        }
        px = lerp(px, (sx / sum) * size, special);
        py = lerp(py, (sy / sum) * size * (1 - clamp(blink, 0, 1) * 0.85), special);
      }
      pts.push([cx + px * cos - py * sin, cy + px * sin + py * cos]);
    }
    return { pts, cx, cy, w, top, bot, rot, open: 1 - lid };
  }

  render() {
    const x = this.x;
    const t = this.time;
    const gz = this.gaze;
    const gx = gz.x + gz.ax + (REDUCED ? 0 : noise(t * 0.7, 3) * 0.025); // дуга + микродрейф
    const gy = gz.y + gz.ay + (REDUCED ? 0 : noise(t * 0.6, 9) * 0.02);
    const gaze = { x: gx, y: gy };
    const frozen = t < this.freezeUntil; // ошарашена: на миг замерла
    const life = frozen ? 0 : 1;
    // поведение головы
    let hx = x.hx + gx * 4;
    let hy = x.hy;
    let tilt = x.tilt + gx * 2.2;
    let sx = x.scale;
    let sy = x.scale;
    const blinkL = this.blinkAmount(0);
    const blinkR = this.blinkAmount(1);
    const m = clamp(this.modeAmt, -0.2, 1.2);
    if (this.mode === "think" || (!this.mode && this.lastMode === "think")) {
      tilt -= m * 6;
      hy -= m * 5;
    } else {
      tilt += m * 4;
      hy += m * 7;
    }
    if (this.mode) this.lastMode = this.mode;
    if (!REDUCED) {
      const breath = Math.sin(t * TAU * 0.24) * 0.012 * life;
      sx *= 1 + breath * 0.6;
      sy *= 1 + breath;
      hy += Math.sin(t * TAU * 0.16 + 0.7) * 5 * (1 - clamp(x.bounce, 0, 1)) * life; // лёгкое парение
      sy *= 1 - Math.max(blinkL, blinkR, 0) * 0.02; // моргнула — чуть-чуть «осела»
      const hop = Math.abs(Math.sin(Math.PI * x.bounceHz * t));
      hy -= hop * x.bounce * 16 * life;
      // объём сохраняется: тянется вверх — уже, приседает — шире
      sy *= 1 + (hop - 0.5) * x.bounce * 0.05 * life;
      sx *= 1 - (hop - 0.5) * x.bounce * 0.045 * life;
      hx += noise(t * 9, 1) * x.tremble * 3.2 * life;
      hy += noise(t * 9, 7) * x.tremble * 2.4 * life;
      tilt += Math.sin(t * TAU * 0.22) * x.sway * 4 * life;
      hx += Math.cos(t * 3.2) * x.wobble * 9 * life;
      hy += Math.sin(t * 3.2) * x.wobble * 5 * life;
      tilt += Math.sin(t * 3.2) * x.wobble * 6 * life;
      // никогда не замирает совсем: микродвижения ~1 %
      hx += noise(t * 0.9, 11) * 2 * life;
      tilt += noise(t * 0.8, 17) * 0.6 * life;
    }
    const nod = REDUCED ? 0 : Math.max(0, Math.sin(t * TAU * 0.11)) ** 6 * x.nod;
    hy += nod * 20;
    tilt += nod * 5;
    // сжатие-растяжение от «толчка» (объём сохраняется)
    const q = clamp(this.squash.x, -0.6, 0.6);
    sy *= 1 + q * 0.08;
    sx *= 1 / (1 + q * 0.08) ** 0.6;
    // растягивание пальцем
    const pull = clamp(this.pull.x, -0.4, 1.2);
    sy *= 1 + pull * 0.25;
    sx *= 1 - pull * 0.12;
    hy += pull * 34;
    this.head.setAttribute("transform",
      `translate(${f1(C.x + hx)},${f1(C.y + hy)}) rotate(${f1(tilt)}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) ` +
      `translate(${-C.x},${-C.y})`);

    const eyes = [0, 1].map((side) => this.eyePoints(side, x, gaze, side === 0 ? blinkL : blinkR, nod * 0.5));
    const cheek = clamp(x.cheek, 0, 1);
    for (let side = 0; side < 2; side++) {
      const e = eyes[side];
      this.eyeEl[side].setAttribute("d", smoothClosed(e.pts));
      this.eyeEl[side].setAttribute("stroke-width", f1(x.sw));
      // румянец (надутые щёки — круглее и больше)
      const blush = this.blushEl[side];
      blush.setAttribute("cx", f1(EYE[side].x + (side === 0 ? -12 : 12) + gx * 6));
      blush.setAttribute("cy", f1(EYE[side].y + 172 + x.edy * 0.5 - cheek * 6));
      blush.setAttribute("rx", f1(82 + cheek * 14));
      blush.setAttribute("ry", f1(30 + cheek * 26));
      blush.setAttribute("opacity", f1(clamp(x.blush, 0, 1) * 0.55 * 100) / 100);
    }
    this.renderLashes(x, eyes);
    this.renderMouth(x, gaze, t);
    this.renderBadges(x, eyes, t);
    if (this.auraEl) {
      const flicker = this.emotion === "angry" && !REDUCED ? 0.88 + 0.12 * Math.sin(t * 23) : 1;
      const pulse = 1 + Math.sin(t * TAU * 0.24) * 0.03;
      this.auraEl.setAttribute("opacity", f1(clamp(x.aura, 0, 1.2) * flicker * 100) / 100);
      this.auraEl.setAttribute("rx", f1(430 * x.auraSize * pulse));
      this.auraEl.setAttribute("ry", f1(300 * x.auraSize * pulse));
    }
  }

  renderLashes(x, eyes) {
    const special = clamp(x.heart + x.star + x.cross + x.spiral + x.chev + x.caret + x.diamond, 0, 1);
    const flap = this.flap.x;
    for (let side = 0; side < 2; side++) {
      const e = eyes[side];
      const mirror = side === 0 ? 1 : -1;
      const sideLash = side === 0 ? x.lashL : x.lashR;
      for (let i = 0; i < LASHES.length; i++) {
        const lash = LASHES[i];
        const node = this.lashEl[side * LASHES.length + i];
        const ra = (side === 0 ? lash.root : 180 - lash.root) * DEG;
        const half = Math.sin(ra) < 0 ? e.top : e.bot;
        // корень — на внешнем крае кольца (с учётом век и наклона)
        const lx = Math.cos(ra) * (e.w + x.sw * 0.32);
        const ly = Math.sin(ra) * (Math.max(half, 8) + x.sw * 0.32);
        const rootX = e.cx + lx * Math.cos(e.rot) - ly * Math.sin(e.rot);
        const rootY = e.cy + lx * Math.sin(e.rot) + ly * Math.cos(e.rot);
        const spread = (i - 1) * (x.lashCurl * 6);
        const swing = flap * 14 * lash.flex; // догоняют голову — у каждой реснички своя задержка
        const dir = ((side === 0 ? lash.dir + x.lash + sideLash + swing : 180 - lash.dir - x.lash - sideLash - swing) + spread)
          * DEG + e.rot;
        const len = lash.len * x.lashLen * (1 - special * 0.25);
        const tipX = rootX + Math.cos(dir) * len;
        const tipY = rootY + Math.sin(dir) * len;
        const curl = (x.lashCurl + flap * 0.15) * len * 0.35;
        const mx = (rootX + tipX) / 2 + Math.sin(dir) * curl * mirror;
        const my = (rootY + tipY) / 2 - Math.abs(Math.cos(dir)) * curl;
        node.setAttribute("d", `M${f1(rootX)},${f1(rootY)} Q${f1(mx)},${f1(my)} ${f1(tipX)},${f1(tipY)}`);
        node.setAttribute("stroke-width", f1(24 * (0.85 + x.sw / 32 * 0.15)));
        node.setAttribute("opacity", f1(clamp(x.lashA, 0, 1) * (1 - special * 0.3) * 100) / 100);
      }
    }
  }

  renderMouth(x, gaze, t) {
    const M = 18;
    const top = [];
    const bot = [];
    const think = this.mode === "think" ? clamp(this.modeAmt, 0, 1) : 0;
    const mx = MOUTH.x + x.mdx + gaze.x * 6 + think * 12;
    const my = MOUTH.y + x.mdy + gaze.y * 4;
    const wobble = REDUCED ? 0 : t * 2.4;
    // говорит: форма гласной — ширина, раскрытие, округлость
    const v = this.vis;
    const talking = clamp(v.open * 1.4, 0, 1);
    const say = Math.max(0, v.open) * 30;
    const width = Math.max(4, x.mw * lerp(1, clamp(v.wide, 0.3, 1.3), talking));
    const round = clamp(Math.max(x.mround, v.round * talking), 0, 1);
    const tri = clamp(x.mtri, 0, 1);
    const cat = clamp(x.mcat, 0, 1.2);
    for (let i = 0; i <= M; i++) {
      const u = (i / M) * 2 - 1;
      let bow = 1 - u * u;
      bow = lerp(bow, Math.sqrt(Math.max(0, 1 - u * u)), round);
      bow = lerp(bow, 1 - Math.abs(u), tri);
      const wave = x.mwave * Math.sin(u * Math.PI * x.mfreq + wobble);
      const skew = x.mskew * u * 0.5;
      const px = mx + u * width;
      const thinkSkew = think * 10 * u;
      // «ω»: две дужки вниз, середина вверх
      const catY = cat * 16 * Math.abs(Math.sin(Math.PI * u)) - cat * 6;
      const curve = 1 - cat * 0.75;
      top.push([px, my + (x.mct * curve - say * 0.25 * (1 + round)) * bow + wave - skew - thinkSkew + catY]);
      bot.push([px, my + (Math.max(x.mcb, x.mct) * curve + say) * bow + wave - skew - thinkSkew + catY]);
    }
    const open = clamp((x.mcb + say - x.mct) / 40, 0, 1);
    const d = smoothOpen(top) + smoothOpen([...bot].reverse()).replace(/^M[^C]+/, "L" +
      `${f1(bot[M][0])},${f1(bot[M][1])}`) + "Z";
    this.mouthEl.setAttribute("d", d);
    this.mouthEl.setAttribute("stroke-width", f1(x.msw));
    this.mouthEl.setAttribute("fill-opacity", f1(clamp(Math.max(x.mfill, talking * 0.85), 0, 1) * open * 100) / 100);
    // язычок: капелька у нижней губы, может «облизнуть» уголок
    const tongue = clamp(x.mtongue, 0, 1);
    if (tongue > 0.02) {
      const tx = mx + clamp(x.mtx, -1.4, 1.4) * width * 0.55;
      const ty = my + Math.max(x.mcb, x.mct) * 0.85 + say;
      const tw = 20 * tongue;
      const th = 34 * tongue;
      this.tongueEl.setAttribute("d", `M${f1(tx - tw)},${f1(ty - 4)} C${f1(tx - tw)},${f1(ty + th)} ${f1(tx + tw)},` +
        `${f1(ty + th)} ${f1(tx + tw)},${f1(ty - 4)}`);
    }
    this.tongueEl.setAttribute("opacity", f1(tongue * 100) / 100);
    // Three fine diagonal marks on each cheek, away from the mouth.
    for (let side = 0; side < 2; side++) {
      const cx = EYE[side].x + gaze.x * 12;
      const cy = EYE[side].y + 145 + gaze.y * 8;
      this.cheekEl[side].setAttribute("d", [-1, 0, 1].map(i =>
        `M${f1(cx + i * 24 - 7)},${f1(cy + 10)} l14,-24`).join(" "));
      this.cheekEl[side].setAttribute("opacity", (clamp(x.blush, 0, 1) * 0.55).toFixed(3));
    }
  }

  renderBadges(x, eyes, t) {
    const r = eyes[1];
    const bob = REDUCED ? 0 : Math.sin(t * 3) * 6;
    // капля пота — у правого глаза сверху
    this.sweatEl.setAttribute("opacity", f1(clamp(x.sweat, 0, 1) * 100) / 100);
    this.sweatEl.setAttribute("transform", `translate(${f1(r.cx + r.w + 70)},${f1(r.cy - 150 + bob * 0.6)}) ` +
      `scale(${f1(0.6 + x.sweat * 0.5)})`);
    // «венка» злости
    const pulse = 1 + (REDUCED ? 0 : Math.max(0, Math.sin(t * 9)) * 0.18);
    this.veinEl.setAttribute("opacity", f1(clamp(x.vein, 0, 1) * 100) / 100);
    this.veinEl.setAttribute("transform", `translate(${f1(r.cx + r.w + 40)},${f1(r.cy - 190)}) ` +
      `scale(${f1(clamp(x.vein, 0, 1) * pulse * 1.1)})`);
    // знак вопроса — покачивается и плавно растёт
    const quest = clamp(x.quest, 0, 1);
    this.questEl.setAttribute("opacity", f1(quest * 100) / 100);
    this.questEl.setAttribute("transform", `translate(${f1(r.cx + r.w + 70)},${f1(r.cy - 130 + bob)}) ` +
      `rotate(${f1(12 + Math.sin(t * 2) * 8)}) scale(${(0.3 + quest * 0.7).toFixed(3)})`);
    // «!!!» шока — вылетают сверху
    const bang = clamp(x.bang, 0, 1);
    this.bangEl.setAttribute("opacity", f1(bang * 100) / 100);
    this.bangEl.setAttribute("transform", `translate(${C.x},${f1(C.y - 230 - bang * 20 + bob * 0.4)}) ` +
      `scale(${(0.4 + bang * 0.75).toFixed(3)})`);
    // «…» — думает дольше 4 секунд: точки зажигаются по очереди
    const dots = clamp(this.thinkDots, 0, 1);
    this.dotsEl.setAttribute("opacity", f1(dots * 100) / 100);
    this.dotsEl.setAttribute("transform", `translate(${f1(r.cx + 90)},${f1(r.cy - 200 + bob * 0.5)})`);
    if (dots > 0.01) {
      this.dotEls.forEach((dot, i) => {
        const phase = (((t * 1.6 - i * 0.22) % 1) + 1) % 1;
        dot.setAttribute("opacity", f1((0.3 + 0.7 * Math.max(0, Math.sin(phase * Math.PI))) * 100) / 100);
      });
    }
  }

  // ----- частицы: искры, сердечки, zZ, слёзы, нотки, пар, звёзды, «~», брызги, огоньки, пузырьки, конфетти -----

  spawnBurst(kind, count) {
    if (!this.particlesOn) return;
    for (let i = 0; i < count && this.particles.length < 26; i++) this.particles.push(this.makeParticle(kind));
  }

  updateParticles(dt) {
    const x = this.x;
    const rates = { sparkle: x.sparkle * 3.2, hearts: x.hearts * 1.8, zz: x.zz * 0.75,
      tears: x.tears * (this.emotion === "crying" ? 4.2 : 1.6), notes: x.notes * 1.4, orbit: x.orbit * 2.2,
      tilde: x.tilde * 0.9, splash: x.splash * 6, flame: x.flame * 3.4, dream: x.dream * 1.1, confetti: x.confetti * 9 };
    for (const kind of Object.keys(rates)) {
      if (rates[kind] < 0.12) continue;
      this.spawn[kind] = (this.spawn[kind] || 0) + rates[kind] * dt;
      while (this.spawn[kind] >= 1 && this.particles.length < 26) {
        this.spawn[kind] -= 1;
        this.particles.push(this.makeParticle(kind));
      }
      if (this.spawn[kind] > 2) this.spawn[kind] = 1; // лимит частиц — не копим долг
    }
    for (const p of this.particles) {
      p.age += dt;
      const life = p.age / p.life;
      if (p.orbit) { // звёздочки по орбите вокруг головы
        p.a += dt * 3.2;
        p.x = C.x + Math.cos(p.a) * 380;
        p.y = C.y - 150 + Math.sin(p.a) * 70;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.g * dt;
        if (p.wave) p.x += Math.sin(p.age * p.wave) * 40 * dt;
      }
      p.rot += p.vr * dt;
      const fade = life < 0.2 ? life / 0.2 : 1 - (life - 0.2) / 0.8;
      const scale = (p.kind === "sparkle" ? Math.sin(Math.min(1, life) * Math.PI) : birth(life)) * p.s;
      p.node.setAttribute("opacity", f1(clamp(fade, 0, 1) * p.a0 * 100) / 100);
      p.node.setAttribute("transform", `translate(${f1(p.x)},${f1(p.y)}) rotate(${f1(p.rot)}) scale(${scale.toFixed(3)})`);
    }
    this.particles = this.particles.filter((p) => {
      if (p.age < p.life) return true;
      p.node.remove();
      return false;
    });
  }

  makeParticle(kind) {
    const node = el("path", {}, this.fx);
    const p = { kind, node, age: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, s: 1, a0: 1, life: 1 };
    const line = (width) => {
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "currentColor");
      node.setAttribute("stroke-width", width);
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
    };
    if (kind === "sparkle") {
      const a = rand(0, TAU);
      p.x = C.x + Math.cos(a) * rand(330, 450);
      p.y = C.y + Math.sin(a) * rand(190, 270);
      p.s = rand(0.5, 1.1);
      p.vr = rand(-90, 90);
      p.life = rand(0.7, 1.2);
      node.setAttribute("d", "M0,-30 C4,-6 6,-4 30,0 C6,4 4,6 0,30 C-4,6 -6,4 -30,0 C-6,-4 -4,-6 0,-30Z");
      node.setAttribute("fill", "currentColor");
    } else if (kind === "hearts") {
      p.x = C.x + rand(-420, 420);
      p.y = C.y + rand(120, 230);
      p.vy = rand(-110, -70);
      p.vx = rand(-12, 12);
      p.s = rand(0.8, 1.35);
      p.vr = rand(-20, 20);
      p.life = rand(1.6, 2.4);
      p.a0 = 0.9;
      p.wave = 3;
      node.setAttribute("d", "M0,10 C-26,-8 -18,-30 0,-16 C18,-30 26,-8 0,10Z");
      line(6);
    } else if (kind === "zz") {
      p.x = C.x + 330 + rand(-20, 30);
      p.y = C.y - 120 + rand(-10, 10);
      p.vx = rand(40, 70);
      p.vy = rand(-70, -45);
      p.s = rand(1.2, 1.8);
      p.vr = rand(-10, 10);
      p.life = rand(1.8, 2.6);
      p.a0 = 0.85;
      node.setAttribute("d", "M-14,-14 H14 L-14,14 H14");
      line(7);
    } else if (kind === "notes") { // ♪ — напевает
      p.x = C.x + rand(-60, 60) + (Math.random() < 0.5 ? -340 : 340);
      p.y = C.y - 60 + rand(-20, 20);
      p.vx = rand(-20, 20);
      p.vy = rand(-80, -55);
      p.s = rand(1.1, 1.5);
      p.vr = rand(-30, 30);
      p.life = rand(1.6, 2.2);
      p.wave = 4;
      node.setAttribute("d", "M-6,16 C-16,16 -18,6 -10,4 C-4,2 2,6 2,12 L2,-22 C10,-18 16,-14 18,-6");
      line(6);
    } else if (kind === "steam") { // «пф» — пар сбоку
      const s = Math.random() < 0.5 ? -1 : 1;
      p.x = C.x + s * 380;
      p.y = C.y - 40 + rand(-20, 20);
      p.vx = s * rand(60, 100);
      p.vy = rand(-50, -20);
      p.s = rand(1.1, 1.6);
      p.life = rand(0.8, 1.1);
      p.a0 = 0.85;
      node.setAttribute("d", "M-18,6 C-26,6 -26,-8 -16,-8 C-14,-18 2,-20 6,-10 C16,-14 24,-2 16,4 C14,10 -12,10 -18,6Z");
      line(6);
    } else if (kind === "orbit") { // звёздочки по орбите — голова кругом
      p.orbit = true;
      p.a = rand(0, TAU);
      p.s = rand(0.6, 0.9);
      p.vr = 120;
      p.life = rand(1.2, 1.8);
      node.setAttribute("d", "M0,-22 L6,-6 L22,-6 L9,4 L14,20 L0,10 L-14,20 L-9,4 L-22,-6 L-6,-6Z");
      line(5);
    } else if (kind === "tilde") { // «~» — уют, мурчит
      p.x = C.x + rand(-200, 200);
      p.y = C.y - 210 + rand(-10, 10);
      p.vy = rand(-40, -25);
      p.s = rand(1, 1.5);
      p.life = rand(1.6, 2.2);
      p.wave = 2.5;
      node.setAttribute("d", "M-20,0 C-13,-10 -6,-10 0,0 C6,10 13,10 20,0");
      line(7);
    } else if (kind === "splash") { // брызги слёз от смеха — в стороны
      const side = Math.random() < 0.5 ? 0 : 1;
      const eye = EYE[side];
      p.x = eye.x + (side === 0 ? -80 : 80);
      p.y = eye.y + 10;
      p.vx = (side === 0 ? -1 : 1) * rand(160, 280);
      p.vy = rand(-200, -100);
      p.g = 700;
      p.s = rand(0.9, 1.4);
      p.life = rand(0.6, 0.9);
      node.setAttribute("d", "M0,-14 C6,-4 9,2 0,10 C-9,2 -6,-4 0,-14Z");
      node.setAttribute("fill", "currentColor");
    } else if (kind === "flame") { // огоньки решимости — по бокам вверх
      const s = Math.random() < 0.5 ? -1 : 1;
      p.x = C.x + s * rand(380, 440);
      p.y = C.y + rand(40, 120);
      p.vy = rand(-160, -110);
      p.vx = s * rand(-10, 10);
      p.s = rand(0.8, 1.3);
      p.life = rand(0.5, 0.8);
      node.setAttribute("d", "M0,16 C-12,6 -8,-6 0,-18 C8,-6 12,6 0,16Z");
      line(6);
    } else if (kind === "dream") { // пузырьки-мечты плывут вверх и растут
      p.x = C.x + 260 + rand(-30, 40);
      p.y = C.y - 160;
      p.vy = rand(-45, -30);
      p.vx = rand(5, 20);
      p.s = rand(0.6, 1.4);
      p.life = rand(2.2, 3);
      p.wave = 1.6;
      node.setAttribute("d", "M0,-14 A14,14 0 1,1 -0.1,-14Z");
      line(6);
    } else if (kind === "confetti") { // праздник — контурные конфетти падают сверху
      p.x = C.x + rand(-460, 460);
      p.y = C.y - 330;
      p.vy = rand(120, 220);
      p.vx = rand(-40, 40);
      p.vr = rand(-240, 240);
      p.s = rand(0.7, 1.2);
      p.life = rand(1.6, 2.4);
      p.wave = 5;
      node.setAttribute("d", ["M-10,-6 H10 V6 H-10Z", "M0,-12 L11,8 H-11Z", "M-12,0 C-6,-10 6,10 12,0"][
        Math.floor(Math.random() * 3)]);
      line(5);
    } else { // слёзы
      const side = Math.random() < 0.5 ? 0 : 1;
      const eye = EYE[side];
      p.x = eye.x + (side === 0 ? 70 : -70) + rand(-10, 10) + this.x.edx;
      p.y = eye.y + 110 + this.x.edy;
      p.vx = (side === 0 ? -1 : 1) * rand(10, 30);
      p.vy = rand(20, 50);
      p.g = 520;
      p.s = rand(1.5, 2.1);
      p.life = rand(0.8, 1.1);
      node.setAttribute("d", "M0,-16 C7,-5 11,2 0,12 C-11,2 -7,-5 0,-16Z");
      node.setAttribute("fill", "currentColor");
    }
    return p;
  }

  destroy() {
    Face.all.delete(this);
    this.svg.remove();
  }
}

Face.all = new Set();
Face.running = false;
Face.start = function start() {
  if (Face.running) return;
  Face.running = true;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
    last = now;
    let alive = 0;
    if (!document.hidden) {
      for (const face of Face.all) {
        if (face.paused) continue;
        face.step(dt);
        alive += 1;
      }
    }
    // никого не видно — цикл засыпает (батарея), resume() или новое лицо его разбудят
    if (!alive && !document.hidden) {
      Face.running = false;
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};
document.addEventListener("visibilitychange", () => { if (!document.hidden) Face.start(); });

export { CLIPS };
