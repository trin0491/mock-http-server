import {IncomingMessage} from "http";
import app from "./app";
import {ExpressServer} from "./ExpressServer";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";

export interface IServer {
  respond(mockResponse: IMockResponse);

  getRequest(): Promise<IncomingMessage>;

  run(config: IConfig);
}

export const server: IServer = new ExpressServer(app);
