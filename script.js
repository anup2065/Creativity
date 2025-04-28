// ====== Global State ======
let sections     = [];   // { studySec, restSec }
let currentIndex = 0;
let remaining    = 0;
let timerId      = null;
let isPaused     = false;
let sectionCount = 0;
let currentPhase = 'study'; // 'study' or 'rest'

// ====== DOM References ======
const sectionContainer = document.getElementById('inputSection');
const addSectionBtn    = document.getElementById('addSection');
const startBtn         = document.getElementById('startButton');
const pauseBtn         = document.getElementById('pauseButton');
const resumeBtn        = document.getElementById('resumeButton');
const skipBtn          = document.getElementById('skipButton');
const prevBtn          = document.getElementById('previousButton');
const cancelBtn        = document.getElementById('cancelButton');
const confirmResetBtn  = document.getElementById('confirmReset');
const cancelResetBtn   = document.getElementById('cancelReset');
const currentLabel     = document.getElementById('currentTimer');
const countdownLabel   = document.getElementById('countdown');
const bell             = document.getElementById('bellSound');

// ====== Initialization ======
addSection();  // start with one empty section
loadState();   // restore if there's saved state

// ====== Event Listeners ======
addSectionBtn.addEventListener('click', addSection);
startBtn.addEventListener('click', startPlan);
pauseBtn.addEventListener('click', pauseTimer);
resumeBtn.addEventListener('click', resumeTimer);
skipBtn.addEventListener('click', skipSession);
prevBtn.addEventListener('click', goToPrevious);
cancelBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to cancel the timer plan? This will delete all sections.')) {
    resetPlan();
  }
});
window.addEventListener('beforeunload', saveState);

