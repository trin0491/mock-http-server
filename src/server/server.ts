import app from "./app";
import {ExpressServer} from "./ExpressServer";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IRequest} from "./IRequest";

export interface IServer {
  respond(mockResponse: IMockResponse, options?: any);

  getRequest(mockResponse: IMockResponse, options?: any): Promise<IRequest>;

  isStarted(): boolean;

  start(config: IConfig): Promise<void>;

  stop(): Promise<void>;
}

export const server: IServer = new ExpressServer(app);
