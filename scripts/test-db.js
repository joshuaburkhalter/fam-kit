import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  console.log('Testing sql.js init...');
  try {
    const wasmPath = path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
    console.log('WASM path exists:', wasmPath);
    const SQL = await initSqlJs({
      locateFile: file => path.resolve(__dirname, '../node_modules/sql.js/dist', file)
    });
    const db = new SQL.Database();
    db.run("CREATE TABLE test (id int, name text);");
    db.run("INSERT INTO test VALUES (1, 'FamKit');");
    const res = db.exec("SELECT * FROM test");
    console.log('Result:', JSON.stringify(res));
  } catch (e) {
    console.error('Test error:', e);
  }
}

test();
