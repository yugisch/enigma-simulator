/**
 * Classic Enigma M3 simulator
 * Rotors I–V, Reflectors B/C, plugboard, ring settings, double-stepping.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROTORS = {
  I:   { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II:  { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV:  { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V:   { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};

const REFLECTORS = {
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

class Enigma {
  constructor() {
    this.rotorNames = ["III", "II", "I"];
    this.positions = [0, 0, 0];
    this.rings = [0, 0, 0];
    this.reflector = "B";
    this.plug = {};
    this.resetPlug();
  }

  resetPlug() {
    this.plug = {};
    for (let i = 0; i < 26; i++) {
      const c = ALPHABET[i];
      this.plug[c] = c;
    }
  }

  setPlugboard(pairsStr) {
    this.resetPlug();
    const tokens = pairsStr.toUpperCase().replace(/[^A-Z\s]/g, " ").trim().split(/\s+/);
    const used = new Set();
    for (const t of tokens) {
      if (t.length !== 2) continue;
      const a = t[0], b = t[1];
      if (a === b || used.has(a) || used.has(b)) continue;
      this.plug[a] = b;
      this.plug[b] = a;
      used.add(a);
      used.add(b);
    }
  }

  step() {
    const [l, m, r] = this.positions;
    const notchM = ROTORS[this.rotorNames[1]].notch;
    const notchR = ROTORS[this.rotorNames[2]].notch;
    const mAtNotch = ALPHABET[m] === notchM;
    const rAtNotch = ALPHABET[r] === notchR;

    if (mAtNotch) {
      this.positions[0] = (l + 1) % 26;
      this.positions[1] = (m + 1) % 26;
    } else if (rAtNotch) {
      this.positions[1] = (m + 1) % 26;
    }
    this.positions[2] = (r + 1) % 26;
  }

  rotorPass(rotorName, pos, ring, signal, forward) {
    const wiring = ROTORS[rotorName].wiring;
    const shift = (pos - ring + 26) % 26;
    if (forward) {
      const idx = (signal + shift) % 26;
      const wired = wiring.charCodeAt(idx) - 65;
      return (wired - shift + 26) % 26;
    }
    const target = (signal + shift) % 26;
    let inv = 0;
    for (let i = 0; i < 26; i++) {
      if (wiring.charCodeAt(i) - 65 === target) {
        inv = i;
        break;
      }
    }
    return (inv - shift + 26) % 26;
  }

  encryptLetter(ch) {
    ch = ch.toUpperCase();
    if (!/[A-Z]/.test(ch)) return null;

    this.step();
    let s = ch.charCodeAt(0) - 65;
    s = this.plug[ALPHABET[s]].charCodeAt(0) - 65;

    for (let i = 2; i >= 0; i--) {
      s = this.rotorPass(this.rotorNames[i], this.positions[i], this.rings[i], s, true);
    }

    s = REFLECTORS[this.reflector].charCodeAt(s) - 65;

    for (let i = 0; i < 3; i++) {
      s = this.rotorPass(this.rotorNames[i], this.positions[i], this.rings[i], s, false);
    }

    s = this.plug[ALPHABET[s]].charCodeAt(0) - 65;
    return ALPHABET[s];
  }

  getPositionLetters() {
    return this.positions.map((p) => ALPHABET[p]);
  }
}

const machine = new Enigma();
let plainText = "";
let cipherText = "";
let lampTimer = null;

const plainOut = document.getElementById("plain-out");
const cipherOut = document.getElementById("cipher-out");
const lampboardEl = document.getElementById("lampboard");
const keyboardEl = document.getElementById("keyboard");

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function buildLampboard() {
  lampboardEl.innerHTML = "";
  KEY_ROWS.forEach((row) => {
    row.split("").forEach((letter) => {
      const lamp = document.createElement("div");
      lamp.className = "lamp";
      lamp.dataset.letter = letter;
      lamp.textContent = letter;
      lampboardEl.appendChild(lamp);
    });
  });
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  KEY_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    row.split("").forEach((letter) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.letter = letter;
      btn.textContent = letter;
      btn.addEventListener("click", () => handleKey(letter));
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function fillRotorSelects() {
  ["rotor-L", "rotor-M", "rotor-R"].forEach((id, i) => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    Object.keys(ROTORS).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === machine.rotorNames[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      machine.rotorNames[i] = sel.value;
    });
  });
}

function updatePositionDisplay() {
  const [l, m, r] = machine.getPositionLetters();
  document.getElementById("pos-L").textContent = l;
  document.getElementById("pos-M").textContent = m;
  document.getElementById("pos-R").textContent = r;
}

function updateOutput() {
  plainOut.textContent = plainText || "—";
  cipherOut.textContent = cipherText || "—";
}

function lightLamp(letter) {
  document.querySelectorAll(".lamp").forEach((el) => el.classList.remove("on"));
  if (!letter) return;
  const lamp = document.querySelector(`.lamp[data-letter="${letter}"]`);
  if (lamp) lamp.classList.add("on");
  clearTimeout(lampTimer);
  lampTimer = setTimeout(() => {
    document.querySelectorAll(".lamp").forEach((el) => el.classList.remove("on"));
  }, 350);
}

function flashKey(letter) {
  const key = document.querySelector(`.key[data-letter="${letter}"]`);
  if (!key) return;
  key.classList.add("pressed");
  setTimeout(() => key.classList.remove("pressed"), 120);
}

function handleKey(letter) {
  letter = letter.toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return;

  const out = machine.encryptLetter(letter);
  if (!out) return;

  plainText += letter;
  cipherText += out;
  updateOutput();
  updatePositionDisplay();
  lightLamp(out);
  flashKey(letter);
}

function handleSpace() {
  plainText += " ";
  cipherText += " ";
  updateOutput();
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  if (e.key === " ") {
    e.preventDefault();
    handleSpace();
    return;
  }
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    e.preventDefault();
    handleKey(e.key);
  }
});

document.querySelectorAll(".rotor-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const i = parseInt(btn.dataset.rotor, 10);
    const dir = btn.dataset.act === "up" ? 1 : -1;
    machine.positions[i] = (machine.positions[i] + dir + 26) % 26;
    updatePositionDisplay();
  });
});

["ring-L", "ring-M", "ring-R"].forEach((id, i) => {
  const input = document.getElementById(id);
  input.addEventListener("input", () => {
    let v = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    input.value = v.slice(-1) || "A";
    machine.rings[i] = (input.value.charCodeAt(0) - 65 + 26) % 26;
  });
  input.addEventListener("blur", () => {
    if (!input.value) {
      input.value = "A";
      machine.rings[i] = 0;
    }
  });
});

document.getElementById("reflector").addEventListener("change", (e) => {
  machine.reflector = e.target.value;
});

document.getElementById("plugboard").addEventListener("change", (e) => {
  machine.setPlugboard(e.target.value);
});
document.getElementById("plugboard").addEventListener("blur", (e) => {
  machine.setPlugboard(e.target.value);
});

document.getElementById("btn-reset-pos").addEventListener("click", () => {
  machine.positions = [0, 0, 0];
  updatePositionDisplay();
});

document.getElementById("btn-clear").addEventListener("click", () => {
  plainText = "";
  cipherText = "";
  updateOutput();
  document.querySelectorAll(".lamp").forEach((el) => el.classList.remove("on"));
});

buildLampboard();
buildKeyboard();
fillRotorSelects();
updatePositionDisplay();
updateOutput();
