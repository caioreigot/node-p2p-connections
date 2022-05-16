"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMessage = void 0;
var ErrorMessage;
(function (ErrorMessage) {
    ErrorMessage["ECONNREFUSED"] = "Connection refused. It could be the Firewall or the port provided is not open on the server side. If you are trying to connect to an IP that is not on a local network, it needs to have port forwarding configured on the router.";
    ErrorMessage["ETIMEDOUT"] = "Your request is not receiving a response.";
    ErrorMessage["ENOTFOUND"] = "Could not find IP address.";
    ErrorMessage["EADDRINUSE"] = "This port is already being used.";
    ErrorMessage["NAME_IN_USE"] = "This name is already in use, please choose another one.";
    ErrorMessage["UNEXPECTED"] = "An error has occurred. Details below:";
})(ErrorMessage || (ErrorMessage = {}));
exports.ErrorMessage = ErrorMessage;
