"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
let peerName;
let ipToConnect;
let portToConnect;
let portToListen;
var waitingTextAnimationInterval;
const nameInput = document
    .querySelector('#name-input');
const connectionContainer = document
    .querySelector('#connection-container');
const mainMenuWrapper = document
    .querySelector('#connection-container .wrapper');
const chatContainer = document
    .querySelector('#chat-container');
const waitingText = document
    .querySelector('#waiting-text');
const incrementCounterBtn = document
    .querySelector('#increase-count');
const countNumber = document
    .querySelector('#count p');
const nickname = document
    .querySelector('#nickname');
const messageInput = document
    .querySelector('#message-input');
const messages = document
    .querySelector('#messages');
/* Botão de "Ouvir" */
(_a = document.querySelector('#port-input-container .connection-buttons')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', listenButtonOnClick);
/* Botão de "Conectar" */
(_b = document.querySelector('#connect-container .connection-buttons')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', connectButtonOnClick);
incrementCounterBtn.onclick = () => {
    incrementCounter();
    // Avisa ao Main que o counter foi incrementado
    electron_1.ipcRenderer.send('incremented-counter');
};
messageInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        const entry = messageInput.value;
        messageInput.value = '';
        electron_1.ipcRenderer.send('message-sent', entry);
        renderMessage(peerName, entry);
    }
});
function listenButtonOnClick() {
    const portToListenInput = document
        .querySelector('#port-input-container .port-input');
    /* Se a string tiver um tamanho maior que 0 e
    não for formada de espaços */
    if (portToListenInput.value.replace(/\s/g, "").length) {
        portToListen = parseInt(portToListenInput.value);
        electron_1.ipcRenderer.send('listen', nameInput.value, portToListen);
    }
}
function connectButtonOnClick() {
    const ipToConnectInput = document
        .querySelector('#ip-input');
    const portToConnectInput = document
        .querySelector('#connect-container .port-input');
    /* Se as strings tiverem um tamanho maior que
    0 e não forem formadas por espaços */
    if (ipToConnectInput.value.replace(/\s/g, "").length
        && portToConnectInput.value.replace(/\s/g, "").length) {
        ipToConnect = ipToConnectInput.value;
        portToConnect = parseInt(portToConnectInput.value);
        electron_1.ipcRenderer.send('connect', nameInput.value, {
            ip: ipToConnect,
            port: portToConnect
        });
    }
}
function animateWaitingText(port) {
    let count = 0;
    const baseText = `Waiting for connections on port ${port}.`;
    waitingText.innerText = baseText;
    waitingTextAnimationInterval = window.setInterval(() => {
        count++;
        waitingText.innerText = waitingText.innerText.concat('.');
        if (count == 3) {
            waitingText.innerText = baseText;
            count = 0;
        }
    }, 1000);
}
function renderMessage(senderName, message) {
    const pElement = document.createElement('p');
    const strongElement = document.createElement('strong');
    strongElement.innerText = senderName;
    pElement.innerText = `: ${message}`;
    pElement.prepend(strongElement);
    // Método perigoso: Consegue renderizar elementos HTML na tela de outros Peers
    // ! pElement.innerHTML = `<strong>${senderName}</strong>: ${message}`;
    messages.appendChild(pElement);
}
function renderLog(log) {
    const pElement = document.createElement('p');
    pElement.innerHTML = `> ${log}`;
    messages.appendChild(pElement);
}
function incrementCounter() {
    const incrementedValue = parseInt(countNumber.innerText) + 1;
    countNumber.innerText = incrementedValue.toString();
}
function setCounter(value) {
    countNumber.innerText = value.toString();
}
function showChat() {
    chatContainer.style.display = 'flex';
}
electron_1.ipcRenderer.on('server-created', (event, port) => {
    mainMenuWrapper.style.display = 'none';
    waitingText.style.display = 'block';
    animateWaitingText(port);
});
electron_1.ipcRenderer.on('show-chat', (event, name) => {
    peerName = name;
    waitingText.style.display = 'none';
    connectionContainer.style.display = 'none';
    nickname.innerText = name;
    window.clearInterval(waitingTextAnimationInterval);
    showChat();
});
electron_1.ipcRenderer.on('log-chat', (event, log) => {
    renderLog(log);
});
electron_1.ipcRenderer.on('new-message', (event, senderName, message) => {
    renderMessage(senderName, message);
});
electron_1.ipcRenderer.on('set-state', (event, state) => {
    setCounter(state.counter);
});
