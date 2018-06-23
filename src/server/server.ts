import * as express from "express";
import {IncomingMessage} from "http";
import {IConfig} from "..";
import {IMockResponse, IMockScenario} from "../model/IMockResponse";
import app from "./app";

export interface IServer {
  respond(mockResponse: IMockResponse);

  getRequest(): Promise<IncomingMessage>;

  run(config: IConfig);
}

class Server implements IServer {

  private requests: IncomingMessage[] = [];
  private responses: IMockResponse[] = [];
  private requestHandlers: Array<{ resolve: (value: IncomingMessage) => void, reject: (reason: any) => void }> = [];
  private isRunning: boolean = false;

  public respond(mockResponse: IMockResponse): void {
    this.responses.unshift(mockResponse);
    this.evaluate();
  }

  public getRequest(): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      this.requestHandlers.unshift({resolve, reject});
      this.evaluate();
    });
  }

  public run(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error("Server is already running"));
      }
      this.isRunning = true;
      app.use("/api", this.onRequest.bind(this));
      app.listen(config.port, (err) => {
        if (err) {
          this.isRunning = false;
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private onRequest(req: express.Request, res: express.Response) {
    this.requests.unshift(req);
    if (this.hasScenario(req)) {
      const scenario = this.getScenario(req);
      if (scenario.delay > 0) {
        setTimeout(() => this.execScenario(res, scenario), scenario.delay);
      } else {
        this.execScenario(res, scenario);
      }
    }
  }

  private execScenario(res: express.Response, scenario: IMockScenario) {
    res.status(scenario.status);
    res.json(scenario.data);
  }

  private hasScenario(req: express.Request) {
    return this.responses.filter((response) => req.path.match(response.expression) && response.method === req.method);
  }

  private getScenario(req: express.Request) {
    const mockResponse: IMockResponse = this.responses.pop();
    return mockResponse.scenario;
  }

  private evaluate() {
    this.requestHandlers = this.requestHandlers.reduce((values, handler) => {
      if (this.requests.length > 0) {
        handler.resolve(this.requests.pop());
      } else {
        values.push(handler);
      }
      return values;
    }, []);
  }
}

export const server: IServer = new Server();
