const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function backupDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB for pre-reset backup...');
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const dbName = mongoose.connection.name;
  console.log(`Connected to database: ${dbName}`);

  if (dbName !== 'hospital_management') {
    throw new Error(`Target database is '${dbName}', expected 'hospital_management'. Aborting backup.`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, `../backups/backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const collections = ['admins', 'departments', 'doctors', 'patients', 'appointments'];
  const summary = {};

  for (const colName of collections) {
    const docs = await db.collection(colName).find({}).toArray();
    const filePath = path.join(backupDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
    summary[colName] = docs.length;
    console.log(`[Backup Saved]: ${colName} -> ${docs.length} records saved to ${filePath}`);
  }

  const metaPath = path.join(backupDir, 'metadata.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        database: dbName,
        uri: uri.replace(/\/\/.*@/, '//***@'),
        createdAt: new Date().toISOString(),
        recordCounts: summary
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\nDatabase backup successfully completed in: ${backupDir}`);
  console.log('Backup Summary:', JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
  return { backupDir, summary };
}

if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backup failed:', err.message);
      process.exit(1);
    });
}

module.exports = backupDatabase;
