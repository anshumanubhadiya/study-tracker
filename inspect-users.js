const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
  await client.connect();
  const res = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
