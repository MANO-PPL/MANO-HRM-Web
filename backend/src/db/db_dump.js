/**
 * ========================================================
 * 🗄️ DATABASE DUMP SCRIPT
 * ========================================================
 * Reads credentials from backend/.env automatically.
 * Saves output .sql dump in the SAME folder as this script.
 * 
 * QUICK COMMANDS:
 * 
 * 1) Schema Only (Structure without data - Default):
 *    node backend/src/db/db_dump.js
 * 
 * 2) Full Dump (Schema + Data):
 *    node backend/src/db/db_dump.js --data
 * ========================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Helper to resolve modules across potential parent directories
function loadModule(moduleName) {
    try {
        return require(moduleName);
    } catch (e) {
        const candidates = [
            path.join(__dirname, 'node_modules', moduleName),
            path.join(__dirname, '../node_modules', moduleName),
            path.join(__dirname, '../../node_modules', moduleName),
            path.join(__dirname, '../../../node_modules', moduleName),
            path.join(process.cwd(), 'node_modules', moduleName),
            path.join(process.cwd(), 'backend/node_modules', moduleName),
        ];
        for (const candidate of candidates) {
            try {
                return require(candidate);
            } catch (err) { }
        }
        throw new Error(`Cannot find module '${moduleName}'. Ensure dependencies are installed.`);
    }
}

// Locate and load .env file
const candidateEnvPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '.env'),
    path.join(process.cwd(), 'backend/.env'),
    path.join(process.cwd(), '.env'),
];

let dotenvPath = candidateEnvPaths.find(p => fs.existsSync(p));
const dotenv = loadModule('dotenv');

if (dotenvPath) {
    dotenv.config({ path: dotenvPath });
} else {
    dotenv.config();
}

const mysql = loadModule('mysql2/promise');

const DB_HOST = (process.env.DB_HOST || '127.0.0.1').replace(/^["']|["']$/g, '');
const DB_USER = (process.env.DB_ADMIN_USER || process.env.ATTENDANCE_DB_USER || process.env.DB_USER || 'admin').replace(/^["']|["']$/g, '');
const DB_PASSWORD = (process.env.DB_ADMIN_PASSWORD || process.env.ATTENDANCE_DB_PASSWORD || process.env.DB_PASSWORD || '').replace(/^["']|["']$/g, '');
const DB_NAME = (process.env.DB_ADMIN_NAME || process.env.ATTENDANCE_DB_NAME || process.env.DB_NAME || 'Attendance_DB').replace(/^["']|["']$/g, '');
const DB_PORT = (process.env.DB_PORT || '3307').replace(/^["']|["']$/g, '');

/**
 * Parse CLI Arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    let includeData = false; // Default: Schema-only
    let customFile = null;

    for (const arg of args) {
        if (['--data', '-d', 'data', '--with-data', 'full'].includes(arg.toLowerCase())) {
            includeData = true;
        } else if (['--schema', '-s', 'schema', '--schema-only', '--no-data'].includes(arg.toLowerCase())) {
            includeData = false;
        } else if (!arg.startsWith('-')) {
            customFile = arg;
        }
    }

    return { includeData, customFile };
}

/**
 * Generate database SQL dump (Schema-only or Full with Data)
 */
