const fs = require('fs');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const uuid = require('uuid');
const { v3: uuidv3 } = require('uuid');

const logger = console;

// Fungsi untuk membaca userId dari file
function readUserIds(fileName) {
  const accountFileData = fs.readFileSync(fileName, 'utf8');
  return accountFileData.split('\n').map(userId => userId.trim()).filter(userId => userId !== '');
}

// Fungsi untuk membaca daftar httpProxy dari file
function readHttpProxies(fileName) {
  const proxyFileData = fs.readFileSync(fileName, 'utf8');
  return proxyFileData.split('\n').map(proxy => proxy.trim()).filter(proxy => proxy !== '');
}

// Fungsi untuk menghubungkan ke WebSocket
async function connectToWss(httpProxy, userId) {
  const deviceId = uuidv3(httpProxy, uuid.NIL);
  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  };
  const uri = 'wss://proxy.wynd.network:4650/';

  while (true) {
    try {
      const agent = new HttpsProxyAgent(httpProxy);
      const ws = new WebSocket(uri, { agent, headers: customHeaders, rejectUnauthorized: false });

      ws.on('open', () => {
        logger.info('WebSocket connection opened');
        sendPing(ws);
      });

      ws.on('message', (response) => handleMessage(response, ws, userId, deviceId, customHeaders));

      ws.on('error', (error) => {
        logger.error(error);
        logger.error(httpProxy);
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    } catch (error) {
      logger.error(error);
      logger.error(httpProxy);
    }
  }
}

async function sendPing(ws) {
  while (true) {
    const sendMessage = JSON.stringify({ id: uuid.v4(), version: '1.0.0', action: 'PING', data: {} });
    logger.debug(sendMessage);
    ws.send(sendMessage);
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
}

function handleMessage(response, ws, userId, deviceId, customHeaders) {
  const message = JSON.parse(response);
  logger.info(message);

  if (message.action === 'AUTH') {
    const authResponse = {
      id: message.id,
      origin_action: 'AUTH',
      result: {
        browser_id: deviceId,
        user_id: userId,
        user_agent: customHeaders['User-Agent'],
        timestamp: Math.floor(Date.now() / 1000),
        device_type: 'extension',
        version: '2.5.0',
      },
    };
    logger.debug(authResponse);
    ws.send(JSON.stringify(authResponse));
  } else if (message.action === 'PONG') {
    const pongResponse = { id: message.id, origin_action: 'PONG' };
    logger.debug(pongResponse);
    ws.send(JSON.stringify(pongResponse));
  }
}

async function main() {
  const tasks = [];
  for (let i = 1; i <= 5; i++) {
    const akunFileName = `akun${i}.txt`;
    const proxyFileName = `proxy${i}.txt`;
    const userIds = readUserIds(akunFileName);
    const httpProxies = readHttpProxies(proxyFileName);

    for (let j = 0; j < Math.min(userIds.length, httpProxies.length); j++) {
      tasks.push(connectToWss(httpProxies[j], userIds[j]));
    }
  }
  await Promise.all(tasks);
}

module.exports = { main };

main().catch(console.error);
