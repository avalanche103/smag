import { createDailyBackup } from "../utils/contentBackup";

const backupDir = createDailyBackup();
console.log(`Backup created at ${backupDir}`);
