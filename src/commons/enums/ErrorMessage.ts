enum ErrorMessage {
  ECONNREFUSED = 'Connection refused. It could be the Firewall or the port provided is not open on the server side. If you are trying to connect to an IP that is not on a local network, it needs to have port forwarding configured on the router.',
  ETIMEDOUT = 'Your request is not receiving a response.',
  ENOTFOUND = 'Could not find IP address.',
  EADDRINUSE = 'This port is already being used.',
  NAME_IN_USE = 'This name is already in use, please choose another one.',
  UNEXPECTED = 'An error has occurred. Details below:'
}

export { ErrorMessage }