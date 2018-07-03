import * as express from "express";
import {ExpressServer} from "./ExpressServer";
import {IConfig} from "./IConfig";
import {ITestRequest} from "./ITestRequest";
import {ITestResponse} from "./ITestResponse";

describe("ExpressServer", () => {

  const ERR_NOT_STARTED = "Server has not been started";
  const PORT = 3000;
  const URL = "/api/some/path?withParam=abc";
  const METHOD = "GET";

  let server: ExpressServer;
  let mockApp;
  let mockHttp;
  let requestCallback: (req, res, next) => void;
  let config: IConfig;
  let requestId: number;

  beforeEach(() => {
    requestId = 0;
    requestCallback = null;
    config = {port: PORT, paths: ["/api"]};
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    mockHttp = jasmine.createSpyObj("http.Server", ["close"]);
    server = new ExpressServer(mockApp);
  });

  function expectListen() {
    mockApp.use.and.callFake((path, callback) => {
      expect(path).toBe(config.paths[0]);
      expect(callback).toBeDefined();
      requestCallback = callback;  // last callback should be request callback
    });

    mockApp.listen.and.callFake((port, callback) => {
      expect(port).toBe(PORT);
      setTimeout(callback, 0);
      return mockHttp;
    });
  }

  function expectClose() {
    mockHttp.close.and.callFake((callback) => {
      setTimeout(callback, 0);
    });
  }

  function newMockResponse(): ITestResponse {
    return {
      data: {aKey: "aValue"},
      expression: "/api/some/path",
      method: "GET",
    };
  }

  function newMockHttpRequest() {
    const req = jasmine.createSpyObj("express.Request", ["get"]);
    req.originalUrl = URL;
    req.method = METHOD;
    req.body = {requestId: ++requestId};
    const res = jasmine.createSpyObj("express.Response", ["json", "status", "sendStatus"]);
    const next = jasmine.createSpy("express.NextFunction");
    return [req, res, next];
  }

  function expectResponse(mockRes, testResponse: ITestResponse) {
    expect(mockRes.status).toHaveBeenCalledWith(testResponse.status ? testResponse.status : 200);
    expect(mockRes.json).toHaveBeenCalledWith(testResponse.data);
  }

  function expectNoResponse(mockRes) {
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  }

  function expectRequest(request: ITestRequest, mockReq: express.Request) {
    expect(request.method).toBe(mockReq.method);
    expect(request.url).toBe(mockReq.originalUrl);
    expect(request.body.requestId).toBe(mockReq.body.requestId, "requestId did not match");
    expect(request.headers).toBeDefined();
  }

  describe("start()", () => {
    it("should start express on the port specified", () => {
      expectListen();
      return server.start(config).then(() => {
        expect(mockApp.use).toHaveBeenCalledTimes(2);
        expect(requestCallback).not.toBeNull();
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(true);
      });
    });

    it("should rethrow errors from express", () => {
      mockApp.listen.and.callFake((port, callback) => {
        setTimeout(() => callback(new Error("Express failed to start")), 0);
        return server;
      });
      return server.start(config).catch((err) => {
        expect(err.message).toBe("Express failed to start");
        expect(mockApp.use).toHaveBeenCalledTimes(2);
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });

    it("should reject calls when it has already been started", () => {
      expectListen();
      return server.start(config).then(() => {
        return server.start(config).catch((err) => {
          expect(mockApp.use).toHaveBeenCalledTimes(2);
          expect(mockApp.listen).toHaveBeenCalledTimes(1);
          expect(err.message).toBe(ERR_NOT_STARTED);
          expect(server.isStarted()).toBe(true);
        });
      });
    });
  });

  describe("stop()", () => {
    it("should stop the server if it has been started", () => {
      expectListen();
      return server.start(config).then(() => {
        expectClose();
        return server.stop().then(() => {
          expect(mockHttp.close).toHaveBeenCalled();
          expect(server.isStarted()).toBe(false);
        });
      });
    });

    it("should rethrow errors from express", () => {
      expectListen();
      return server.start(config).then(() => {
        mockHttp.close.and.callFake((callback) => {
          setTimeout(() => callback(new Error("Server failed to stop")), 0);
        });
        return server.stop().catch((err) => {
          expect(err.message).toBe("Server failed to stop");
          expect(server.isStarted()).toBe(true);
        });
      });
    });

    it("should not stop the server if it has not been started", () => {
      return server.stop().catch((err) => {
        expect(err.message).toBe(ERR_NOT_STARTED);
        expect(mockHttp.close).not.toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });
  });

  describe("respond()", () => {
    it("should throw an error if the server has not been started", () => {
      const testResponse = newMockResponse();
      expect(() => server.respond(testResponse)).toThrow();
    });

    it("should queue the response if the request has not been received", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, testResponse);
    });

    it("should immediately respond if the request has already been received", async () => {
      expectListen();
      await server.start(config);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);

      const testResponse = newMockResponse();
      server.respond(testResponse);

      expectResponse(mockRes, testResponse);
    });

    it("should ignore requests if the path does not match", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      testResponse.expression = "/api/a/different/path";
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);
    });

    it("should ignore requests if the method does not match", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      testResponse.method = "POST";
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectNoResponse(mockRes);
    });

    it("should use the mock response status if it is provided", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      testResponse.status = 401;
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, testResponse);
    });

    it("should return the first matching mock response", async () => {
      expectListen();
      await server.start(config);

      const testResponse1 = newMockResponse();
      testResponse1.method = "POST";
      testResponse1.data = {value: "1"};
      server.respond(testResponse1);

      const testResponse2 = newMockResponse();
      testResponse2.data = {value: "2"};
      server.respond(testResponse2);

      const testResponse3 = newMockResponse();
      testResponse3.data = {value: "3"};
      server.respond(testResponse3);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, testResponse2);
    });

    it("should only respond once", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expectResponse(mockRes, testResponse);

      requestCallback(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledTimes(1);
      expect(mockRes.json).toHaveBeenCalledTimes(1);
    });

    it("should return 404 to http requests when the server is stopped", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      server.respond(testResponse);

      expectClose();
      await server.stop();

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(404);
    });

    it("should pass any error response error back to express to be sent as a fault", async () => {
      expectListen();
      await server.start(config);

      const testResponse = newMockResponse();
      testResponse.data = () => { /* this wouldn't parse to json */
      };
      server.respond(testResponse);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      const errorMsg = "Failed to parse mock response into json";
      mockRes.json.and.throwError(errorMsg);

      requestCallback(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error(errorMsg));
    });
  });

  describe("getRequest()", () => {
    it("should reject calls if the server has not been started", () => {
      server.getRequest(newMockResponse()).catch((err) => {
        expect(err.message).toBe(ERR_NOT_STARTED);
      });
    });

    it("should return the request if it is received after the call", async () => {
      expectListen();
      await server.start(config);

      const [mockReq, mockRes, mockNext] = newMockHttpRequest();

      const requestValidated = server.getRequest(newMockResponse())
        .then((request: ITestRequest) => expectRequest(request, mockReq))
        .then(() => expectNoResponse(mockRes));

      requestCallback(mockReq, mockRes, mockNext);

      return requestValidated;
    });

    it("should return the request if it is received before the call", async () => {
      expectListen();
      await server.start(config);

      const [mockReq1, mockRes1, mockNext1] = newMockHttpRequest();

      requestCallback(mockReq1, mockRes1, mockNext1);

      return server.getRequest(newMockResponse())
        .then((request: ITestRequest) => expectRequest(request, mockReq1));
    });

    it("should allow a response to be sent", async () => {
      expectListen();
      await server.start(config);

      const [mockReq1, mockRes1, mockNext1] = newMockHttpRequest();

      const testResponse = newMockResponse();

      const requestValidated = server.getRequest(testResponse)
        .then((request: ITestRequest) => expectRequest(request, mockReq1))
        .then(() => server.respond(testResponse))
        .then(() => expectResponse(mockRes1, testResponse));

      requestCallback(mockReq1, mockRes1, mockNext1);

      return requestValidated;
    });
  });

  describe("getRequests()", () => {
    it("should throw an error if the server has not been started", () => {
      expect(() => server.getRequests()).toThrowError(ERR_NOT_STARTED);
    });

    it("should return an empty array when there are no requests", async () => {
      expectListen();
      await server.start(config);

      expect(server.getRequests()).toEqual([]);
    });

    it("return convert express requests to a ITestRequest", async () => {
      expectListen();
      await server.start(config);
      const [mockReq, mockRes, mockNext] = newMockHttpRequest();
      requestCallback(mockReq, mockRes, mockNext);

      expect(server.getRequests().length).toBe(1);
      expectRequest(server.getRequests()[0], mockReq);
    });
  });

  describe("getResponses()", () => {
    it("should throw an error if the server is not started", () => {
      expect(() => server.getResponses()).toThrowError(ERR_NOT_STARTED);
    });

    it("should return an empty array when there are no responses", async () => {
      expectListen();
      await server.start(config);

      expect(server.getResponses()).toEqual([]);
    });

    it("should convert response actions to ITestResponse", async () => {
      expectListen();
      await server.start(config);

      const mockResponse1 = newMockResponse();
      const mockResponse2 = newMockResponse();

      server.respond(mockResponse1);
      server.getRequest(mockResponse2);
      server.respond(mockResponse2);

      expect(server.getResponses().length).toBe(2);
      expect(server.getResponses()[0]).toBe(mockResponse2);
      expect(server.getResponses()[1]).toBe(mockResponse1);
    });
  });
});
