declare module "session-file-store" {
  import type session from "express-session";

  interface FileStoreOptions {
    path?: string;
    ttl?: number;
    retries?: number;
  }

  function FileStoreFactory(sessionLib: typeof session): new (options?: FileStoreOptions) => session.Store;
  export = FileStoreFactory;
}
