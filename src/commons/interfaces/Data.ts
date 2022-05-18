import { DataType } from "../enums/DataType";

export default interface Data {
  type: DataType,
  senderName: string,
  content: any
}