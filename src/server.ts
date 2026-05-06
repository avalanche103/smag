import app from "./app";
import { env } from "./config/env";
import "./db";

app.listen(env.port, () => {
  console.log(`SMAG site started on ${env.siteUrl}`);
});
