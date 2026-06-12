import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { attendanceDB } from '../../config/database.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg, ensureAdmin);

const formatDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
        const year = dateVal.getFullYear();
        const month = String(dateVal.getMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0];
    }
    return dateVal;
};

const formatCycle = (cycle) => {
    if (!cycle) return cycle;
    return {
        ...cycle,
        start_date: formatDate(cycle.start_date),
        end_date: formatDate(cycle.end_date)
    };
};

// GET /api/admin/performance-cycles
router.get('/', async (req, res) => {
    try {
        const cycles = await attendanceDB('performance_cycles')
            .where({ org_id: req.user.org_id })
            .orderBy('created_at', 'desc');

        res.json({ success: true, data: cycles.map(formatCycle) });
    } catch (error) {
        console.error("Error fetching performance cycles:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/performance-cycles
router.post('/', async (req, res) => {
    const { id, name, type, status, target_group, start_date, end_date } = req.body;
    if (!name || !type || !status || !target_group) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const cycleId = id || `cycle-${Date.now()}`;

    try {
        await attendanceDB('performance_cycles').insert({
            id: cycleId,
            org_id: req.user.org_id,
            name,
            type,
            status,
            target_group,
            start_date: start_date || null,
            end_date: end_date || null
        });

        const createdCycle = await attendanceDB('performance_cycles').where({ id: cycleId }).first();
        res.status(201).json({ success: true, data: formatCycle(createdCycle) });
    } catch (error) {
        console.error("Error creating performance cycle:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/performance-cycles/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, status, target_group, start_date, end_date } = req.body;

    try {
        const cycleExists = await attendanceDB('performance_cycles')
            .where({ id, org_id: req.user.org_id })
            .first();

        if (!cycleExists) {
            return res.status(404).json({ success: false, message: "Performance cycle not found" });
        }

        await attendanceDB('performance_cycles')
            .where({ id })
            .update({
                name,
                type,
                status,
                target_group,
                start_date: start_date || null,
                end_date: end_date || null,
                updated_at: attendanceDB.fn.now()
            });

        const updatedCycle = await attendanceDB('performance_cycles').where({ id }).first();
        res.json({ success: true, data: formatCycle(updatedCycle) });
    } catch (error) {
        console.error("Error updating performance cycle:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/performance-cycles/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const affectedRows = await attendanceDB('performance_cycles')
            .where({ id, org_id: req.user.org_id })
            .del();

        if (!affectedRows) {
            return res.status(404).json({ success: false, message: "Performance cycle not found" });
        }

        res.json({ success: true, message: "Performance cycle deleted successfully" });
    } catch (error) {
        console.error("Error deleting performance cycle:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
