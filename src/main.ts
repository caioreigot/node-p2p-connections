import net from 'net';
import sha from 'sha256';
import Peer from './Peer';
import Data from './commons/interfaces/Data';
import { DataType } from './commons/enums/DataType';
import { app, dialog, BrowserWindow, ipcMain } from 'electron';
import { ErrorMessage } from './commons/enums/ErrorMessage';
import { ErrorContext } from './commons/enums/ErrorContext';

let mainWindow: BrowserWindow;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minHeight: 600,
    minWidth: 350,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadURL(`file://${__dirname}/view/index.html`);
});

const receivedDataSignatures: string[] = [];

// Estado inicial da sala
const state: State = {
  counter: 0
}

let myKey: string;

let thisPeerName: string;
let peer: Peer;

let isChatVisible: boolean = false;

// Gera o valor de "myKey" uma vez que a porta é passada
function generateMyKey(port: number) {
  const timestamp = Date.now();
  const randomNumber = Math.floor((Math.random() * 10000) + 1000);
  myKey = sha(port + '' + timestamp + '' + randomNumber);
}

// Gera a assinatura para os dados enviados aos Peers
function generateSignature(content: string, key: string): string {
  return sha(content + key + Date.now());
}

function createServer(name: string, port: number) {
  generateMyKey(port);

  peer = new Peer(name, port, state);
  peer.createServer();
  listenPeerEvents(peer);
}

function directConnection(
  name: string, 
  host: string, 
  port: number
) {
  generateMyKey(port);

  peer = new Peer(name, 0, state);
  peer.connectTo(host, port);
  listenPeerEvents(peer);
}

function listenPeerEvents(peer: Peer) {
  peer.onConnection = onConnection;
  peer.onError = onError;
  peer.onData = onData
}

// Função chamada quando este Peer recebe uma conexão
function onConnection(socket: net.Socket, peerName: string) {
  if (!isChatVisible) {
    mainWindow.webContents.send('show-chat', thisPeerName);
    isChatVisible = true;
  }
  
  const log = `"${peerName}" connected to the room.`;
  mainWindow.webContents.send('log-chat', log);
}

// Função chamada quando este peer recebe uma informação
function onData(
  socket: net.Socket,
  data: Data
) {
  // Se os dados tiverem uma assinatura
  if (data.signature) {
    // Se essa assinatura é igual a alguma das assinaturas recebidas
    if (receivedDataSignatures.includes(data.signature)) {
      // Já recebi esses dados, então retorne
      return;
    }

    // Adiciona a assinatura ao array de assinaturas recebidas
    receivedDataSignatures.push(data.signature);
  }
  
  switch (data.type) {
    case DataType.NAME_IN_USE:
      dialog.showErrorBox(
        'Connection Error',
        ErrorMessage.NAME_IN_USE
      );

      mainWindow.webContents.send('connect-error');
      break;

    case DataType.KNOWN_HOSTS:
      if (!isChatVisible) {
        mainWindow.webContents.send('show-chat', thisPeerName);
        isChatVisible = true;
      }
      break;

    case DataType.STATE:
      peer.state = data.content;
      mainWindow.webContents.send('set-state', data.content);
      break;

    case DataType.MESSAGE:
      mainWindow.webContents.send(
        'new-message', 
        data.senderName, 
        data.content
      );
      break;
  }
}

// Função chamada quando ocorre algum erro no Peer
function onError(err: Error, context: ErrorContext) {
  console.log('ON ERROR CALLED IN MAIN');
  let errorMessage: ErrorMessage = ErrorMessage.UNEXPECTED;

  switch (context) {
    case ErrorContext.CONNECT:  
      if (err.message.includes('ETIMEDOUT')) {
        errorMessage = ErrorMessage.ETIMEDOUT;
      } else if (err.message.includes('ECONNREFUSED')) {
        errorMessage = ErrorMessage.ECONNREFUSED;
      } else if (err.message.includes('ENOTFOUND')) {
        errorMessage = ErrorMessage.ENOTFOUND;
      }
  
      dialog.showErrorBox(
        'Connection Error',
        errorMessage.concat(`\n\n${err.message}`)
      );
  
      mainWindow.webContents.send('connect-error');
      break;
    
    case ErrorContext.SERVER:
      if (err.message.includes('EADDRINUSE')) {
        errorMessage = ErrorMessage.EADDRINUSE;
      }
  
      dialog.showErrorBox(
        'Connection Error',
        errorMessage.concat(`\n\n${err.message}`)
      );
  
      mainWindow.webContents.send('listen-port-error');
      break;
  }
}

// Quando o cliente clicar no botão de "Listen"
ipcMain.on('listen', (event, name: string, port: number) => {
  // Se o nome estiver vazio ou for feito de apenas espaços
  if (!name.replace(/\s/g, '').length) {
    dialog.showMessageBox(
      mainWindow, { 
        title: 'Warning', 
        message: 'Field "Nickname" is required' 
      }
    );
    
    return;
  }

  thisPeerName = name;

  createServer(name, port);

  // Avisa o render process que o servidor foi criado
  event.reply('server-created', port);
});

// Quando o cliente clicar no botão de "Connect"
ipcMain.on('connect', (event, name: string, obj) => {
  // Se o nome estiver vazio ou for feito de apenas espaços
  if (!name.replace(/\s/g, '').length) {
    dialog.showMessageBox(
      mainWindow, { 
        title: 'Warning', 
        message: 'Field "Nickname" is required' 
      }
    );

    mainWindow.webContents.send('connect-error');
    
    return;
  }

  /* Se as strings não tiverem um tamanho maior
  que 0 e forem formadas por espaços */
  if (!obj.ip.replace(/\s/g, "").length 
    || !obj.port.replace(/\s/g, "").length
  ) {
    dialog.showMessageBox(
      mainWindow, { 
        title: 'Warning',
        message: 'Please fill in the "IP" and "Port" fields correctly' 
      }
    );

    mainWindow.webContents.send('connect-error');

    return;
  }

  thisPeerName = name;

  directConnection(name, obj.ip, parseInt(obj.port));
});

// Quando o cliente tiver pressionado ENTER no input de mensagem
ipcMain.on('message-sent', (event, message) => {
  const signature: string = generateSignature(
    message, myKey
  );

  const data: Data = {
    signature,
    type: DataType.MESSAGE,
    senderName: thisPeerName,
    content: message
  }

  peer.broadcast(data);
});

// Quando o cliente tiver incrementado o contador
ipcMain.on('incremented-counter', event => {
  peer.state.counter = peer.state.counter + 1;

  const signature: string = generateSignature(
    JSON.stringify(peer.state), myKey
  );

  const data: Data = {
    signature,
    type: DataType.STATE,
    senderName: thisPeerName,
    content: peer.state
  }

  peer.broadcast(data);
});