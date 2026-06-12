import { adminDB, attendanceDB } from './database.js';

export const initDatabase = async () => {
    try {
        const db = adminDB || attendanceDB;
        if (!db) {
            console.error('No database connection found for initialization.');
            return;
        }

        // 1. Initialize chat_rooms
        try {
            await db.schema.dropTableIfExists('chat_room_members');
            await db.schema.dropTableIfExists('chat_messages');
        } catch (dropErr) {
            // Ignore silently if permission lacks
        }

        const hasRooms = await db.schema.hasTable('chat_rooms');
        if (hasRooms) {
            const hasMessagesCol = await db.schema.hasColumn('chat_rooms', 'messages');
            if (!hasMessagesCol) {
                try {
                    await db.schema.dropTable('chat_rooms');
                    console.log('Old chat_rooms table dropped for single-row optimization.');
                } catch (dropErr) {
                    console.warn('⚠️ Unable to drop legacy chat_rooms table.');
                }
            }
        }

        const hasRoomsUpdated = await db.schema.hasTable('chat_rooms');
        if (!hasRoomsUpdated) {
            await db.schema.createTable('chat_rooms', (table) => {
                table.increments('room_id').primary();
                table.integer('org_id').unsigned().notNullable();
                table.string('room_name', 255).nullable();
                table.enum('room_type', ['direct', 'group']).defaultTo('direct');
                table.integer('created_by').unsigned().nullable();
                table.text('member_ids').notNullable();
                table.text('messages', 'longtext').notNullable();
                table.text('last_read_times').notNullable();
                table.text('removed_members').nullable();
                table.timestamps(true, true);

                table.index(['org_id']);
            });
            console.log('✅ Table "chat_rooms" initialized.');
        } else {
            const hasRemovedMembers = await db.schema.hasColumn('chat_rooms', 'removed_members');
            if (!hasRemovedMembers) {
                await db.schema.table('chat_rooms', (table) => {
                    table.text('removed_members').nullable();
                });
                console.log('Column "removed_members" added to "chat_rooms" successfully.');
            }
        }

        // 2. Initialize generated_reports
        const hasReports = await db.schema.hasTable('generated_reports');
        if (!hasReports) {
            console.log('Creating "generated_reports" table...');
            await db.schema.createTable('generated_reports', (table) => {
                table.string('report_id', 255).primary();
                table.integer('user_id').notNullable();
                table.integer('org_id').notNullable();
                table.string('report_type', 100).notNullable();
                table.string('format', 10).notNullable();
                table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
                table.text('file_url').nullable();
                table.string('error_message', 255).nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());
            });
            console.log('✅ "generated_reports" table initialized.');
        }

        // 3. Initialize user_fcm_tokens
        const hasFcm = await db.schema.hasTable('user_fcm_tokens');
        if (!hasFcm) {
            console.log('Creating "user_fcm_tokens" table...');
            await db.schema.createTable('user_fcm_tokens', (table) => {
                table.increments('id').primary();
                table.integer('user_id').notNullable();
                table.string('token', 500).notNullable().unique();
                table.string('device_type', 50).nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['user_id']);
            });
            console.log('✅ "user_fcm_tokens" table initialized.');
        }

        // 4. Initialize recruitment_openings
        const hasRecruitmentOpenings = await db.schema.hasTable('recruitment_openings');
        if (!hasRecruitmentOpenings) {
            console.log('Creating "recruitment_openings" table...');
            await db.schema.createTable('recruitment_openings', (table) => {
                table.increments('id').primary();
                table.integer('org_id').unsigned().notNullable();
                table.string('job_title', 255).notNullable();
                table.string('slug', 255).notNullable().unique();
                table.string('department', 100).notNullable();
                table.string('location', 255).notNullable();
                table.string('employment_type', 50).defaultTo('Full-time');
                table.string('experience_required', 100).nullable();
                table.string('salary_range', 100).nullable();
                table.text('skills_required').nullable();
                table.text('responsibilities').nullable();
                table.text('benefits').nullable();
                table.date('deadline').nullable();
                table.enum('status', ['active', 'inactive']).defaultTo('active');
                table.text('form_config', 'longtext').nullable(); // JSON configuration for dynamic forms
                table.string('template_id', 100).nullable();
                table.enum('template_source', ['predefined', 'custom', 'scratch']).defaultTo('scratch');
                table.integer('created_by').unsigned().nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['org_id']);
                table.index(['slug']);
            });
            console.log('✅ "recruitment_openings" table initialized.');
        }

        // 5. Initialize recruitment_pipeline_stages
        const hasRecruitmentStages = await db.schema.hasTable('recruitment_pipeline_stages');
        if (!hasRecruitmentStages) {
            console.log('Creating "recruitment_pipeline_stages" table...');
            await db.schema.createTable('recruitment_pipeline_stages', (table) => {
                table.string('id', 100).primary();
                table.integer('org_id').unsigned().notNullable();
                table.string('name', 100).notNullable();
                table.string('color', 50).defaultTo('slate');
                table.integer('sort_order').defaultTo(0);
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['org_id']);
            });
            console.log('✅ "recruitment_pipeline_stages" table initialized.');
        }

        // 6. Initialize recruitment_form_templates
        const hasRecruitmentTemplates = await db.schema.hasTable('recruitment_form_templates');
        if (!hasRecruitmentTemplates) {
            console.log('Creating "recruitment_form_templates" table...');
            await db.schema.createTable('recruitment_form_templates', (table) => {
                table.string('id', 100).primary();
                table.integer('org_id').unsigned().nullable(); // null for global predefined templates
                table.string('name', 255).notNullable();
                table.text('description').nullable();
                table.text('fields', 'longtext').notNullable(); // JSON list of template components
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.index(['org_id']);
            });
            console.log('✅ "recruitment_form_templates" table initialized.');
        }

        // 7. Initialize recruitment_candidates
        const hasRecruitmentCandidates = await db.schema.hasTable('recruitment_candidates');
        if (!hasRecruitmentCandidates) {
            console.log('Creating "recruitment_candidates" table...');
            await db.schema.createTable('recruitment_candidates', (table) => {
                table.increments('id').primary();
                table.integer('job_id').unsigned().notNullable();
                table.string('template_id', 100).nullable();
                table.enum('template_source', ['predefined', 'custom', 'scratch']).nullable();
                table.string('stage', 100).defaultTo('Applied');
                table.text('form_responses', 'longtext').notNullable(); // JSON responses containing all dynamic form data
                table.integer('ai_score').defaultTo(0);
                table.integer('skill_match_score').defaultTo(0);
                table.integer('experience_match_score').defaultTo(0);
                table.integer('education_match_score').defaultTo(0);
                table.integer('culture_fit_score').defaultTo(0);
                table.text('ai_strengths').nullable(); // JSON list
                table.text('ai_weaknesses').nullable(); // JSON list
                table.string('ai_recommendation', 255).nullable();
                table.text('extracted_skills').nullable(); // JSON list
                table.string('total_experience', 50).nullable();
                table.string('relevant_experience', 50).nullable();
                table.string('education', 255).nullable();
                table.text('certifications').nullable();
                table.text('projects').nullable();
                table.text('achievements').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.index(['job_id']);
            });
            console.log('✅ "recruitment_candidates" table initialized.');
        }

        // 8. Add column_preferences to users table
        const hasUsers = await db.schema.hasTable('users');
        if (hasUsers) {
            const hasCol = await db.schema.hasColumn('users', 'column_preferences');
            if (!hasCol) {
                await db.schema.table('users', (table) => {
                    table.text('column_preferences').nullable();
                });
                console.log('✅ Column "column_preferences" added to "users" table.');
            }
            
            const hasChecklistCol = await db.schema.hasColumn('users', 'checklist_template_id');
            if (!hasChecklistCol) {
                await db.schema.table('users', (table) => {
                    table.integer('checklist_template_id').unsigned().nullable();
                });
                console.log('✅ Column "checklist_template_id" added to "users" table.');
            }
            const hasDocCol = await db.schema.hasColumn('users', 'document_template_id');
            if (!hasDocCol) {
                await db.schema.table('users', (table) => {
                    table.integer('document_template_id').unsigned().nullable();
                });
                console.log('✅ Column "document_template_id" added to "users" table.');
            }

            const hasJoiningDateCol = await db.schema.hasColumn('users', 'joining_date');
            if (!hasJoiningDateCol) {
                await db.schema.table('users', (table) => {
                    table.date('joining_date').nullable();
                });
                console.log('✅ Column "joining_date" added to "users" table.');
            }

            const hasReportingManagerCol = await db.schema.hasColumn('users', 'reporting_manager');
            if (!hasReportingManagerCol) {
                await db.schema.table('users', (table) => {
                    table.string('reporting_manager', 255).nullable();
                });
                console.log('✅ Column "reporting_manager" added to "users" table.');
            }

            const hasWorkLocationCol = await db.schema.hasColumn('users', 'work_location');
            if (!hasWorkLocationCol) {
                await db.schema.table('users', (table) => {
                    table.string('work_location', 255).nullable();
                });
                console.log('✅ Column "work_location" added to "users" table.');
            }

            const hasOnboardingProgressCol = await db.schema.hasColumn('users', 'onboarding_progress');
            if (!hasOnboardingProgressCol) {
                await db.schema.table('users', (table) => {
                    table.integer('onboarding_progress').defaultTo(0);
                });
                console.log('✅ Column "onboarding_progress" added to "users" table.');
            }
        }

        // 9. Onboarding Checklist Templates
        const hasChecklistTemplates = await db.schema.hasTable('onboarding_checklist_templates');
        if (!hasChecklistTemplates) {
            console.log('Creating "onboarding_checklist_templates" table...');
            await db.schema.createTable('onboarding_checklist_templates', (table) => {
                table.increments('id').primary();
                table.integer('org_id').notNullable();
                table.string('template_name', 255).notNullable();
                table.text('description').nullable();
                table.integer('created_by').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());
                
                table.index(['org_id']);
            });
            console.log('✅ "onboarding_checklist_templates" table initialized.');
        }

        // 10. Onboarding Checklist Items
        const hasChecklistItems = await db.schema.hasTable('onboarding_checklist_items');
        if (!hasChecklistItems) {
            console.log('Creating "onboarding_checklist_items" table...');
            await db.schema.createTable('onboarding_checklist_items', (table) => {
                table.increments('id').primary();
                table.integer('template_id').unsigned().notNullable();
                table.string('task_key', 100).notNullable();
                table.string('task_label', 255).notNullable();
                table.integer('sort_order').defaultTo(0);
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.foreign('template_id').references('onboarding_checklist_templates.id').onDelete('CASCADE');
                table.index(['template_id']);
            });
            console.log('✅ "onboarding_checklist_items" table initialized.');
        }

        // 11. Employee Checklist Progress
        const hasChecklistProgress = await db.schema.hasTable('employee_checklist_progress');
        if (!hasChecklistProgress) {
            console.log('Creating "employee_checklist_progress" table...');
            await db.schema.createTable('employee_checklist_progress', (table) => {
                table.increments('id').primary();
                table.integer('employee_id').notNullable();
                table.string('task_key', 100).notNullable();
                table.boolean('is_completed').defaultTo(false);
                table.timestamp('completed_at').nullable();
                table.integer('completed_by').nullable();
                
                table.index(['employee_id']);
            });
            console.log('✅ "employee_checklist_progress" table initialized.');
        }

        // 12. Required Document Templates
        const hasDocTemplates = await db.schema.hasTable('required_document_templates');
        if (!hasDocTemplates) {
            console.log('Creating "required_document_templates" table...');
            await db.schema.createTable('required_document_templates', (table) => {
                table.increments('id').primary();
                table.integer('org_id').notNullable();
                table.string('template_name', 255).notNullable();
                table.text('description').nullable();
                table.integer('created_by').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['org_id']);
            });
            console.log('✅ "required_document_templates" table initialized.');
        }

        // 13. Required Document Items
        const hasDocItems = await db.schema.hasTable('required_document_items');
        if (!hasDocItems) {
            console.log('Creating "required_document_items" table...');
            await db.schema.createTable('required_document_items', (table) => {
                table.increments('id').primary();
                table.integer('template_id').unsigned().notNullable();
                table.string('category', 100).notNullable();
                table.string('doc_key', 100).notNullable();
                table.string('doc_label', 255).notNullable();
                table.boolean('is_mandatory').defaultTo(true);
                table.integer('sort_order').defaultTo(0);
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.foreign('template_id').references('required_document_templates.id').onDelete('CASCADE');
                table.index(['template_id']);
            });
            console.log('✅ "required_document_items" table initialized.');
        }

        // 14. Employee Uploaded Documents
        const hasUploadedDocs = await db.schema.hasTable('employee_uploaded_documents');
        if (!hasUploadedDocs) {
            console.log('Creating "employee_uploaded_documents" table...');
            await db.schema.createTable('employee_uploaded_documents', (table) => {
                table.increments('id').primary();
                table.integer('employee_id').notNullable();
                table.string('doc_key', 100).notNullable();
                table.string('file_name', 255).notNullable();
                table.string('file_key', 500).notNullable();
                table.string('file_type', 100).nullable();
                table.timestamp('uploaded_at').defaultTo(db.fn.now());
                table.string('verified_status', 50).defaultTo('Pending');
                table.text('verification_comments').nullable();
                table.integer('verified_by').nullable();
                table.timestamp('verified_at').nullable();

                table.index(['employee_id', 'doc_key']);
            });
            console.log('✅ "employee_uploaded_documents" table initialized.');
        }

        // 15. Performance Cycles
        const hasPerfCycles = await db.schema.hasTable('performance_cycles');
        if (!hasPerfCycles) {
            console.log('Creating "performance_cycles" table...');
            await db.schema.createTable('performance_cycles', (table) => {
                table.string('id', 100).primary();
                table.integer('org_id').notNullable();
                table.string('name', 255).notNullable();
                table.string('type', 50).notNullable();
                table.string('status', 50).notNullable();
                table.string('target_group', 50).notNullable();
                table.date('start_date').nullable();
                table.date('end_date').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['org_id']);
            });
            console.log('✅ "performance_cycles" table initialized.');
        }

        // 16. Employee Performance Goals (KPIs)
        const hasPerfGoals = await db.schema.hasTable('employee_performance_goals');
        if (!hasPerfGoals) {
            console.log('Creating "employee_performance_goals" table...');
            await db.schema.createTable('employee_performance_goals', (table) => {
                table.increments('id').primary();
                table.integer('employee_id').notNullable();
                table.string('cycle_id', 100).notNullable();
                table.string('title', 255).notNullable();
                table.date('deadline').notNullable();
                table.string('status', 50).defaultTo('Pending');
                table.integer('rating').defaultTo(0);
                table.text('comments').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.foreign('cycle_id').references('performance_cycles.id').onDelete('CASCADE');
                table.index(['employee_id', 'cycle_id']);
            });
            console.log('✅ "employee_performance_goals" table initialized.');
        }

        // 17. Employee Performance Reviews
        const hasPerfReviews = await db.schema.hasTable('employee_performance_reviews');
        if (!hasPerfReviews) {
            console.log('Creating "employee_performance_reviews" table...');
            await db.schema.createTable('employee_performance_reviews', (table) => {
                table.increments('id').primary();
                table.integer('employee_id').notNullable();
                table.string('cycle_id', 100).notNullable();
                table.text('self_achievements').nullable();
                table.text('self_challenges').nullable();
                table.text('self_learning').nullable();
                table.text('manager_comments').nullable();
                table.string('manager_recommendation', 255).nullable();
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.unique(['employee_id', 'cycle_id']);
                table.foreign('cycle_id').references('performance_cycles.id').onDelete('CASCADE');
            });
            console.log('✅ "employee_performance_reviews" table initialized.');
        }

    } catch (error) {

        console.error('Error during database table initialization:', error);
    }
};
