const fs = require('fs');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const uuid = require('uuid');
const { v3: uuidv3 } = require('uuid');

const logger = console;

const accountFileData = fs.readFileSync('akun.txt', 'utf8');
const userIdList = accountFileData.split('\n').map(userId => userId.trim()).filter(userId => userId !== '');

const proxyFileData = fs.readFileSync('proxy.txt', 'utf8');
const httpProxyList = proxyFileData.split('\n').map(proxy => proxy.trim()).filter(proxy => proxy !== '');

async function connectToWss(httpProxy, userId) {
  const deviceId = uuidv3(httpProxy, uuid.NIL);
  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  };
  const agent = new HttpsProxyAgent(httpProxy);
  const uri = 'wss://proxy.wynd.network:4650/';

  while (true) {
    try {
      const ws = new WebSocket(uri, {
        agent: agent,
        headers: customHeaders,
        rejectUnauthorized: false,
      });

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
  const tasks = httpProxyList.map((proxy, index) => connectToWss(proxy, userIdList[index % userIdList.length]));
  await Promise.all(tasks);
}

module.exports = { main };

main().catch(console.error);
