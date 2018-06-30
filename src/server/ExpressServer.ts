import * as express from "express";
import {IncomingMessage, Server} from "http";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IServer} from "./server";

export class ExpressServer implements IServer {

  private requests: IncomingMessage[] = [];
  private mockResponses: IMockResponse[] = [];
  private openRequests: Array<{ req: express.Request, res: express.Response }> = [];
  private requestPromises: Array<{ resolve: (value: IncomingMessage) => void, reject: (reason: any) => void }> = [];
  private httpServer: Server = null;

  constructor(private app: express.Express) {
  }

  public respond(mockResponse: IMockResponse): void {
    if (!this.isStarted()) {
      throw new Error("Server is not started");
    }
    this.mockResponses.unshift(mockResponse);
    this.evaluate();
  }

  public getRequest(): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      this.requestPromises.unshift({resolve, reject});
      this.evaluate();
    });
  }

  public isStarted(): boolean {
    return this.httpServer !== null;
  }

  public start(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isStarted()) {
        reject(new Error("Server is already running"));
        return;
      }
      // TODO need to determine paths to map mock mockResponses from config
      this.app.use("/api", this.onRequest.bind(this));
      this.httpServer = this.app.listen(config.port, (err) => {
        if (err) {
          this.httpServer = null;
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
      this.httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.httpServer = null;
          resolve();
        }
      });
    });
  }

  private onRequest(req: express.Request, res: express.Response): void {
    if (this.isStarted()) {
      this.requests.unshift(req);
      this.openRequests.unshift({req, res});
      this.evaluate();
    } else {
      res.sendStatus(404);
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

  // noinspection JSMethodCanBeStatic
  private matches(req: express.Request, response: IMockResponse): boolean {
    return req.url.match(response.expression) && response.method === req.method;
  }

  private evaluate(): void {
    for (let i = this.openRequests.length - 1; i >= 0; --i) {
      const tx = this.openRequests[i];
      for (let j = this.mockResponses.length - 1; j >= 0; --j) {
        const mockResponse = this.mockResponses[j];
        if (this.matches(tx.req, mockResponse)) {
          this.openRequests.splice(i, 1);
          this.mockResponses.splice(j, 1);
          if (mockResponse.delay > 0) {
            setTimeout(() => this.returnResponse(tx.res, mockResponse), mockResponse.delay);
          } else {
            this.returnResponse(tx.res, mockResponse);
          }
        }
      }
    }
  }
}
