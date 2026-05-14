const fs = require('fs');
const path = require('path');
const baseDir = path.join(process.env.USERPROFILE, 'FilaAgentes');
const configPath = path.join(baseDir, 'config.json');
const defaultConfig = {
  chatUrl: "https://sw-chat.elodatacenter.com.br",
  accountId: 1,
  porta: 3000,
  supervisorToken: "1"
};
function ensureConfig() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2)
    );
  }
}
function getConfig() {
  ensureConfig();
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}
module.exports = {
  getConfig,
  configPath
};