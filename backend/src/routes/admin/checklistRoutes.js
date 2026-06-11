import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { attendanceDB } from '../../config/database.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg, ensureAdmin);

// GET /api/admin/checklist-templates
router.get('/', async (req, res) => {
    try {
        let templates = await attendanceDB('onboarding_checklist_templates')
            .where({ org_id: req.user.org_id });

        for (let template of templates) {
            template.items = await attendanceDB('onboarding_checklist_items')
                .where({ template_id: template.id })
                .orderBy('sort_order', 'asc');
        }

        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Error fetching checklist templates:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/checklist-templates
router.post('/', async (req, res) => {
    const { template_name, description, items } = req.body;
    if (!template_name) {
        return res.status(400).json({ success: false, message: "Template name is required" });
    }

    try {
        let insertedId;
        await attendanceDB.transaction(async (trx) => {
            const [id] = await trx('onboarding_checklist_templates').insert({
                org_id: req.user.org_id,
                template_name,
                description,
                created_by: req.user.user_id
            });
            insertedId = id;

            if (items && items.length > 0) {
                const itemsToInsert = items.map((item, idx) => ({
                    template_id: id,
                    task_key: item.task_key || `task_${Date.now()}_${idx}`,
                    task_label: item.task_label || item.label || '',
                    sort_order: item.sort_order || idx
                }));
                await trx('onboarding_checklist_items').insert(itemsToInsert);
            }
        });

        // Fetch the fully created template
        const createdTemplate = await attendanceDB('onboarding_checklist_templates').where({ id: insertedId }).first();
        createdTemplate.items = await attendanceDB('onboarding_checklist_items')
            .where({ template_id: insertedId })
            .orderBy('sort_order', 'asc');

        res.status(201).json({ success: true, data: createdTemplate });
    } catch (error) {
        console.error("Error creating checklist template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/checklist-templates/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { template_name, description, items } = req.body;

    if (!template_name) {
        return res.status(400).json({ success: false, message: "Template name is required" });
    }

    try {
        const templateExists = await attendanceDB('onboarding_checklist_templates')
            .where({ id, org_id: req.user.org_id })
            .first();

        if (!templateExists) {
            return res.status(404).json({ success: false, message: "Checklist template not found" });
        }

        await attendanceDB.transaction(async (trx) => {
            await trx('onboarding_checklist_templates')
                .where({ id })
                .update({
                    template_name,
                    description,
                    updated_at: attendanceDB.fn.now()
                });

            // Re-sync items by deleting old ones and re-inserting
            await trx('onboarding_checklist_items').where({ template_id: id }).del();

            if (items && items.length > 0) {
                const itemsToInsert = items.map((item, idx) => ({
                    template_id: id,
                    task_key: item.task_key || `task_${Date.now()}_${idx}`,
                    task_label: item.task_label || item.label || '',
                    sort_order: item.sort_order || idx
                }));
                await trx('onboarding_checklist_items').insert(itemsToInsert);
            }
        });

        const updatedTemplate = await attendanceDB('onboarding_checklist_templates').where({ id }).first();
        updatedTemplate.items = await attendanceDB('onboarding_checklist_items')
            .where({ template_id: id })
            .orderBy('sort_order', 'asc');

        res.json({ success: true, data: updatedTemplate });
    } catch (error) {
        console.error("Error updating checklist template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/checklist-templates/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const affectedRows = await attendanceDB('onboarding_checklist_templates')
            .where({ id, org_id: req.user.org_id })
            .del();

        if (!affectedRows) {
            return res.status(404).json({ success: false, message: "Checklist template not found" });
        }

        res.json({ success: true, message: "Checklist template deleted successfully" });
    } catch (error) {
        console.error("Error deleting checklist template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
