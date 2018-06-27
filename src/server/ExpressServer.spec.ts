import {ExpressServer} from "./ExpressServer";
import {IMockResponse} from "./IMockResponse";

describe("ExpressServer", () => {

  const PORT = 3000;
  const URL = "/api/some/path?withParam=abc";

  let server: ExpressServer;
  let mockApp;
  let mockHttp;
  let requestCallback: (req, res) => void;
  let config;

  beforeEach(() => {
    requestCallback = null;
    config = {port: PORT};
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    mockHttp = jasmine.createSpyObj("http.Server", ["close"]);
    server = new ExpressServer(mockApp);
  });

  function expectListen() {
    mockApp.use.and.callFake((path, callback) => {
      // TODO specify path
      expect(path).toBeDefined();
      expect(callback).toBeDefined();
      requestCallback = callback;
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

  function newMockResponse(): IMockResponse {
    return {
      data: {aKey: "aValue"},
      expression: "/api/some/path",
      method: "GET",
    };
  }

  function newReq() {
    const req = jasmine.createSpyObj("express.Request", ["get"]);
    req.url = URL;
    req.method = "GET";
    return req;
  }

  describe("start()", () => {
    it("should start express on the port specified", () => {
      expectListen();
      return server.start(config).then(() => {
        expect(mockApp.use).toHaveBeenCalled();
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
        expect(mockApp.use).toHaveBeenCalled();
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });

    it("should reject calls when already started", () => {
      expectListen();
      return server.start(config).then(() => {
        return server.start(config).catch((err) => {
          expect(mockApp.use).toHaveBeenCalledTimes(1);
          expect(mockApp.listen).toHaveBeenCalledTimes(1);
          expect(err.message).toBe("Server is already running");
          expect(server.isStarted()).toBe(true);
        });
      });
    });
  });

  describe("stop()", () => {
    it("should stop the server if is is started", () => {
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

    it("should not stop the server if is not already started", () => {
      return server.stop().catch((err) => {
        expect(err.message).toBe("Server is not started");
        expect(mockHttp.close).not.toHaveBeenCalled();
        expect(server.isStarted()).toBe(false);
      });
    });
  });

  describe("respond()", () => {
    it("should throw an error if the server is not started", () => {
      const mockResponse = newMockResponse();
      expect(() => server.respond(mockResponse)).toThrow();
    });

    it("should queue responses if the request has not been received", async () => {
      expectListen();
      await server.start(config);
      const mockResponse = newMockResponse();
      server.respond(mockResponse);

      const mockReq = newReq();
      const mockRes = jasmine.createSpyObj("express.Response", ["json", "status"]);
      requestCallback(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse.data);
    });
  });

});
