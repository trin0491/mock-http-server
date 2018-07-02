// tslint:disable-next-line
declare namespace jasmine {
  // tslint:disable-next-line
  interface Matchers<T> {
    toBeFromHttpReq(req): void;
  }
}
