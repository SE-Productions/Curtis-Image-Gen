import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "14mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.SERVE_STUDIO_STATIC === "true") {
  const studioDist = path.resolve(
    process.cwd(),
    "artifacts",
    "curtis-image-studio",
    "dist",
    "public",
  );
  const indexFile = path.join(studioDist, "index.html");

  app.use(express.static(studioDist));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      req.accepts("html")
    ) {
      res.sendFile(indexFile);
      return;
    }
    next();
  });
}

export default app;
