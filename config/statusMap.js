const statusMap = {
  'Online': {
    chatwoot: 'online',
    classe: 'online'
  },
  'Banheiro': {
    chatwoot: 'offline',
    classe: 'bathroom'
  },
  'Almoço': {
    chatwoot: 'offline',
    classe: 'offline',
    timer: 72
  },
  'Lanche': {
    chatwoot: 'offline',
    classe: 'offline',
    timer: 15
  },
  'Treinamento': {
    chatwoot: 'busy',
    classe: 'busy'
  },
  'Prova': {
    chatwoot: 'busy',
    classe: 'busy'
  },
  'Pausa - Suporte': {
    chatwoot: 'busy',
    classe: 'busy'
  }
};
module.exports = statusMap;