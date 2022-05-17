"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sha256_1 = __importDefault(require("sha256"));
const Peer_1 = __importDefault(require("./Peer"));
const DataType_1 = require("./commons/enums/DataType");
const electron_1 = require("electron");
const ErrorMessage_1 = require("./commons/enums/ErrorMessage");
const ErrorContext_1 = require("./commons/enums/ErrorContext");
let mainWindow;
electron_1.app.on('ready', () => {
    mainWindow = new electron_1.BrowserWindow({
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
const receivedDataSignatures = [];
// Estado inicial da sala
const state = {
    counter: 0
};
let myKey;
let thisPeerName;
let peer;
let isChatVisible = false;
// Gera o valor de "myKey" uma vez que a porta é passada
function generateMyKey(port) {
    const timestamp = Date.now();
    const randomNumber = Math.floor((Math.random() * 10000) + 1000);
    myKey = (0, sha256_1.default)(port + '' + timestamp + '' + randomNumber);
}
// Gera a assinatura para os dados enviados aos Peers
function generateSignature(content, key) {
    return (0, sha256_1.default)(content + key + Date.now());
}
function createServer(name, port) {
    generateMyKey(port);
    peer = new Peer_1.default(name, port, state);
    peer.createServer();
    listenPeerEvents(peer);
}
function directConnection(name, host, port) {
    generateMyKey(port);
    peer = new Peer_1.default(name, 0, state);
    peer.connectTo(host, port);
    listenPeerEvents(peer);
}
function listenPeerEvents(peer) {
    peer.onConnection = onConnection;
    peer.onError = onError;
    peer.onData = onData;
}
// Função chamada quando este Peer recebe uma conexão
function onConnection(socket, peerName) {
    if (!isChatVisible) {
        mainWindow.webContents.send('show-chat', thisPeerName);
        isChatVisible = true;
    }
    const log = `"${peerName}" connected to the room.`;
    mainWindow.webContents.send('log-chat', log);
}
// Função chamada quando este peer recebe uma informação
function onData(socket, data) {
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
        case DataType_1.DataType.NAME_IN_USE:
            electron_1.dialog.showErrorBox('Connection Error', ErrorMessage_1.ErrorMessage.NAME_IN_USE);
            mainWindow.webContents.send('connect-error');
            break;
        case DataType_1.DataType.KNOWN_HOSTS:
            if (!isChatVisible) {
                mainWindow.webContents.send('show-chat', thisPeerName);
                isChatVisible = true;
            }
            break;
        case DataType_1.DataType.STATE:
            peer.state = data.content;
            mainWindow.webContents.send('set-state', data.content);
            break;
        case DataType_1.DataType.MESSAGE:
            mainWindow.webContents.send('new-message', data.senderName, data.content);
            break;
    }
}
// Função chamada quando ocorre algum erro no Peer
function onError(err, context) {
    console.log('ON ERROR CALLED IN MAIN');
    let errorMessage = ErrorMessage_1.ErrorMessage.UNEXPECTED;
    switch (context) {
        case ErrorContext_1.ErrorContext.CONNECT:
            if (err.message.includes('ETIMEDOUT')) {
                errorMessage = ErrorMessage_1.ErrorMessage.ETIMEDOUT;
            }
            else if (err.message.includes('ECONNREFUSED')) {
                errorMessage = ErrorMessage_1.ErrorMessage.ECONNREFUSED;
            }
            else if (err.message.includes('ENOTFOUND')) {
                errorMessage = ErrorMessage_1.ErrorMessage.ENOTFOUND;
            }
            electron_1.dialog.showErrorBox('Connection Error', errorMessage.concat(`\n\n${err.message}`));
            mainWindow.webContents.send('connect-error');
            break;
        case ErrorContext_1.ErrorContext.SERVER:
            if (err.message.includes('EADDRINUSE')) {
                errorMessage = ErrorMessage_1.ErrorMessage.EADDRINUSE;
            }
            electron_1.dialog.showErrorBox('Connection Error', errorMessage.concat(`\n\n${err.message}`));
            mainWindow.webContents.send('listen-port-error');
            break;
    }
}
// Quando o cliente clicar no botão de "Listen"
electron_1.ipcMain.on('listen', (event, name, port) => {
    // Se o nome estiver vazio ou for feito de apenas espaços
    if (!name.replace(/\s/g, '').length) {
        electron_1.dialog.showMessageBox(mainWindow, {
            title: 'Warning',
            message: 'Field "Nickname" is required'
        });
        return;
    }
    thisPeerName = name;
    createServer(name, port);
    // Avisa o render process que o servidor foi criado
    event.reply('server-created', port);
});
// Quando o cliente clicar no botão de "Connect"
electron_1.ipcMain.on('connect', (event, name, obj) => {
    // Se o nome estiver vazio ou for feito de apenas espaços
    if (!name.replace(/\s/g, '').length) {
        electron_1.dialog.showMessageBox(mainWindow, {
            title: 'Warning',
            message: 'Field "Nickname" is required'
        });
        mainWindow.webContents.send('connect-error');
        return;
    }
    /* Se as strings não tiverem um tamanho maior
    que 0 e forem formadas por espaços */
    if (!obj.ip.replace(/\s/g, "").length
        || !obj.port.replace(/\s/g, "").length) {
        electron_1.dialog.showMessageBox(mainWindow, {
            title: 'Warning',
            message: 'Please fill in the "IP" and "Port" fields correctly'
        });
        mainWindow.webContents.send('connect-error');
        return;
    }
    thisPeerName = name;
    directConnection(name, obj.ip, parseInt(obj.port));
});
// Quando o cliente tiver pressionado ENTER no input de mensagem
electron_1.ipcMain.on('message-sent', (event, message) => {
    const signature = generateSignature(message, myKey);
    const data = {
        signature,
        type: DataType_1.DataType.MESSAGE,
        senderName: thisPeerName,
        content: message
    };
    peer.broadcast(data);
});
// Quando o cliente tiver incrementado o contador
electron_1.ipcMain.on('incremented-counter', event => {
    peer.state.counter = peer.state.counter + 1;
    const signature = generateSignature(JSON.stringify(peer.state), myKey);
    const data = {
        signature,
        type: DataType_1.DataType.STATE,
        senderName: thisPeerName,
        content: peer.state
    };
    peer.broadcast(data);
});
