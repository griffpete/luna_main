const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'analysis-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getLastAnalysis(owner, repo) {
  const state = loadState();
  return state[`${owner}/${repo}`] || null;
}

function setLastAnalysis(owner, repo, commitCount) {
  const state = loadState();
  state[`${owner}/${repo}`] = {
    lastAnalyzed: new Date().toISOString(),
    commitCount,
    commitSha: null
  };
  saveState(state);
}

module.exports = { getLastAnalysis, setLastAnalysis };