export async function generateSqlDump() {
    const { includeData, customFile } = parseArgs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpTypeTag = includeData ? 'full_dump' : 'schema';
    const defaultFilename = `${DB_NAME}_${dumpTypeTag}_${timestamp}.sql`;

    // Save .sql file in the same directory as this JS file (__dirname)
    const outputFile = customFile
        ? path.resolve(customFile)
        : path.join(__dirname, defaultFilename);

    console.log(`=========================================`);
    console.log(`🚀 Database SQL Dump Utility`);
    console.log(`=========================================`);
    console.log(`📍 Config loaded from: ${dotenvPath || 'process.env'}`);
    console.log(`🌐 Host: ${DB_HOST}:${DB_PORT}`);
    console.log(`👤 User: ${DB_USER}`);
    console.log(`🗄️ Database: ${DB_NAME}`);
    console.log(`📌 Dump Mode: ${includeData ? 'SCHEMA + DATA (Full Dump)' : 'SCHEMA ONLY (Structure)'}`);
    console.log(`📄 Target File: ${outputFile}`);
    console.log(`=========================================\n`);

    // Strategy 1: Attempt native mysqldump CLI execution
    try {
        console.log(`🔄 Attempting mysqldump CLI execution...`);
        const noDataFlag = includeData ? '' : '--no-data';
        const dumpCmd = `mysqldump ${noDataFlag} --host="${DB_HOST}" --port=${DB_PORT} --user="${DB_USER}" --password="${DB_PASSWORD}" "${DB_NAME}"`;
        const stdout = execSync(dumpCmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 6000, maxBuffer: 1024 * 1024 * 100 });

        if (stdout && stdout.length > 100) {
            fs.writeFileSync(outputFile, stdout);
            console.log(`✅ SQL Dump (${includeData ? 'Full' : 'Schema-only'}) successfully created!`);
            console.log(`📦 Saved to: ${outputFile}\n`);
            return;
        }
    } catch (cliErr) {
        console.log(`⚠️ mysqldump CLI skipped or timed out. Falling back to Node.js pure JS mysql2 dumper...\n`);
    }

    // Strategy 2: Node.js pure JS dump fallback using mysql2
    let connection;
    try {
        connection = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT),
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            multipleStatements: true,
            dateStrings: true
        });

        console.log(`✅ Connected to database '${DB_NAME}' successfully.`);

        const stream = fs.createWriteStream(outputFile, { flags: 'w' });

        stream.write(`-- ========================================================\n`);
        stream.write(`-- MANO-ATTENDANCE Database Dump (${includeData ? 'Schema + Data' : 'Schema Only'})\n`);
        stream.write(`-- Host: ${DB_HOST}:${DB_PORT}  Database: ${DB_NAME}\n`);
        stream.write(`-- Exported At: ${new Date().toISOString()}\n`);
        stream.write(`-- ========================================================\n\n`);
        stream.write(`SET FOREIGN_KEY_CHECKS=0;\n`);
        stream.write(`SET NAMES utf8mb4;\n\n`);

        const [tables] = await connection.query(`SHOW TABLES`);
        if (!tables || tables.length === 0) {
            console.log(`⚠️ No tables found in database '${DB_NAME}'.`);
            stream.end();
            return;
        }

        const tableKey = Object.keys(tables[0])[0];
        const tableList = tables.map(row => row[tableKey]);

        console.log(`📋 Found ${tableList.length} tables in database '${DB_NAME}'. Generating ${includeData ? 'structure & data' : 'structure only'}...`);

        for (const tableName of tableList) {
            console.log(`  └─ Dumping table structure: ${tableName}`);

            stream.write(`--\n-- Table structure for table \`${tableName}\`\n--\n`);
            stream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);

            const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createTableSql = createTableResult[0]['Create Table'];
            stream.write(`${createTableSql};\n\n`);

            // If data is requested, fetch and dump table rows
            if (includeData) {
                const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
                if (rows.length > 0) {
                    stream.write(`--\n-- Dumping data for table \`${tableName}\`\n--\n`);
                    stream.write(`LOCK TABLES \`${tableName}\` WRITE;\n`);

                    const columns = Object.keys(rows[0]).map(col => `\`${col}\``).join(', ');

                    const chunkSize = 100;
                    for (let i = 0; i < rows.length; i += chunkSize) {
                        const chunk = rows.slice(i, i + chunkSize);
                        const valuesArr = chunk.map(row => {
                            const values = Object.values(row).map(val => {
                                if (val === null || val === undefined) return 'NULL';
                                if (typeof val === 'number') return val;
                                if (typeof val === 'boolean') return val ? 1 : 0;
                                if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
                                if (typeof val === 'object') return mysql.escape(JSON.stringify(val));
                                return mysql.escape(String(val));
                            });
                            return `(${values.join(', ')})`;
                        });
                        stream.write(`INSERT INTO \`${tableName}\` (${columns}) VALUES\n${valuesArr.join(',\n')};\n`);
                    }
                    stream.write(`UNLOCK TABLES;\n\n`);
                }
            }
        }

        stream.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
        stream.write(`-- Dump finished at ${new Date().toISOString()}\n`);
        stream.end();

        console.log(`\n🎉 SQL Dump (${includeData ? 'Schema + Data' : 'Schema Only'}) successfully generated!`);
        console.log(`📦 Saved to: ${outputFile}\n`);
    } catch (err) {
        console.error(`❌ Dump creation failed:`, err.message);
    } finally {
        if (connection) await connection.end();
    }
}

generateSqlDump();
