import path from "node:path";
import express from "express";
import session from "express-session";
import methodOverride from "method-override";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { attachCsrfToken } from "./middleware/csrf";
import { formatAudienceHtml, getAudienceTopics, getSettings } from "./services/contentService";
import publicRouter from "./routes/public";
import adminRouter from "./routes/admin";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(env.rootDir, "src", "views"));

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/styles", express.static(path.join(env.rootDir, "src", "public", "styles")));
app.use("/scripts", express.static(path.join(env.rootDir, "src", "public", "scripts")));
app.use("/images", express.static(path.join(env.rootDir, "src", "public", "images")));
app.use("/uploads", express.static(env.uploadsDir));
app.get("/logo.jpg", (_req, res) => {
  res.sendFile(path.join(env.rootDir, "logo.jpg"));
});
app.use(attachCsrfToken);

app.use((req, res, next) => {
  const settings = getSettings();
  res.locals.site = settings;
  res.locals.audienceTopics = getAudienceTopics(settings);
  res.locals.aboutAudienceHtml = formatAudienceHtml(settings.aboutAudience);
  res.locals.path = req.path;
  res.locals.admin = req.session.adminLogin ? { login: req.session.adminLogin } : null;
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash ?? null;
  delete req.session.flash;
  next();
});

app.use(publicRouter(formLimiter));
app.use("/admin", loginLimiter, adminRouter());

app.use((_req, res) => {
  res.status(404).render("404", {
    meta: {
      title: "Страница не найдена",
      description: "Запрошенная страница отсутствует."
    }
  });
});

export default app;
