declare module 'smtp-connection' {
  interface SMTPConnectionOptions {
    host: string;
    port: number;
    secure?: boolean;
    tls?: {
      rejectUnauthorized?: boolean;
    };
  }

  class SMTPConnection {
    constructor(options: SMTPConnectionOptions);
    connect(callback: () => void): void;
    quit(): void;
    on(event: string, callback: (error?: Error) => void): void;
  }

  interface SMTPConnectionModule {
    SMTPConnection: typeof SMTPConnection;
  }

  const module: SMTPConnectionModule;
  export = module;
}