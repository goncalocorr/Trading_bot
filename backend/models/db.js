const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const DEFAULT_DB_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 10;

let pool;

function getBaseConfig(includeDatabase = true) {
  const config = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || DEFAULT_DB_PORT),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT),
    queueLimit: 0,
    timezone: "Z",
    namedPlaceholders: true,
    decimalNumbers: true
  };

  if (includeDatabase) {
    config.database = process.env.DB_NAME || "tradingbot";
  }

  return config;
}

async function ensureDatabaseExists() {
  const adminConnection = await mysql.createConnection(getBaseConfig(false));

  try {
    const databaseName = process.env.DB_NAME || "tradingbot";
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await adminConnection.end();
  }
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getBaseConfig(true));
  }

  return pool;
}

async function testConnection() {
  const activePool = getPool();
  const connection = await activePool.getConnection();

  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

function loadSchemaStatements() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const rawSchema = fs.readFileSync(schemaPath, "utf8");

  return rawSchema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function initializeSchema() {
  const activePool = getPool();
  const statements = loadSchemaStatements();

  for (const statement of statements) {
    await activePool.query(statement);
  }
}

async function initDatabase() {
  await ensureDatabaseExists();
  await testConnection();
  await initializeSchema();
}

async function query(sql, params = {}) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function execute(sql, params = {}) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

async function withTransaction(handler) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

module.exports = {
  closePool,
  execute,
  getPool,
  initDatabase,
  query,
  testConnection,
  withTransaction
};
