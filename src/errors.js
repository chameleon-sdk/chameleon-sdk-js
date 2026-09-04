/** Error returned by the Chameleon SDK gateway. Provider credentials are never included. */
export class ChameleonSdkError extends Error {
  constructor({ status, code, message, requestId }) {
    super(message);
    this.name = "ChameleonSdkError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}
