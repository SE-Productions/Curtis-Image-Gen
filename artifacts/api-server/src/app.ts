import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

// Restrict CORS to same-origin requests only (no cross-origin access).
// The studio frontend and API are co-located; external origins are rejected.
app.use(cors({ origin: false }));

app.use(cookieParser());

// 22 MB limit covers the 16 MB base64 scene image payload plus JSON framing
app.use(express.json({ limit: "22mb" }));
app.use(express.urlencoded({ extended: true, limit: "22mb" }));

app.use("/api", router);

const requestSizeErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  next(error);
};

app.use(requestSizeErrorHandler);

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
