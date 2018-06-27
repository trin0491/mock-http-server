import {ExpressServer} from "./ExpressServer";

describe("ExpressServer", () => {

  const PORT = 3000;

  let server: ExpressServer;
  let mockApp;
  let mockHttp;

  beforeEach(() => {
    mockApp = jasmine.createSpyObj("app", ["use", "listen"]);
    mockHttp = jasmine.createSpyObj("http.Server", ["close"]);
    server = new ExpressServer(mockApp);
  });

  function expectListen() {
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

  describe("start()", () => {
    it("should start express on the port specified", () => {
      expectListen();
      return server.start({port: PORT}).then(() => {
        expect(mockApp.listen).toHaveBeenCalled();
        expect(server.isStarted()).toBe(true);
      });
    });

    it("should rethrow errors from express", () => {
      mockApp.listen.and.callFake((port, callback) => {
        setTimeout(() => callback(new Error("Express failed to start")), 0);
        return server;
      });
      return server.start({port: PORT}).catch((err) => {
        expect(err.message).toBe("Express failed to start");
        expect(server.isStarted()).toBe(false);
      });
    });

    it("should reject calls when already started", () => {
      expectListen();
      return server.start({port: PORT}).then(() => {
        return server.start({port: PORT}).catch((err) => {
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
      return server.start({port: PORT}).then(() => {
        expectClose();
        return server.stop().then(() => {
          expect(mockHttp.close).toHaveBeenCalled();
          expect(server.isStarted()).toBe(false);
        });
      });
    });

    it("should rethrow errors from express", () => {
      expectListen();
      return server.start({port: PORT}).then(() => {
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

});
