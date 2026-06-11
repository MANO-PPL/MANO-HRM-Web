import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { attendanceDB } from '../../config/database.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg, ensureAdmin);

// GET /api/admin/document-templates
router.get('/', async (req, res) => {
    try {
        let templates = await attendanceDB('required_document_templates')
            .where({ org_id: req.user.org_id });

        for (let template of templates) {
            template.items = await attendanceDB('required_document_items')
                .where({ template_id: template.id })
                .orderBy('sort_order', 'asc');
        }

        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Error fetching document templates:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/document-templates
router.post('/', async (req, res) => {
    const { template_name, description, items } = req.body;
    if (!template_name) {
        return res.status(400).json({ success: false, message: "Template name is required" });
    }

    try {
        let insertedId;
        await attendanceDB.transaction(async (trx) => {
            const [id] = await trx('required_document_templates').insert({
                org_id: req.user.org_id,
                template_name,
                description,
                created_by: req.user.user_id
            });
            insertedId = id;

            if (items && items.length > 0) {
                const itemsToInsert = items.map((item, idx) => ({
                    template_id: id,
                    category: item.category || 'Default',
                    doc_key: item.doc_key || `doc_${Date.now()}_${idx}`,
                    doc_label: item.doc_label || item.name || '',
                    is_mandatory: item.is_mandatory !== undefined ? item.is_mandatory : true,
                    sort_order: item.sort_order || idx
                }));
                await trx('required_document_items').insert(itemsToInsert);
            }
        });

        const createdTemplate = await attendanceDB('required_document_templates').where({ id: insertedId }).first();
        createdTemplate.items = await attendanceDB('required_document_items')
            .where({ template_id: insertedId })
            .orderBy('sort_order', 'asc');

        res.status(201).json({ success: true, data: createdTemplate });
    } catch (error) {
        console.error("Error creating document template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/document-templates/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { template_name, description, items } = req.body;

    if (!template_name) {
        return res.status(400).json({ success: false, message: "Template name is required" });
    }

    try {
        const templateExists = await attendanceDB('required_document_templates')
            .where({ id, org_id: req.user.org_id })
            .first();

        if (!templateExists) {
            return res.status(404).json({ success: false, message: "Document template not found" });
        }

        await attendanceDB.transaction(async (trx) => {
            await trx('required_document_templates')
                .where({ id })
                .update({
                    template_name,
                    description,
                    updated_at: attendanceDB.fn.now()
                });

            // Re-sync items
            await trx('required_document_items').where({ template_id: id }).del();

            if (items && items.length > 0) {
                const itemsToInsert = items.map((item, idx) => ({
                    template_id: id,
                    category: item.category || 'Default',
                    doc_key: item.doc_key || `doc_${Date.now()}_${idx}`,
                    doc_label: item.doc_label || item.name || '',
                    is_mandatory: item.is_mandatory !== undefined ? item.is_mandatory : true,
                    sort_order: item.sort_order || idx
                }));
                await trx('required_document_items').insert(itemsToInsert);
            }
        });

        const updatedTemplate = await attendanceDB('required_document_templates').where({ id }).first();
        updatedTemplate.items = await attendanceDB('required_document_items')
            .where({ template_id: id })
            .orderBy('sort_order', 'asc');

        res.json({ success: true, data: updatedTemplate });
    } catch (error) {
        console.error("Error updating document template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/document-templates/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const affectedRows = await attendanceDB('required_document_templates')
            .where({ id, org_id: req.user.org_id })
            .del();

        if (!affectedRows) {
            return res.status(404).json({ success: false, message: "Document template not found" });
        }

        res.json({ success: true, message: "Document template deleted successfully" });
    } catch (error) {
        console.error("Error deleting document template:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
