const fs = require('fs');
const path = require('path');
const configPath = path.join(
  process.env.USERPROFILE,
  'FilaAgentes',
  'config.json'
);
const defaultConfig = {
  chatUrl: "https://sw-chat.elodatacenter.com.br",
  accountId: 1,
  porta: 3000,
  supervisorToken: "1"
};
function getConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultConfig,
      ...parsed
    };
  } catch (err) {
    console.error('Erro ao ler config.json:', err);
    return defaultConfig;
  }
}
module.exports = {
  getConfig,
  configPath
};