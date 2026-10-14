declare module "*.sql?raw" {
  const content: string;
  export default content;
}

// Bindings visible to tests through `env` from "cloudflare:test"
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}
