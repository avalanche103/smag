import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export interface PublishedListEntry {
  section: string;
  title: string;
  author: string;
  issueNumber: number;
  warning?: string;
}

export interface PublishedListParseResult {
  year: number;
  entries: PublishedListEntry[];
  warnings: string[];
}

const SECTION_TITLES: Record<string, string> = {
  "АКТУАЛЬНЫЙ КОММЕНТАРИЙ": "Актуальный комментарий",
  "ОФИЦИАЛЬНЫЕ РАЗЪЯСНЕНИЯ": "Официальные разъяснения",
  "ВНОСИМ ЯСНОСТЬ": "Вносим ясность",
  "ТЕОРИЯ И ПРАКТИКА УЧЕТА": "Теория и практика учета",
  "НАЛОГООБЛОЖЕНИЕ В СТРОИТЕЛЬСТВЕ": "Налогообложение в строительстве",
  "ЦЕНООБРАЗОВАНИЕ В СТРОИТЕЛЬСТВЕ": "Ценообразование в строительстве",
  "ПРОВЕРКИ В СТРОИТЕЛЬСТВЕ": "Проверки в строительстве",
  "СУДЕБНАЯ ПРАКТИКА": "Судебная практика",
  "ВОПРОС-ОТВЕТ": "Вопрос-ответ",
  "ЮРИДИЧЕСКАЯ ПОМОЩЬ": "Юридическая помощь",
  "МИНСТРОЙАРХИТЕКТУРЫ РАЗЪЯСНЯЕТ": "Минстройархитектуры разъясняет"
};

const PERSON_AUTHOR = /^[А-ЯЁA-Z][а-яёa-z-]+(?:\s+[А-ЯЁA-Z][а-яёa-z-]+)*\s+[А-ЯЁA-Z]\.?$/;

function normalizeLine(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return normalizeLine(value).replace(/Ё/g, "Е").toUpperCase();
}

function isNoise(line: string): boolean {
  if (!line) {
    return true;
  }

  return (
    /СТРОИТЕЛЬСТВО:\s*ЭКОНОМИКА/i.test(line) ||
    /ПЕРЕЧЕНЬ ОПУ/i.test(line) ||
    /^Уважаемые читатели/i.test(line) ||
    /Для удобства пользования/i.test(line) ||
    /журналом «СТРОИТЕЛЬСТВО/i.test(line) ||
    /^УЧЕТ, ПРАВО»/i.test(line) ||
    /опубликованных в первом/i.test(line) ||
    /ваны по рубрикам/i.test(line) ||
    /^Наименование статьи/i.test(line) ||
    /^содержание вопроса/i.test(line) ||
    /^журнала$/i.test(line) ||
    /^страницы$/i.test(line) ||
    /^Номер$/i.test(line) ||
    /ИЮНЬ\s+\d{4}/i.test(line) ||
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)
  );
}

function matchSection(line: string): string | null {
  const key = normalizeKey(line);
  if (SECTION_TITLES[key]) {
    return SECTION_TITLES[key];
  }

  if (/^[А-ЯЁA-Z0-9\s\-—:]{12,}$/.test(line) && /[А-ЯЁA-Z]{8,}/.test(line) && !/[а-яё]/.test(line)) {
    return line.charAt(0) + line.slice(1).toLowerCase();
  }

  return null;
}

function isValidIssue(issueNumber: number): boolean {
  return issueNumber >= 1 && issueNumber <= 12;
}

function parseIssueLine(line: string): { issueNumber: number; page?: number } | null {
  const withPage = line.match(/^(\d{1,2})\s+(\d{1,3})$/);
  if (withPage) {
    const issueNumber = Number(withPage[1]);
    const page = Number(withPage[2]);
    if (isValidIssue(issueNumber) && page >= 1 && page <= 300) {
      return { issueNumber, page };
    }
  }

  const issueOnly = line.match(/^(\d{1,2})$/);
  if (issueOnly) {
    const issueNumber = Number(issueOnly[1]);
    if (isValidIssue(issueNumber)) {
      return { issueNumber };
    }
  }

  return null;
}

function extractTrailingIssue(line: string): { rest: string; issueNumber: number; page?: number } | null {
  const withPage = line.match(/^(.*?[А-Яа-яA-Za-z).])\s+(\d{1,2})\s+(\d{1,3})$/);
  if (withPage) {
    const issueNumber = Number(withPage[2]);
    const page = Number(withPage[3]);
    const rest = withPage[1].trim();
    if (rest && isValidIssue(issueNumber) && page >= 1 && page <= 300) {
      return { rest, issueNumber, page };
    }
  }

  const afterAuthor = line.match(/^(.*\))\s+(\d{1,2})$/);
  if (afterAuthor) {
    const issueNumber = Number(afterAuthor[2]);
    const rest = afterAuthor[1].trim();
    if (rest && isValidIssue(issueNumber)) {
      return { rest, issueNumber };
    }
  }

  return null;
}

