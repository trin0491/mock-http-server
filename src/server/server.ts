import app from "./app";
import {ExpressServer} from "./ExpressServer";
import {IConfig} from "./IConfig";
import {ITestRequest} from "./ITestRequest";
import {ITestResponse} from "./ITestResponse";

export interface IMockHttpServer {
  respond(testResponse: ITestResponse, options?: any);

  getResponses(): ITestResponse[];

  getRequest(testResponse: ITestResponse, options?: any): Promise<ITestRequest>;

  getRequests(): ITestRequest[];

  isStarted(): boolean;

  start(config: IConfig): Promise<void>;

  stop(): Promise<void>;

  clear(): void;
}

export const server: IMockHttpServer = new ExpressServer(app);
