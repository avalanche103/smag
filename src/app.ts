import path from "node:path";
import crypto from "node:crypto";
import compression from "compression";
import express from "express";
import session from "express-session";
import methodOverride from "method-override";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import FileStoreFactory from "session-file-store";
import { env } from "./config/env";
import { attachCsrfToken } from "./middleware/csrf";
import { formatAudienceHtml, formatIssuePeriod, formatRichHtml, getAudienceTopics, getPageExtra, getPublishedMaterialSections, getSettings, parseIssueYear, stripHtmlTags } from "./services/contentService";
import { getCoverThumbPath } from "./utils/imageProcessing";
import publicRouter from "./routes/public";
import adminRouter from "./routes/admin";

const FileStore = FileStoreFactory(session);
const app = express();

if (env.isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(env.rootDir, "src", "views"));

app.use(compression());
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as express.Response).locals.cspNonce}'`, "https://www.googletagmanager.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://www.google-analytics.com", "https://region1.google-analytics.com", "https://www.googletagmanager.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    }
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

const sessionStore = new FileStore({
  path: path.join(env.dataDir, "sessions"),
  ttl: 60 * 60 * 8,
  retries: 0
});

app.use(
  session({
    store: sessionStore,
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const staticOptions = { maxAge: env.isProduction ? "1y" : 0, immutable: env.isProduction };
const uploadStaticOptions = { maxAge: env.isProduction ? "7d" : 0 };

app.use("/styles", express.static(path.join(env.rootDir, "src", "public", "styles"), staticOptions));
app.use("/scripts", express.static(path.join(env.rootDir, "src", "public", "scripts"), staticOptions));
app.use("/images", express.static(path.join(env.rootDir, "src", "public", "images"), staticOptions));
app.use("/uploads/covers", express.static(env.coversDir, uploadStaticOptions));
app.use("/uploads/lists", express.static(env.listsDir, uploadStaticOptions));
app.get("/logo.jpg", (_req, res) => {
  res.sendFile(path.join(env.rootDir, "logo.jpg"));
});
app.get("/favicon.ico", (_req, res) => {
  res.sendFile(path.join(env.rootDir, "src", "public", "images", "favicon.png"));
});
app.use(attachCsrfToken);

app.use((req, res, next) => {
  const settings = getSettings();
  res.locals.site = {
    ...settings,
    // Analytics only from env, not CMS settings
    analyticsId: env.analyticsId
  };
  res.locals.audienceTopics = getAudienceTopics(settings);
  res.locals.aboutAudienceHtml = formatAudienceHtml(settings.aboutAudience);
  res.locals.formatIssuePeriod = formatIssuePeriod;
  res.locals.parseIssueYear = parseIssueYear;
  res.locals.formatRichHtml = formatRichHtml;
  res.locals.getPageExtra = getPageExtra;
  res.locals.stripHtmlTags = stripHtmlTags;
  res.locals.getPublishedMaterialSections = getPublishedMaterialSections;
  res.locals.getCoverThumbPath = getCoverThumbPath;
  res.locals.path = req.path;
  res.locals.assetVersion = env.assetVersion;
  res.locals.admin = req.session.adminLogin
    ? { login: req.session.adminLogin, role: req.session.adminRole ?? "admin" }
    : null;
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash ?? null;
  delete req.session.flash;
  next();
});

app.use(publicRouter(formLimiter));
app.use("/admin", adminRouter());

app.use((_req, res) => {
  res.status(404).render("404", {
    meta: {
      title: "Страница не найдена",
      description: "Запрошенная страница отсутствует."
    }
  });
});

export default app;
