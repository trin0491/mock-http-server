import * as express from "express";
import {IncomingMessage, Server} from "http";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IServer} from "./server";

export class ExpressServer implements IServer {

  private requests: IncomingMessage[] = [];
  private responses: IMockResponse[] = [];
  private openTxs: Array<{ resolve: (value: IncomingMessage) => void, reject: (reason: any) => void }> = [];
  private server: Server = null;

  constructor(private app: express.Express) {

  }

  public respond(mockResponse: IMockResponse): void {
    if (!this.isStarted()) {
      throw new Error("Server is not started");
    }
    this.responses.unshift(mockResponse);
    this.evaluate();
  }

  public getRequest(): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      this.openTxs.unshift({resolve, reject});
      this.evaluate();
    });
  }

  public isStarted(): boolean {
    return this.server !== null;
  }

  public start(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isStarted()) {
        reject(new Error("Server is already running"));
        return;
      }
      // TODO need to determine paths to map mock responses from config
      this.app.use("/api", this.onRequest.bind(this));
      this.server = this.app.listen(config.port, (err) => {
        if (err) {
          this.server = null;
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isStarted()) {
        reject(new Error("Server is not started"));
      }
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  private onRequest(req: express.Request, res: express.Response): void {
    this.requests.unshift(req);
    if (this.hasResponse(req)) {
      const scenario = this.getResponse(req);
      if (scenario.delay > 0) {
        setTimeout(() => this.returnResponse(res, scenario), scenario.delay);
      } else {
        this.returnResponse(res, scenario);
      }
    }
  }

  // noinspection JSMethodCanBeStatic
  private returnResponse(res: express.Response, response: IMockResponse): void {
    if (response.status) {
      res.status(response.status);
    } else {
      res.status(200);
    }
    res.json(response.data);
  }

  private hasResponse(req: express.Request): boolean {
    return this.responses.filter((response) => req.url.match(response.expression) &&
      response.method === req.method).length > 0;
  }

  private getResponse(req: express.Request): IMockResponse {
    return this.responses.pop();
  }

  private evaluate(): void {
    this.openTxs = this.openTxs.reduce((values, handler) => {
      if (this.requests.length > 0) {
        handler.resolve(this.requests.pop());
      } else {
        values.push(handler);
      }
      return values;
    }, []);
  }
}