// ====== State Persistence ======
function saveState() {
  // Gather input times
  const studyTimes = Array.from(document.querySelectorAll('.study-time'))
                          .map(inp => parseFloat(inp.value) || 0);
  const state = {
    studyTimes,
    currentIndex,
    remaining,
    currentPhase,
    isPaused
  };
  localStorage.setItem('timerAppState', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('timerAppState');
  if (!raw) return;
  const { studyTimes, currentIndex: idx, remaining: rem, currentPhase: phase, isPaused: paused } = JSON.parse(raw);
  // Rebuild sections inputs
  sectionContainer.innerHTML = '';
  sectionCount = 0;
  studyTimes.forEach(time => {
    addSection();
    const lastInput = sectionContainer.querySelectorAll('.study-time');
    lastInput[lastInput.length - 1].value = time;
  });
  updateSectionLabels();

  // Prepare internal state
  currentIndex = idx;
  remaining    = rem;
  currentPhase = phase;
  isPaused     = paused;

  // Build sections array
  sections = studyTimes
    .filter(t => t > 0)
    .map(t => ({
      studySec: Math.floor(t * 60),
      restSec : Math.max(6, Math.ceil((t/6) * 60))
    }));
  if (!sections.length) return;

  // Show appropriate controls
  pauseBtn.style.display  = paused ? 'none' : 'inline-block';
  resumeBtn.style.display = paused ? 'inline-block' : 'none';

  // Resume timer
  resumeCurrentPhase();
}

function resumeCurrentPhase() {
  clearInterval(timerId);
  const sec = sections[currentIndex];
  if (currentPhase === 'study') {
    runTimer(remaining, `Section ${currentIndex+1} (Study)`, () => {
      currentPhase = 'rest';
      saveState();
      runTimer(sec.restSec, `Section ${currentIndex+1} (Rest)`, () => {
        currentIndex++;
        currentPhase = 'study';
        saveState();
        if (currentIndex < sections.length) runSection();
        else alert('All sessions completed!');
      });
    });
  } else {
    runTimer(remaining, `Section ${currentIndex+1} (Rest)`, () => {
      currentIndex++;
      currentPhase = 'study';
      saveState();
      if (currentIndex < sections.length) runSection();
      else alert('All sessions completed!');
    });
  }
}

// ====== Functions ======

// 1) Add a new study section
function addSection() {
  sectionCount++;
  const div = document.createElement('div');
  div.className = 'section-container';

  // delete button
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-section';
  del.textContent = '×';
  del.title = 'Delete this section';
  del.addEventListener('click', () => {
    div.remove();
    if (sectionContainer.children.length === 0) addSection();
    updateSectionLabels();
    saveState();
  });

  // label + input
  const label = document.createElement('label');
  label.textContent = `Section ${sectionCount}: `;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'study-time';
  input.placeholder = 'Minutes';
  input.min = '0.1';
  input.step = '0.1';
  label.appendChild(input);

  // rest-time info
  const restInfo = document.createElement('div');
  restInfo.className = 'rest-time';
  restInfo.textContent = 'Rest time auto-calculated';

  div.appendChild(del);
  div.appendChild(label);
  div.appendChild(restInfo);
  sectionContainer.appendChild(div);

  updateSectionLabels();
}

// 2) Renumber all sections after add/delete
function updateSectionLabels() {
  const secs = document.querySelectorAll('.section-container');
  secs.forEach((div, i) => {
    const lbl = div.querySelector('label');
    const inp = div.querySelector('input');
    lbl.textContent = `Section ${i+1}: `;
    lbl.appendChild(inp);
  });
  sectionCount = secs.length;
}

// 3) Gather data and start the full plan
function startPlan() {
  clearInterval(timerId);
  sections = [];
  currentIndex = 0;
  isPaused = false;
  currentPhase = 'study';

  const inputs = document.querySelectorAll('.study-time');
  inputs.forEach(inp => {
    const m = parseFloat(inp.value);
    if (m > 0) {
      const studySec = Math.floor(m * 60);
      const restSec  = Math.max(6, Math.ceil((m/6) * 60));
      sections.push({ studySec, restSec });
    }
  });

  if (!sections.length) {
    alert('Please enter at least one valid study time.');
    return;
  }

  pauseBtn.style.display  = 'inline-block';
  resumeBtn.style.display = 'none';
  saveState();
  runSection();
}

// 4) Run the current study→rest cycle
function runSection() {
  clearInterval(timerId);
  isPaused = false;
  const { studySec, restSec } = sections[currentIndex];

  currentPhase = 'study';
  runTimer(studySec, `Section ${currentIndex+1} (Study)`, () => {
    currentPhase = 'rest';
    saveState();
    runTimer(restSec, `Section ${currentIndex+1} (Rest)`, () => {
      currentIndex++;
      currentPhase = 'study';
      saveState();
      if (currentIndex < sections.length) runSection();
      else alert('All sessions completed!');
    });
  });
}

// 5) General countdown helper with bell
function runTimer(seconds, label, onComplete) {
  remaining = seconds;
  currentLabel.textContent = label;
  updateDisplay();
  saveState();

  timerId = setInterval(() => {
    if (!isPaused) {
      remaining--;
      updateDisplay();
      saveState();
      if (remaining <= 0) {
        clearInterval(timerId);
        bell.currentTime = 0;
        bell.play();
        onComplete();
      }
    }
  }, 1000);
}

// 6) Update the MM:SS display
function updateDisplay() {
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  countdownLabel.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
}

// 7) Pause / Resume / Skip / Previous
function pauseTimer() {
  isPaused = true;
  pauseBtn.style.display  = 'none';
  resumeBtn.style.display = 'inline-block';
  saveState();
}
function resumeTimer() {
  isPaused = false;
  pauseBtn.style.display  = 'inline-block';
  resumeBtn.style.display = 'none';
  saveState();
}
function skipSession() {
  clearInterval(timerId);
  if (currentPhase === 'study') {
    // skip study → go directly to rest
    const restSec = sections[currentIndex].restSec;
    currentPhase = 'rest';
    saveState();
    runTimer(restSec, `Section ${currentIndex+1} (Rest)`, () => {
      currentIndex++;
      currentPhase = 'study';
      saveState();
      if (currentIndex < sections.length) runSection();
      else alert('All sessions completed!');
    });
  } else {
    // skip rest → next section
    currentIndex++;
    currentPhase = 'study';
    saveState();
    if (currentIndex < sections.length) runSection();
    else alert('All sessions completed!');
  }
}
function goToPrevious() {
  clearInterval(timerId);
  if (currentIndex > 0) {
    currentIndex--;
    currentPhase = 'study';
    saveState();
    runSection();
  }
}

// 8) Reset the entire plan
function resetPlan() {
  clearInterval(timerId);
  sections = [];
  currentIndex = 0;
  remaining = 0;
  isPaused = false;
  sectionCount = 0;
  currentPhase = 'study';
  sectionContainer.innerHTML = '';
  addSection();
  currentLabel.textContent   = '';
  countdownLabel.textContent = '';
  pauseBtn.style.display     = 'none';
  resumeBtn.style.display    = 'none';
  localStorage.removeItem('timerAppState');
}