function parseAuthorIssueLine(line: string): { author: string; issueNumber: number; page?: number } | null {
  const match = line.match(/^\(([^)]+)\)\s+(\d{1,2})(?:\s+(\d{1,3}))?$/);
  if (!match) {
    return null;
  }

  const author = match[1].trim();
  const issueNumber = Number(match[2]);
  const page = match[3] ? Number(match[3]) : undefined;
  if (!PERSON_AUTHOR.test(author) || issueNumber < 1 || issueNumber > 12) {
    return null;
  }

  return { author, issueNumber, page };
}

function appendTitle(buffer: string, line: string): string {
  if (!buffer) {
    return line;
  }

  if (buffer.endsWith("-") && /^[а-яёa-z]/i.test(line)) {
    return `${buffer.slice(0, -1)}${line}`;
  }

  return `${buffer} ${line}`;
}

function splitTitleAndAuthor(rawTitle: string): { title: string; author: string } {
  const match = rawTitle.match(/^(.*)\s*\(([^()]{2,80})\)\s*$/);
  if (!match) {
    return { title: rawTitle.trim(), author: "-" };
  }

  const maybeAuthor = match[2].trim();
  if (PERSON_AUTHOR.test(maybeAuthor)) {
    return { title: match[1].trim(), author: maybeAuthor };
  }

  return { title: rawTitle.trim(), author: "-" };
}

function detectYear(lines: string[]): number {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(/(\d{4})\s*\/\s*№/) || line.match(/ИЮНЬ\s+(\d{4})/i) || line.match(/\b(20\d{2})\b/);
    if (match) {
      return Number(match[1]);
    }
  }

  return new Date().getFullYear();
}

function startsLikeContinuation(line: string): boolean {
  return /^[а-яё]/.test(line) || /^\d+\.\s/.test(line);
}

export function parsePublishedListText(text: string): PublishedListParseResult {
  const warnings: string[] = [];
  const entries: PublishedListEntry[] = [];
  const lines = text.split(/\r?\n/).map(normalizeLine);
  const year = detectYear(lines);

  let section = "";
  let buffer = "";

  const flush = (issueNumber: number, extraAuthor?: string) => {
    const rawTitle = buffer.trim();
    buffer = "";
    if (!rawTitle) {
      warnings.push(`Пустой заголовок у выпуска № ${issueNumber}.`);
      return;
    }

    const split = splitTitleAndAuthor(rawTitle);
    const author = extraAuthor || split.author;
    const warningParts: string[] = [];
    if (!section) {
      warningParts.push("нет рубрики");
    }
    if (author === "-") {
      warningParts.push("нет автора");
    }
    if (split.title.length < 12) {
      warningParts.push("короткое название");
    }

    entries.push({
      section: section || "-",
      title: split.title,
      author,
      issueNumber,
      warning: warningParts.length ? warningParts.join(", ") : undefined
    });
  };

  for (const line of lines) {
    if (isNoise(line)) {
      continue;
    }

    const nextSection = matchSection(line);
    if (nextSection) {
      if (buffer) {
        warnings.push(`Незакрытая статья перед рубрикой «${nextSection}»: ${buffer.slice(0, 80)}…`);
        buffer = "";
      }
      section = nextSection;
      continue;
    }

    const authorIssue = parseAuthorIssueLine(line);
    if (authorIssue) {
      if (buffer) {
        flush(authorIssue.issueNumber, authorIssue.author);
      } else if (entries.length) {
        const previous = entries[entries.length - 1];
        if (previous.author === "-" && previous.issueNumber === authorIssue.issueNumber) {
          previous.author = authorIssue.author;
        } else {
          warnings.push(`Строка только с автором отнесена к № ${authorIssue.issueNumber}: ${authorIssue.author}`);
          entries.push({
            section: section || "-",
            title: authorIssue.author,
            author: authorIssue.author,
            issueNumber: authorIssue.issueNumber,
            warning: "нет названия, только автор"
          });
        }
      }
      continue;
    }

    const trailing = extractTrailingIssue(line);
    if (trailing) {
      buffer = appendTitle(buffer, trailing.rest);
      flush(trailing.issueNumber);
      continue;
    }

    const issueLine = parseIssueLine(line);
    if (issueLine) {
      if (buffer) {
        flush(issueLine.issueNumber);
      } else {
        warnings.push(`Номер выпуска без названия: № ${issueLine.issueNumber}.`);
      }
      continue;
    }

    if (entries.length && !buffer && startsLikeContinuation(line)) {
      const previous = entries.pop();
      if (previous) {
        buffer = appendTitle(previous.title, line);
        if (previous.author !== "-") {
          buffer = `${buffer} (${previous.author})`;
        }
        section = previous.section;
      }
      continue;
    }

    buffer = appendTitle(buffer, line);
  }

  if (buffer) {
    warnings.push(`Незакрытая статья в конце файла: ${buffer.slice(0, 80)}…`);
  }

  return { year, entries, warnings };
}

export async function parsePublishedListPdf(filePath: string): Promise<PublishedListParseResult> {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(data) });
  const result = await parser.getText();
  await parser.destroy();
  return parsePublishedListText(result.text ?? "");
}
