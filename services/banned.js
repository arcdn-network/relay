const fs = require('fs');
const path = require('path');

const BANNED_FILE = path.join(process.cwd(), 'data', 'banned.json');

function ensureFile() {
  const dir = path.dirname(BANNED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(BANNED_FILE)) fs.writeFileSync(BANNED_FILE, JSON.stringify([]));
}

function getBanned() {
  ensureFile();
  return JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8'));
}

function saveBanned(list) {
  ensureFile();
  fs.writeFileSync(BANNED_FILE, JSON.stringify(list, null, 2));
}

function banUser(chatId) {
  const id = String(chatId);
  const list = getBanned();
  if (!list.includes(id)) {
    list.push(id);
    saveBanned(list);
    return true;
  }
  return false;
}

function unbanUser(chatId) {
  const id = String(chatId);
  const list = getBanned();
  const newList = list.filter((item) => item !== id);
  saveBanned(newList);
  return list.length !== newList.length;
}

function isBanned(chatId) {
  return getBanned().includes(String(chatId));
}

module.exports = { banUser, unbanUser, isBanned };
