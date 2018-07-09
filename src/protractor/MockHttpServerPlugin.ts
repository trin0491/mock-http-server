import {ProtractorPlugin} from "protractor";
import {server} from "..";

// creating a "var module: any" will allow use of module.exports
declare var module: any;

const plugin: ProtractorPlugin = {

  onPrepare() {
    const config = {
      paths: ["/api"],
      port: 3000,
    };
    return server.start(config)
      .catch((err) => console.error(`Failed to start mock server on port: ${config.port}`, err));
  },

  postTest(): void {
    try {
      const hasUnexpectedRequests: boolean = server.getRequests().length > 0;
      const hasNotReceivedRequests: boolean = server.getResponses().length > 0;
      if (hasUnexpectedRequests || hasNotReceivedRequests) {
        const requestUrls = server.getRequests().map((req) => req.url).join(", ");
        const responseUrls = server.getResponses().map((res) => res.expression).join(", ");
        throw new Error(`Received unexpected request(s): [${requestUrls}] and ` +
          `did not receive request(s) for: [${responseUrls}]`);
      }
    } finally {
      server.clear();
    }
  },
};

module.exports = plugin;
