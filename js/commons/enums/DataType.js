"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataType = void 0;
/* Obs: Os valores são iguais aos nomes
para facilitar o Debug */
var DataType;
(function (DataType) {
    DataType["KNOWN_HOSTS"] = "KNOWN_HOSTS";
    DataType["PEER_INTRODUCTION"] = "PEER_INTRODUCTION";
    DataType["NAME_CHANGED"] = "NAME_CHANGED";
    DataType["MESSAGE"] = "MESSAGE";
    DataType["STATE"] = "STATE";
})(DataType || (DataType = {}));
exports.DataType = DataType;
