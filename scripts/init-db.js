const { mkdirSync } = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const dbPath = process.env.RAQET_DB_PATH || path.join(process.cwd(), 'data', 'raqet.sqlite')

mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)

db.exec(`
  create table if not exists records (
    type text not null,
    id text not null,
    data text not null,
    created_at text not null,
    updated_at text not null,
    primary key (type, id)
  );
`)

db.close()
console.log(`Initialized Raqet SQLite database at ${dbPath}`)
