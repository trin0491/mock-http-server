import * as express from "express";
import {IncomingMessage} from "http";
import {IConfig} from "./IConfig";
import {IMockResponse} from "./IMockResponse";
import {IServer} from "./server";

export class ExpressServer implements IServer {

  private requests: IncomingMessage[] = [];
  private responses: IMockResponse[] = [];
  private openTxs: Array<{ resolve: (value: IncomingMessage) => void, reject: (reason: any) => void }> = [];
  private isRunning: boolean = false;

  constructor(private app: express.Express) {

  }

  public respond(mockResponse: IMockResponse): void {
    this.responses.unshift(mockResponse);
    this.evaluate();
  }

  public getRequest(): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      this.openTxs.unshift({resolve, reject});
      this.evaluate();
    });
  }

  public run(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error("Server is already running"));
        return;
      }
      this.isRunning = true;
      this.app.use("/api", this.onRequest.bind(this));
      this.app.listen(config.port, (err) => {
        if (err) {
          this.isRunning = false;
          reject(err);
        } else {
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
    res.status(response.status);
    res.json(response.data);
  }

  private hasResponse(req: express.Request): boolean {
    return this.responses.filter((response) => req.path.match(response.expression) &&
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
