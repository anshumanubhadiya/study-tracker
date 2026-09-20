const { Client } = require('pg');

const sqls = [
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;",
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS university text NOT NULL DEFAULT 'GTU';",
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS course text NOT NULL DEFAULT 'BCA';",
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';",
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS accent text NOT NULL DEFAULT 'lime';",
  "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;",
];

(async () => {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
  await client.connect();
  for (const q of sqls) await client.query(q);
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('is_guest','university','course','theme','accent','settings') ORDER BY column_name;");
  console.log(JSON.stringify(res.rows));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
