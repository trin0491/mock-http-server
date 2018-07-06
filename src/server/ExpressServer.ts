import * as express from "express";
import {Server} from "http";
import {IConfig} from "./IConfig";
import {ITestRequest} from "./ITestRequest";
import {ITestResponse} from "./ITestResponse";
import {IMockHttpServer} from "./server";

enum ActionType {
  GET_REQUEST,
  RESPOND,
}

interface IAction {
  type: ActionType;
  testResponse: ITestResponse;
  options: any;
  payload?: any;
}

interface ITransaction {
  req: express.Request;
  res: express.Response;
  next: express.NextFunction;
}

export class ExpressServer implements IMockHttpServer {

  private static readonly ERR_NOT_STARTED = "Server has not been started";
  private static readonly ERR_STARTED = "Server has already been started";

  private actions: IAction[] = [];
  private openTransactions: ITransaction[] = [];
  private httpServer: Server = null;

  constructor(private app: express.Express) {
  }

  public respond(testResponse: ITestResponse, options: any = {}): void {
    if (!this.isStarted()) {
      throw new Error(ExpressServer.ERR_NOT_STARTED);
    }
    this.addAction(ActionType.RESPOND, testResponse, options);
    this.processActions();
  }

  public getResponses(): ITestResponse[] {
    if (!this.isStarted()) {
      throw new Error(ExpressServer.ERR_NOT_STARTED);
    }
    return this.actions.filter((action: IAction) => {
      return action.type === ActionType.RESPOND;
    }).map((respondAction: IAction) => {
      return respondAction.testResponse;
    });
  }

  public getRequest(testResponse: ITestResponse, options: any = {}): Promise<ITestRequest> {
    return new Promise((resolve, reject) => {
      if (!this.isStarted()) {
        reject(new Error(ExpressServer.ERR_NOT_STARTED));
      }
      this.addAction(ActionType.GET_REQUEST, testResponse, options, {resolve, reject});
      this.processActions();
    });
  }

  public getRequests(): ITestRequest[] {
    if (!this.isStarted()) {
      throw new Error(ExpressServer.ERR_NOT_STARTED);
    }
    return this.openTransactions.map((tx) => this.toRequest(tx));
  }

  public isStarted(): boolean {
    return this.httpServer !== null;
  }

  public start(config: IConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isStarted()) {
        reject(new Error(ExpressServer.ERR_STARTED));
        return;
      }
      config.paths.forEach((path) => {
        this.app.use(path, express.json());  // to provide the body property on ITestRequest
        this.app.use(path, this.onRequest.bind(this));
      });
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
        reject(new Error(ExpressServer.ERR_NOT_STARTED));
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

  public clear() {
    if (!this.isStarted()) {
      throw new Error(ExpressServer.ERR_NOT_STARTED);
    }
    this.openTransactions.forEach((tx: ITransaction) => {
      tx.res.sendStatus(404);
    });
    this.openTransactions = [];
    this.actions = [];
  }

  private onRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (this.isStarted()) {
      this.openTransactions.unshift({req, res, next});
      this.processActions();
    } else {
      res.sendStatus(404);
    }
  }

  // noinspection JSMethodCanBeStatic
  private returnResponse(res: express.Response, response: ITestResponse): void {
    if (response.status) {
      res.status(response.status);
    } else {
      res.status(200);
    }
    res.json(response.data);
  }

  private addAction(type: ActionType, testResponse: ITestResponse, options: any, payload?: any) {
    this.actions.unshift({
      options,
      payload,
      testResponse,
      type,
    });
  }

  // noinspection JSMethodCanBeStatic
  private matches(action: IAction, tx: ITransaction): boolean {
    return tx.req.originalUrl.match(action.testResponse.expression) && action.testResponse.method === tx.req.method;
  }

  private processRespond(action: IAction, tx: ITransaction) {
    const testResponse = action.testResponse;
    if (testResponse.delay > 0) {
      setTimeout(() => this.returnResponse(tx.res, testResponse), testResponse.delay);
    } else {
      this.returnResponse(tx.res, testResponse);
    }
  }

  private processGetRequest(action: IAction, tx: ITransaction) {
    const resolve = action.payload.resolve;
    const request = this.toRequest(tx);
    resolve(request);
  }

  private processActions(): void {
    for (let i = this.openTransactions.length - 1; i >= 0; --i) {
      const tx = this.openTransactions[i];

      for (let j = this.actions.length - 1; j >= 0; --j) {
        const action = this.actions[j];

        if (this.matches(action, tx)) {
          this.actions.splice(j, 1);
          try {
            switch (action.type) {
              case ActionType.GET_REQUEST:
                this.processGetRequest(action, tx);
                break;
              case ActionType.RESPOND:
                this.openTransactions.splice(i, 1);
                this.processRespond(action, tx);
                break;
            }
          } catch (err) {
            tx.next(err);
          }
        }
      }
    }
  }

  // noinspection JSMethodCanBeStatic
  private toRequest(tx: ITransaction): ITestRequest {
    return {
      body: tx.req.body,
      headers: Object.assign({}, tx.req.headers),
      method: tx.req.method,
      url: tx.req.originalUrl,
    };
  }
}
