import { ipcRenderer } from 'electron';

let peerName: string;

let ipToConnect: string;
let portToConnect: number;
let portToListen: number;

var waitingTextAnimationInterval: number;

const nameInput: HTMLInputElement = document
  .querySelector('#name-input')!;

const connectionContainer: HTMLDivElement = document
  .querySelector('#connection-container')!;

const mainMenuWrapper: HTMLDivElement = document
  .querySelector('#connection-container .wrapper')!;

const chatContainer: HTMLDivElement = document
  .querySelector('#chat-container')!;

const waitingText: HTMLParagraphElement = document
  .querySelector('#waiting-text')!;

const incrementCounterBtn: HTMLButtonElement = document
  .querySelector('#increase-count')!;

const countNumber: HTMLParagraphElement = document
  .querySelector('#count p')!;

const nickname: HTMLParagraphElement = document
  .querySelector('#nickname')!;

const messageInput: HTMLInputElement = document
  .querySelector('#message-input')!;

const messages: HTMLDivElement = document
  .querySelector('#messages')!;

/* Botão de "Ouvir" */
document.querySelector('#port-input-container .connection-buttons')
  ?.addEventListener('click', listenButtonOnClick);

/* Botão de "Conectar" */
document.querySelector('#connect-container .connection-buttons')
  ?.addEventListener('click', connectButtonOnClick);

incrementCounterBtn.onclick = () => {
  incrementCounter();

  // Avisa ao Main que o counter foi incrementado
  ipcRenderer.send('incremented-counter');
}

messageInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    const entry = messageInput.value;
    messageInput.value = '';

    ipcRenderer.send('message-sent', entry);
    renderMessage(peerName, entry);
  }
});

function listenButtonOnClick() {
  const portToListenInput: HTMLInputElement = document
    .querySelector('#port-input-container .port-input')!;

  /* Se a string tiver um tamanho maior que 0 e 
  não for formada de espaços */
  if (portToListenInput.value.replace(/\s/g, "").length) {
    portToListen = parseInt(portToListenInput.value);
    
    ipcRenderer.send('listen', nameInput.value, portToListen);
  }
}

function connectButtonOnClick() {
  const ipToConnectInput: HTMLInputElement = document
    .querySelector('#ip-input')!;
  
  const portToConnectInput: HTMLInputElement = document
    .querySelector('#connect-container .port-input')!;

  /* Se as strings tiverem um tamanho maior que 
  0 e não forem formadas por espaços */
  if (ipToConnectInput.value.replace(/\s/g, "").length 
    && portToConnectInput.value.replace(/\s/g, "").length
  ) {
    ipToConnect = ipToConnectInput.value;
    portToConnect = parseInt(portToConnectInput.value);
    
    ipcRenderer.send(
      'connect',
      nameInput.value,
      { 
        ip: ipToConnect, 
        port: portToConnect 
      }
    );
  }
}

function animateWaitingText(port: number) {
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

function renderMessage(senderName: string, message: string) {
  const pElement: HTMLParagraphElement = document.createElement('p');
  const strongElement: HTMLElement = document.createElement('strong');

  strongElement.innerText = senderName;
  pElement.innerText = `: ${message}`;

  pElement.prepend(strongElement);
  
  // Método perigoso: Consegue renderizar elementos HTML na tela de outros Peers
  // ! pElement.innerHTML = `<strong>${senderName}</strong>: ${message}`;
  
  messages.appendChild(pElement);
}

function renderLog(log: string) {
  const pElement: HTMLParagraphElement = document.createElement('p');
  pElement.innerHTML = `> ${log}`;
  
  messages.appendChild(pElement);
}

function incrementCounter() {
  const incrementedValue: number = parseInt(countNumber.innerText) + 1;
  countNumber.innerText = incrementedValue.toString();
}

function setCounter(value: number) {
  countNumber.innerText = value.toString();
}

function showChat() {
  chatContainer.style.display = 'flex';
}

ipcRenderer.on('server-created', (event, port: number) => {
  mainMenuWrapper.style.display = 'none';
  waitingText.style.display = 'block';

  animateWaitingText(port);
});

ipcRenderer.on('show-chat', (event, name) => {
  peerName = name;

  waitingText.style.display = 'none';
  connectionContainer.style.display = 'none';

  nickname.innerText = name;

  window.clearInterval(waitingTextAnimationInterval);

  showChat();
});

ipcRenderer.on('log-chat', (event, log) => {
  renderLog(log);
});

ipcRenderer.on('new-message', (event, senderName, message) => {
  renderMessage(senderName, message);
});

ipcRenderer.on('set-state', (event, state) => {
  setCounter(state.counter);
});