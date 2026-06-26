#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import knex from 'knex';
import '../../../src/config/config.js';
import { attendanceDB } from '../../../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+$/;
const ACTION_WHITELIST = ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'];

// Helper to validate SQL identifiers to prevent SQL injection
function validateIdentifier(name) {
  if (typeof name !== 'string' || !IDENTIFIER_REGEX.test(name)) {
    throw new Error(`Security Violations: Invalid SQL identifier "${name}". Identifiers must only contain alphanumeric characters and underscores.`);
  }
}

// Helper to validate referential actions
function validateAction(action) {
  if (action && !ACTION_WHITELIST.includes(action.toUpperCase())) {
    throw new Error(`Security Violations: Unsupported referential action "${action}".`);
  }
}

// Simple CSV parser (expects new,old format)
function parseCSV(content) {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const pairs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length >= 2) {
      if (i === 0 && parts[0].toLowerCase() === 'new' && parts[1].toLowerCase() === 'old') {
        continue; // skip header
      }
      pairs.push({ old: parts[1], new: parts[0] });
    }
  }
  return pairs;
}

// Generate new name by replacing the old table name segment
function renameIdentifier(oldName, oldTable, newTable) {
  if (oldName.includes(oldTable)) {
    const newName = oldName.split(oldTable).join(newTable);
    return { newName, manualReview: false };
  }
  return { newName: null, manualReview: true, reason: `Does not contain substring "${oldTable}"` };
}

async function main() {
  const args = process.argv.slice(2);
  const parsedArgs = {
    old: null,
    new: null,
    batch: null,
    noView: false,
    dryRun: true, // Safety Default
    dbConfig: null,
    cleanupViews: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--old=')) {
      parsedArgs.old = arg.substring(6);
    } else if (arg.startsWith('--new=')) {
      parsedArgs.new = arg.substring(6);
    } else if (arg.startsWith('--batch=')) {
      parsedArgs.batch = arg.substring(8);
    } else if (arg === '--no-view') {
      parsedArgs.noView = true;
    } else if (arg === '--dry-run') {
      parsedArgs.dryRun = true;
    } else if (arg === '--execute') {
      parsedArgs.dryRun = false;
    } else if (arg.startsWith('--db-config=')) {
      parsedArgs.dbConfig = arg.substring(12);
    } else if (arg === '--cleanup-views') {
      parsedArgs.cleanupViews = true;
    }
  }

  // Parse batch or single pair
  let batch = [];
  let sector = 'batch';

  if (parsedArgs.batch) {
    if (parsedArgs.old || parsedArgs.new) {
      console.error('❌ Error: Cannot combine --batch with --old or --new options.');
      process.exit(1);
    }
    const batchPath = path.resolve(process.cwd(), parsedArgs.batch);
    if (!fs.existsSync(batchPath)) {
      console.error(`❌ Error: Batch file not found at "${batchPath}".`);
      process.exit(1);
    }
    const content = fs.readFileSync(batchPath, 'utf8');
    const ext = path.extname(batchPath).toLowerCase();
    sector = path.basename(batchPath, ext);

    try {
      if (ext === '.json') {
        batch = JSON.parse(content);
      } else if (ext === '.csv') {
        batch = parseCSV(content);
      } else {
        console.error('❌ Error: Batch file must be either .json or .csv.');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Error parsing batch file:', e.message);
      process.exit(1);
    }
  } else if (parsedArgs.old && parsedArgs.new) {
    batch = [{ old: parsedArgs.old, new: parsedArgs.new }];
    sector = parsedArgs.old;
  } else {
    console.error('❌ Error: You must specify either --old and --new, or a --batch file.');
    console.error('Usage Examples:');
    console.error('  node rename-table.js --old=application_error_logs --new=sys_error_logs');
    console.error('  node rename-table.js --batch=mappings.json --execute');
    console.error('  node rename-table.js --batch=mappings.json --cleanup-views');
    process.exit(1);
  }

  // Validate identifiers in mapping
  for (const pair of batch) {
    try {
      validateIdentifier(pair.old);
      validateIdentifier(pair.new);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  }

  // Resolve Database Connection
  let db;
  try {
    if (parsedArgs.dbConfig) {
      let dbConfigPath = path.resolve(process.cwd(), parsedArgs.dbConfig);
      const fileUrl = pathToFileURL(dbConfigPath).href;
      const imported = await import(fileUrl);
      const exported = imported.default || imported;
      if (typeof exported === 'function' || (exported && typeof exported.raw === 'function')) {
        db = exported;
      } else {
        db = knex(exported);
      }
    } else if (process.env.DB_ADMIN_USER && process.env.DB_ADMIN_PASSWORD) {
      db = knex({
        client: 'mysql2',
        connection: {
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT) || 3306,
          user: process.env.DB_ADMIN_USER,
          password: process.env.DB_ADMIN_PASSWORD,
          database: process.env.DB_ADMIN_NAME || 'Attendance_DB',
          timezone: 'Z',
        }
      });
    } else {
      db = attendanceDB;
    }
  } catch (err) {
    console.error('❌ Error establishing database connection:', err.message);
    process.exit(1);
  }

  try {
    // ----------------------------------------------------
    // FLOW A: CLEANUP VIEWS ONLY
    // ----------------------------------------------------
    if (parsedArgs.cleanupViews) {
      console.log(`🧹 Running compatibility view cleanup for sector: ${sector}`);
      if (parsedArgs.dryRun) {
        console.log('--- DRY RUN: No view dropping will be executed ---');
      }
      for (const pair of batch) {
        const oldName = pair.old;
        const newName = pair.new;
        console.log(`Checking view "${oldName}"...`);
        const tableCheck = await db('information_schema.TABLES')
          .select('TABLE_TYPE')
          .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldName })
          .first();

        if (tableCheck && tableCheck.TABLE_TYPE === 'VIEW') {
          const dropViewSql = db.raw('DROP VIEW ??', [oldName]).toString();
          console.log(`[SQL] ${dropViewSql}`);
          if (!parsedArgs.dryRun) {
            await db.raw('DROP VIEW ??', [oldName]);
            console.log(`✅ View "${oldName}" dropped successfully.`);
          }
        } else {
          console.log(`ℹ️ Object "${oldName}" is not a VIEW (or does not exist). Skipping.`);
        }
      }
      console.log('🎉 Cleanup views process completed!');
      await db.destroy();
      process.exit(0);
    }

    // ----------------------------------------------------
    // FLOW B: MIGRATION & RENAME
    // ----------------------------------------------------
    console.log(`🏁 Starting table rename process for sector: ${sector}`);
    console.log(`Dry-run mode: ${parsedArgs.dryRun ? 'ON (Default)' : 'OFF'}`);

    // 1. PRE-FLIGHT VALIDATION FOR BATCH
    console.log('🔄 Running pre-flight validations...');
    const plans = [];

    for (const pair of batch) {
      const oldTable = pair.old;
      const newTable = pair.new;

      // Check if old_name exists and is BASE TABLE
      const oldCheck = await db('information_schema.TABLES')
        .select('TABLE_TYPE')
        .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldTable })
        .first();

      if (!oldCheck) {
        console.error(`❌ Validation Failure: Source table "${oldTable}" does not exist.`);
        process.exit(1);
      }
      if (oldCheck.TABLE_TYPE !== 'BASE TABLE') {
        console.error(`❌ Validation Failure: Source table "${oldTable}" is not a BASE TABLE (it is a ${oldCheck.TABLE_TYPE}).`);
        process.exit(1);
      }

      // Check if new_name already exists
      const newCheck = await db('information_schema.TABLES')
        .select('TABLE_TYPE')
        .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable })
        .first();

      if (newCheck) {
        console.error(`❌ Validation Failure: Target name "${newTable}" already exists as a ${newCheck.TABLE_TYPE}.`);
        process.exit(1);
      }

      // Get row count
      const countRes = await db(oldTable).count('* as count').first();
      const rowCount = Number(countRes?.count) || 0;

      plans.push({
        table: { old: oldTable, new: newTable, rowCount },
        discoveredIndexes: [],
        discoveredFks: {},
        indexesToRename: [],
        fksToRename: [],
        fksReferencingThisTable: [],
        manualReviewItems: []
      });
    }
    console.log('✅ Pre-flight checks passed successfully.');

    // 2. DISCOVER DEPENDENCIES & BUILD PLAN
    console.log('🔍 Discovering dependencies...');
    for (const plan of plans) {
      const oldTable = plan.table.old;
      const newTable = plan.table.new;

      // Discovery: FKs on this table (child)
      const fkRows = await db('information_schema.KEY_COLUMN_USAGE as k')
        .join('information_schema.REFERENTIAL_CONSTRAINTS as r', function() {
          this.on('k.CONSTRAINT_NAME', '=', 'r.CONSTRAINT_NAME')
              .andOn('k.CONSTRAINT_SCHEMA', '=', 'r.CONSTRAINT_SCHEMA');
        })
        .select(
          'k.CONSTRAINT_NAME as fk_name',
          'k.COLUMN_NAME as column_name',
          'k.REFERENCED_TABLE_NAME as ref_table_name',
          'k.REFERENCED_COLUMN_NAME as ref_column_name',
          'r.UPDATE_RULE as on_update',
          'r.DELETE_RULE as on_delete'
        )
        .where({ 'k.TABLE_SCHEMA': db.raw('DATABASE()'), 'k.TABLE_NAME': oldTable })
        .whereNotNull('k.REFERENCED_TABLE_NAME')
        .orderBy(['k.CONSTRAINT_NAME', 'k.ORDINAL_POSITION']);

      for (const row of fkRows) {
        validateIdentifier(row.fk_name);
        validateIdentifier(row.column_name);
        validateIdentifier(row.ref_table_name);
        validateIdentifier(row.ref_column_name);
        validateAction(row.on_update);
        validateAction(row.on_delete);

        if (!plan.discoveredFks[row.fk_name]) {
          plan.discoveredFks[row.fk_name] = {
            old: row.fk_name,
            columns: [],
            refTable: row.ref_table_name,
            refColumns: [],
            onUpdate: row.on_update,
            onDelete: row.on_delete
          };
        }
        plan.discoveredFks[row.fk_name].columns.push(row.column_name);
        plan.discoveredFks[row.fk_name].refColumns.push(row.ref_column_name);
      }

      // Discovery: Indexes on this table (excluding PRIMARY)
      const indexRows = await db('information_schema.STATISTICS')
        .select('INDEX_NAME')
        .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldTable })
        .whereNot({ INDEX_NAME: 'PRIMARY' })
        .orderBy(['INDEX_NAME', 'SEQ_IN_INDEX']);

      plan.discoveredIndexes = [...new Set(indexRows.map(r => r.INDEX_NAME))];
      for (const idx of plan.discoveredIndexes) {
        validateIdentifier(idx);
      }

      // Discovery: FKs referencing this table (parent)
      const parentFkRows = await db('information_schema.KEY_COLUMN_USAGE as k')
        .join('information_schema.REFERENTIAL_CONSTRAINTS as r', function() {
          this.on('k.CONSTRAINT_NAME', '=', 'r.CONSTRAINT_NAME')
              .andOn('k.CONSTRAINT_SCHEMA', '=', 'r.CONSTRAINT_SCHEMA');
        })
        .select(
          'k.TABLE_NAME as child_table',
          'k.CONSTRAINT_NAME as fk_name',
          'k.COLUMN_NAME as column_name',
          'k.REFERENCED_COLUMN_NAME as ref_column_name',
          'r.UPDATE_RULE as on_update',
          'r.DELETE_RULE as on_delete'
        )
        .where({ 'k.REFERENCED_TABLE_SCHEMA': db.raw('DATABASE()'), 'k.REFERENCED_TABLE_NAME': oldTable })
        .orderBy(['k.TABLE_NAME', 'k.CONSTRAINT_NAME', 'k.ORDINAL_POSITION']);

      const groupedParentFks = {};
      for (const row of parentFkRows) {
        validateIdentifier(row.child_table);
        validateIdentifier(row.fk_name);
        validateIdentifier(row.column_name);
        validateIdentifier(row.ref_column_name);
        validateAction(row.on_update);
        validateAction(row.on_delete);

        const key = `${row.child_table}:${row.fk_name}`;
        if (!groupedParentFks[key]) {
          groupedParentFks[key] = {
            childTable: row.child_table,
            fkName: row.fk_name,
            columns: [],
            refColumns: [],
            onUpdate: row.on_update,
            onDelete: row.on_delete
          };
        }
        groupedParentFks[key].columns.push(row.column_name);
        groupedParentFks[key].refColumns.push(row.ref_column_name);
      }
      plan.fksReferencingThisTable = Object.values(groupedParentFks);

      // 3. APPLY NAMING CONVENTIONS TO PLAN
      // Process indexes
      for (const indexName of plan.discoveredIndexes) {
        const res = renameIdentifier(indexName, oldTable, newTable);
        if (res.manualReview) {
          plan.manualReviewItems.push({ type: 'index', name: indexName, reason: res.reason });
        } else {
          plan.indexesToRename.push({ old: indexName, new: res.newName });
        }
      }

      // Process FKs
      for (const fkName of Object.keys(plan.discoveredFks)) {
        const fk = plan.discoveredFks[fkName];
        const res = renameIdentifier(fkName, oldTable, newTable);
        if (res.manualReview) {
          plan.manualReviewItems.push({ type: 'fk', name: fkName, reason: res.reason });
        } else {
          plan.fksToRename.push({
            old: fkName,
            new: res.newName,
            columns: fk.columns,
            refTable: fk.refTable,
            refColumns: fk.refColumns,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate
          });
        }
      }
    }

    // 4. GENERATE ROLLBACKS & SQL STATEMENTS
    const runSqlStatements = [];
    const rollbackSqlStatements = [];
    const reports = [];

    for (const plan of plans) {
      const oldTable = plan.table.old;
      const newTable = plan.table.new;

      const tableReport = {
        table: `${oldTable} ➔ ${newTable}`,
        status: 'PENDING',
        renamed: 'no',
        viewCreated: 'no',
        fksRenamed: [],
        indexesRenamed: [],
        manualReview: plan.manualReviewItems,
        parentFksUpdated: []
      };

      // Table Rename DDL
      const renameSql = db.raw('RENAME TABLE ?? TO ??', [oldTable, newTable]).toString();
      runSqlStatements.push(renameSql);

      // Compatibility View DDL
      let viewSql = '';
      if (!parsedArgs.noView) {
        viewSql = db.raw('CREATE VIEW ?? AS SELECT * FROM ??', [oldTable, newTable]).toString();
        runSqlStatements.push(viewSql);
      }

      // FK Drops/Adds DDL
      for (const fk of plan.fksToRename) {
        const fkSql = db.raw(
          `ALTER TABLE ?? DROP FOREIGN KEY ??, ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
          [newTable, fk.old, fk.new, fk.columns, fk.refTable, fk.refColumns]
        ).toString();
        runSqlStatements.push(fkSql);
      }

      // Index Rename DDL
      for (const idx of plan.indexesToRename) {
        const idxSql = db.raw('ALTER TABLE ?? RENAME INDEX ?? TO ??', [newTable, idx.old, idx.new]).toString();
        runSqlStatements.push(idxSql);
      }

      // Generate Rollback SQL
      const rollbackSql = generateRollbackSql(plan, parsedArgs.noView);
      rollbackSqlStatements.push(rollbackSql);
      reports.push(tableReport);
    }

    // Print planned DDL
    console.log('\n--- PLANNED DDL STATEMENTS ---');
    runSqlStatements.forEach(stmt => console.log(`${stmt};`));
    console.log('------------------------------\n');

    // 5. EXECUTION PHASE (Idempotent per table)
    let executionFailed = false;
    let failedTable = '';
    let failedStep = '';

    if (!parsedArgs.dryRun) {
      console.log('🚀 Executing DDL statements against the database...');
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        const oldTable = plan.table.old;
        const newTable = plan.table.new;
        const report = reports[i];

        console.log(`\nProcessing table "${oldTable}" ➔ "${newTable}"...`);

        try {
          // A. Rename Table
          failedStep = 'Rename Table';
          let tableRenamed = false;
          const targetExists = await db('information_schema.TABLES')
            .select('TABLE_TYPE')
            .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable })
            .first();

          if (targetExists && targetExists.TABLE_TYPE === 'BASE TABLE') {
            const oldStillExists = await db('information_schema.TABLES')
              .select('TABLE_TYPE')
              .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldTable })
              .first();

            if (!oldStillExists || oldStillExists.TABLE_TYPE === 'VIEW') {
              console.log(`ℹ️ Table "${newTable}" already exists and "${oldTable}" is gone/view. Skipping rename.`);
              tableRenamed = true;
            } else {
              throw new Error(`State Conflict: Both tables "${oldTable}" and "${newTable}" exist.`);
            }
          } else {
            const renameSql = db.raw('RENAME TABLE ?? TO ??', [oldTable, newTable]).toString();
            console.log(`[SQL] ${renameSql}`);
            await db.raw('RENAME TABLE ?? TO ??', [oldTable, newTable]);
            tableRenamed = true;
          }
          report.renamed = tableRenamed ? 'yes' : 'no';

          // B. Create View
          failedStep = 'Create View';
          if (!parsedArgs.noView) {
            const oldCheck = await db('information_schema.TABLES')
              .select('TABLE_TYPE')
              .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldTable })
              .first();

            if (oldCheck && oldCheck.TABLE_TYPE === 'VIEW') {
              console.log(`ℹ️ Compatibility view "${oldTable}" already exists. Skipping.`);
              report.viewCreated = 'yes';
            } else if (oldCheck) {
              throw new Error(`State Conflict: Object "${oldTable}" exists but is not a VIEW.`);
            } else {
              const viewSql = db.raw('CREATE VIEW ?? AS SELECT * FROM ??', [oldTable, newTable]).toString();
              console.log(`[SQL] ${viewSql}`);
              await db.raw('CREATE VIEW ?? AS SELECT * FROM ??', [oldTable, newTable]);
              report.viewCreated = 'yes';
            }
          }

          // C. Recreate FKs
          failedStep = 'Drop/Recreate FKs';
          for (const fk of plan.fksToRename) {
            const newFkCheck = await db('information_schema.TABLE_CONSTRAINTS')
              .select('CONSTRAINT_NAME')
              .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable, CONSTRAINT_NAME: fk.new, CONSTRAINT_TYPE: 'FOREIGN KEY' })
              .first();

            if (newFkCheck) {
              console.log(`ℹ️ Foreign Key "${fk.new}" already exists. Skipping.`);
              report.fksRenamed.push(`${fk.old} ➔ ${fk.new} (Skipped, already existed)`);
            } else {
              const oldFkCheck = await db('information_schema.TABLE_CONSTRAINTS')
                .select('CONSTRAINT_NAME')
                .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable, CONSTRAINT_NAME: fk.old, CONSTRAINT_TYPE: 'FOREIGN KEY' })
                .first();

              if (oldFkCheck) {
                const alterSql = db.raw(
                  `ALTER TABLE ?? DROP FOREIGN KEY ??, ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
                  [newTable, fk.old, fk.new, fk.columns, fk.refTable, fk.refColumns]
                ).toString();
                console.log(`[SQL] ${alterSql}`);
                await db.raw(
                  `ALTER TABLE ?? DROP FOREIGN KEY ??, ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
                  [newTable, fk.old, fk.new, fk.columns, fk.refTable, fk.refColumns]
                );
                report.fksRenamed.push(`${fk.old} ➔ ${fk.new} (Recreated)`);
              } else {
                const addSql = db.raw(
                  `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
                  [newTable, fk.new, fk.columns, fk.refTable, fk.refColumns]
                ).toString();
                console.log(`[SQL] ${addSql}`);
                await db.raw(
                  `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
                  [newTable, fk.new, fk.columns, fk.refTable, fk.refColumns]
                );
                report.fksRenamed.push(`${fk.old} ➔ ${fk.new} (Added directly)`);
              }
            }
          }

          // D. Rename Indexes
          failedStep = 'Rename Indexes';
          const indexRows = await db('information_schema.STATISTICS')
            .select('INDEX_NAME')
            .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable });
          const currentIndexes = new Set(indexRows.map(r => r.INDEX_NAME));

          for (const idx of plan.indexesToRename) {
            if (currentIndexes.has(idx.new)) {
              console.log(`ℹ️ Index "${idx.new}" already exists. Skipping.`);
              report.indexesRenamed.push(`${idx.old} ➔ ${idx.new} (Skipped, already existed)`);
            } else if (currentIndexes.has(idx.old)) {
              const renameIdxSql = db.raw('ALTER TABLE ?? RENAME INDEX ?? TO ??', [newTable, idx.old, idx.new]).toString();
              console.log(`[SQL] ${renameIdxSql}`);
              await db.raw('ALTER TABLE ?? RENAME INDEX ?? TO ??', [newTable, idx.old, idx.new]);
              report.indexesRenamed.push(`${idx.old} ➔ ${idx.new} (Renamed)`);
            } else {
              console.log(`⚠️ Index "${idx.old}" not found. Skipping rename.`);
              report.indexesRenamed.push(`${idx.old} ➔ ${idx.new} (Skipped, source index not found)`);
            }
          }

          // 6. VERIFICATION
          failedStep = 'Verification';
          console.log('🔍 Verifying changes...');
          const verification = await verifyTableRename(db, plan, parsedArgs.noView);
          if (!verification.success) {
            throw new Error(`Verification Failed: ${verification.reason}`);
          }
          console.log(`✅ Verification passed for "${oldTable}" ➔ "${newTable}".`);

          // Confirm parent FKs updated
          for (const parentFk of plan.fksReferencingThisTable) {
            const curParentFk = await db('information_schema.KEY_COLUMN_USAGE')
              .select('REFERENCED_TABLE_NAME')
              .where({
                TABLE_SCHEMA: db.raw('DATABASE()'),
                CONSTRAINT_NAME: parentFk.fkName,
                TABLE_NAME: parentFk.childTable
              })
              .first();

            const isUpdated = curParentFk?.REFERENCED_TABLE_NAME === newTable;
            report.parentFksUpdated.push(`${parentFk.childTable}.${parentFk.fkName}: ${isUpdated ? 'AUTO-UPDATED' : 'NOT UPDATED'}`);
          }

          report.status = 'SUCCESS';
        } catch (err) {
          console.error(`❌ Error at step "${failedStep}" during table processing:`, err.message);
          report.status = 'FAILED';
          executionFailed = true;
          failedTable = oldTable;
          break; // Stop batch run immediately
        }
      }
    }

    // ----------------------------------------------------
    // WRITE OUTPUT FILES
    // ----------------------------------------------------
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const genDir = path.resolve(__dirname, '../../../migrations/generated');
    if (!fs.existsSync(genDir)) {
      fs.mkdirSync(genDir, { recursive: true });
    }

    const runSqlFile = path.join(genDir, `${timestamp}_rename_${sector}.sql`);
    const rollbackSqlFile = path.join(genDir, `${timestamp}_rename_${sector}_rollback.sql`);
    const reportLogFile = path.join(genDir, `${timestamp}_rename_${sector}_report.log`);

    // Write SQL and Rollback
    fs.writeFileSync(runSqlFile, runSqlStatements.map(s => `${s};`).join('\n') + '\n', 'utf8');
    fs.writeFileSync(rollbackSqlFile, rollbackSqlStatements.join('\n'), 'utf8');

    // Build log content
    let logContent = `Table Rename Execution Report\n`;
    logContent += `===============================\n`;
    logContent += `Timestamp: ${now.toISOString()}\n`;
    logContent += `Sector: ${sector}\n`;
    logContent += `Dry-run: ${parsedArgs.dryRun ? 'YES' : 'NO'}\n`;
    logContent += `Execution Success: ${executionFailed ? 'NO' : parsedArgs.dryRun ? 'DRY-RUN' : 'YES'}\n`;
    if (executionFailed) {
      logContent += `Failure Location: Table "${failedTable}", Step "${failedStep}"\n`;
    }
    logContent += `===============================\n\n`;

    for (const report of reports) {
      logContent += `Table Pair: ${report.table}\n`;
      logContent += `-------------------------------\n`;
      logContent += `Status: ${report.status}\n`;
      logContent += `Table Renamed: ${report.renamed}\n`;
      logContent += `Compatibility View Created: ${report.viewCreated}\n`;
      logContent += `FKs Recreated:\n`;
      report.fksRenamed.forEach(fk => logContent += `  - ${fk}\n`);
      logContent += `Indexes Renamed:\n`;
      report.indexesRenamed.forEach(idx => logContent += `  - ${idx}\n`);
      if (report.manualReview.length > 0) {
        logContent += `⚠️ Items Flagged for Manual Review:\n`;
        report.manualReview.forEach(item => logContent += `  - [${item.type}] ${item.name} (${item.reason})\n`);
      }
      if (report.parentFksUpdated.length > 0) {
        logContent += `ℹ️ Referencing Parent FKs:\n`;
        report.parentFksUpdated.forEach(fk => logContent += `  - ${fk}\n`);
      }
      logContent += `\n`;
    }

    fs.writeFileSync(reportLogFile, logContent, 'utf8');

    console.log('\n--- RUN REPORT SUMMARY ---');
    console.log(logContent);
    console.log(`\n📂 Outputs written successfully to:`);
    console.log(`  - Log Report:   ${runSqlFile}`);
    console.log(`  - Rollback SQL: ${rollbackSqlFile}`);
    console.log(`  - Output SQL:   ${reportLogFile}`);

    if (executionFailed) {
      console.error(`\n❌ Script halted due to execution failure on Table "${failedTable}" at Step "${failedStep}".`);
      await db.destroy();
      process.exit(1);
    }

    console.log('\n🎉 Execution finished successfully!');
    await db.destroy();
    process.exit(0);

  } catch (err) {
    console.error('❌ Critical script crash:', err);
    if (db) await db.destroy();
    process.exit(1);
  }
}

// Verification Checker
async function verifyTableRename(db, plan, noView) {
  const newTable = plan.table.new;
  const oldTable = plan.table.old;

  // 1. Check if newTable exists and is BASE TABLE
  const tableCheck = await db('information_schema.TABLES')
    .select('TABLE_TYPE')
    .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable })
    .first();

  if (!tableCheck || tableCheck.TABLE_TYPE !== 'BASE TABLE') {
    return { success: false, reason: `Target table "${newTable}" does not exist as a BASE TABLE.` };
  }

  // 2. Check if oldTable exists as VIEW (if view was created)
  if (!noView) {
    const viewCheck = await db('information_schema.TABLES')
      .select('TABLE_TYPE')
      .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: oldTable })
      .first();

    if (!viewCheck || viewCheck.TABLE_TYPE !== 'VIEW') {
      return { success: false, reason: `Compatibility view "${oldTable}" does not exist.` };
    }
  }

  // 3. Confirm all planned FK names exist
  const existingFks = await db('information_schema.TABLE_CONSTRAINTS')
    .select('CONSTRAINT_NAME')
    .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable, CONSTRAINT_TYPE: 'FOREIGN KEY' });
  const existingFkNames = new Set(existingFks.map(f => f.CONSTRAINT_NAME));

  for (const fk of plan.fksToRename) {
    if (!existingFkNames.has(fk.new)) {
      return { success: false, reason: `Foreign key "${fk.new}" was not found on table "${newTable}".` };
    }

    const rules = await db('information_schema.REFERENTIAL_CONSTRAINTS')
      .select('DELETE_RULE', 'UPDATE_RULE')
      .where({ CONSTRAINT_SCHEMA: db.raw('DATABASE()'), CONSTRAINT_NAME: fk.new })
      .first();

    if (!rules || rules.DELETE_RULE !== fk.onDelete || rules.UPDATE_RULE !== fk.onUpdate) {
      return {
        success: false,
        reason: `Foreign key "${fk.new}" rules mismatch. Expected ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}, got ON DELETE ${rules?.DELETE_RULE} ON UPDATE ${rules?.UPDATE_RULE}.`
      };
    }
  }

  // 4. Confirm all planned index names exist
  const existingIndexes = await db('information_schema.STATISTICS')
    .select('INDEX_NAME')
    .where({ TABLE_SCHEMA: db.raw('DATABASE()'), TABLE_NAME: newTable });
  const existingIndexNames = new Set(existingIndexes.map(i => i.INDEX_NAME));

  for (const idx of plan.indexesToRename) {
    if (!existingIndexNames.has(idx.new)) {
      return { success: false, reason: `Index "${idx.new}" was not found on table "${newTable}".` };
    }
  }

  // 5. Row count verification
  const countRes = await db(newTable).count('* as count').first();
  const newCount = Number(countRes?.count) || 0;
  if (plan.table.rowCount !== newCount) {
    return { success: false, reason: `Row count mismatch. Expected ${plan.table.rowCount}, got ${newCount}.` };
  }

  return { success: true };
}

// Generate rollback SQL text
function generateRollbackSql(plan, noView) {
  const sqlLines = [];
  const oldTable = plan.table.old;
  const newTable = plan.table.new;

  sqlLines.push(`-- Rollback SQL for table rename: ${oldTable} -> ${newTable}`);
  sqlLines.push(`-- Generated at: ${new Date().toISOString()}`);
  sqlLines.push(``);

  if (!noView) {
    sqlLines.push(`-- Drop compatibility view`);
    sqlLines.push(`DROP VIEW IF EXISTS \`${oldTable}\`;`);
    sqlLines.push(``);
  }

  if (plan.fksToRename.length > 0) {
    sqlLines.push(`-- Revert foreign key constraints`);
    for (const fk of plan.fksToRename) {
      const cols = fk.columns.map(c => `\`${c}\``).join(', ');
      const refCols = fk.refColumns.map(c => `\`${c}\``).join(', ');
      sqlLines.push(
        `ALTER TABLE \`${newTable}\` DROP FOREIGN KEY \`${fk.new}\`,\n  ADD CONSTRAINT \`${fk.old}\` FOREIGN KEY (${cols}) REFERENCES \`${fk.refTable}\` (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`
      );
    }
    sqlLines.push(``);
  }

  if (plan.indexesToRename.length > 0) {
    sqlLines.push(`-- Revert indexes`);
    for (const idx of plan.indexesToRename) {
      sqlLines.push(`ALTER TABLE \`${newTable}\` RENAME INDEX \`${idx.new}\` TO \`${idx.old}\`;`);
    }
    sqlLines.push(``);
  }

  sqlLines.push(`-- Revert table name`);
  sqlLines.push(`RENAME TABLE \`${newTable}\` TO \`${oldTable}\`;`);
  sqlLines.push(``);

  return sqlLines.join('\n');
}

main();
