import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import { attendanceDB } from '../../config/database.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

const formatDate = (dateVal) => {
    if (!dateVal) return '';
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

const formatGoal = (goal) => {
    if (!goal) return goal;
    return {
        ...goal,
        deadline: formatDate(goal.deadline)
    };
};

// GET /api/performance/goals/:employee_id/:cycle_id
router.get('/goals/:employee_id/:cycle_id', async (req, res) => {
    const { employee_id, cycle_id } = req.params;

    try {
        const goals = await attendanceDB('employee_performance_goals')
            .where({ employee_id, cycle_id })
            .orderBy('created_at', 'asc');

        res.json({ success: true, data: goals.map(formatGoal) });
    } catch (error) {
        console.error("Error fetching employee goals:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/performance/goals
router.post('/goals', async (req, res) => {
    const { employee_id, cycle_id, title, deadline } = req.body;

    if (!employee_id || !cycle_id || !title || !deadline) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        // Fetch the associated cycle
        const cycle = await attendanceDB('performance_cycles')
            .where({ id: cycle_id, org_id: req.user.org_id })
            .first();

        if (!cycle) {
            return res.status(404).json({ success: false, message: "Performance cycle not found" });
        }

        // 1. Block if cycle is Evaluating or Closed
        if (cycle.status === 'Evaluating' || cycle.status === 'Closed') {
            return res.status(400).json({
                success: false,
                message: `Cannot add goals. This appraisal cycle is currently locked (status: ${cycle.status}).`
            });
        }

        // 2. Validate deadline bounds
        const startStr = formatDate(cycle.start_date);
        const endStr = formatDate(cycle.end_date);
        const dlStr = typeof deadline === 'string' ? deadline.split('T')[0] : formatDate(deadline);

        if (startStr && endStr) {
            if (dlStr < startStr || dlStr > endStr) {
                return res.status(400).json({
                    success: false,
                    message: `Goal deadline must fall within the cycle period: ${startStr} to ${endStr}`
                });
            }
        }

        const [newId] = await attendanceDB('employee_performance_goals').insert({
            employee_id,
            cycle_id,
            title,
            deadline,
            status: 'Pending'
        });

        const createdGoal = await attendanceDB('employee_performance_goals').where({ id: newId }).first();
        res.status(201).json({ success: true, data: formatGoal(createdGoal) });
    } catch (error) {
        console.error("Error creating performance goal:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/performance/goals/:id
router.put('/goals/:id', async (req, res) => {
    const { id } = req.params;
    const { title, deadline, status, rating, comments } = req.body;

    try {
        const goal = await attendanceDB('employee_performance_goals').where({ id }).first();
        if (!goal) {
            return res.status(404).json({ success: false, message: "Goal not found" });
        }

        const cycle = await attendanceDB('performance_cycles').where({ id: goal.cycle_id }).first();
        if (!cycle) {
            return res.status(404).json({ success: false, message: "Associated cycle not found" });
        }

        // 1. Block if Closed
        if (cycle.status === 'Closed') {
            return res.status(400).json({
                success: false,
                message: "Cannot edit goals. This appraisal cycle is closed."
            });
        }

        // 2. Enforce Evaluating freeze rules
        if (cycle.status === 'Evaluating') {
            // Can only modify rating, comments, status. Cannot modify title/deadline.
            if (title !== undefined && title !== goal.title) {
                return res.status(400).json({ success: false, message: "Goal title cannot be changed during evaluation phase." });
            }
            if (deadline !== undefined && deadline !== goal.deadline) {
                return res.status(400).json({ success: false, message: "Goal deadline cannot be changed during evaluation phase." });
            }
        }

        // 3. Enforce Upcoming rules (disable ratings and reviews)
        if (cycle.status === 'Upcoming') {
            if (rating !== undefined && rating !== goal.rating) {
                return res.status(400).json({ success: false, message: "Ratings cannot be assigned during upcoming pre-planning phase." });
            }
            if (comments !== undefined && comments !== goal.comments) {
                return res.status(400).json({ success: false, message: "Manager comments cannot be added during upcoming pre-planning phase." });
            }
        }

        // 4. Validate deadline bounds if it is changing
        if (deadline) {
            const startStr = formatDate(cycle.start_date);
            const endStr = formatDate(cycle.end_date);
            const dlStr = typeof deadline === 'string' ? deadline.split('T')[0] : formatDate(deadline);

            if (startStr && endStr) {
                if (dlStr < startStr || dlStr > endStr) {
                    return res.status(400).json({
                        success: false,
                        message: `Goal deadline must fall within the cycle period: ${startStr} to ${endStr}`
                    });
                }
            }
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (deadline !== undefined) updates.deadline = deadline;
        if (status !== undefined) updates.status = status;
        if (rating !== undefined) updates.rating = rating;
        if (comments !== undefined) updates.comments = comments;

        await attendanceDB('employee_performance_goals')
            .where({ id })
            .update(updates);

        const updatedGoal = await attendanceDB('employee_performance_goals').where({ id }).first();
        res.json({ success: true, data: formatGoal(updatedGoal) });
    } catch (error) {
        console.error("Error updating performance goal:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/performance/goals/:id
router.delete('/goals/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const goal = await attendanceDB('employee_performance_goals').where({ id }).first();
        if (!goal) {
            return res.status(404).json({ success: false, message: "Goal not found" });
        }

        const cycle = await attendanceDB('performance_cycles').where({ id: goal.cycle_id }).first();
        if (cycle && (cycle.status === 'Evaluating' || cycle.status === 'Closed')) {
            return res.status(400).json({
                success: false,
                message: `Goals cannot be deleted during evaluation or when closed (current cycle status: ${cycle.status}).`
            });
        }

        await attendanceDB('employee_performance_goals').where({ id }).del();
        res.json({ success: true, message: "Performance goal deleted successfully" });
    } catch (error) {
        console.error("Error deleting performance goal:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/performance/reviews/:employee_id/:cycle_id
router.get('/reviews/:employee_id/:cycle_id', async (req, res) => {
    const { employee_id, cycle_id } = req.params;

    try {
        const review = await attendanceDB('employee_performance_reviews')
            .where({ employee_id, cycle_id })
            .first();

        res.json({ success: true, data: review || null });
    } catch (error) {
        console.error("Error fetching performance reviews:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/performance/reviews
router.post('/reviews', async (req, res) => {
    const {
        employee_id,
        cycle_id,
        self_achievements,
        self_challenges,
        self_learning,
        manager_comments,
        manager_recommendation
    } = req.body;

    if (!employee_id || !cycle_id) {
        return res.status(400).json({ success: false, message: "Employee ID and Cycle ID are required" });
    }

    try {
        const cycle = await attendanceDB('performance_cycles').where({ id: cycle_id }).first();
        if (!cycle) {
            return res.status(404).json({ success: false, message: "Performance cycle not found" });
        }

        // 1. Block if cycle is Closed
        if (cycle.status === 'Closed') {
            return res.status(400).json({ success: false, message: "This performance cycle is closed. Reviews are locked." });
        }

        // 2. Block if cycle is Upcoming
        if (cycle.status === 'Upcoming') {
            return res.status(400).json({ success: false, message: "Reviews cannot be submitted during the upcoming pre-planning phase." });
        }

        // 3. Check role/permission constraints
        const isAdminOrHr = req.user.user_type === 'admin' || req.user.user_type === 'hr';

        const existing = await attendanceDB('employee_performance_reviews')
            .where({ employee_id, cycle_id })
            .first();

        const updates = {};
        
        // Employees can only update self assessment columns
        if (self_achievements !== undefined) updates.self_achievements = self_achievements;
        if (self_challenges !== undefined) updates.self_challenges = self_challenges;
        if (self_learning !== undefined) updates.self_learning = self_learning;

        // Managers/Admins can update everything
        if (isAdminOrHr) {
            if (manager_comments !== undefined) updates.manager_comments = manager_comments;
            if (manager_recommendation !== undefined) updates.manager_recommendation = manager_recommendation;
        } else {
            // Block employee from updating manager comments/recommendations
            if (manager_comments !== undefined && manager_comments !== (existing?.manager_comments || null)) {
                return res.status(403).json({ success: false, message: "Only administrators/managers can edit manager review comments." });
            }
            if (manager_recommendation !== undefined && manager_recommendation !== (existing?.manager_recommendation || null)) {
                return res.status(403).json({ success: false, message: "Only administrators/managers can edit manager recommendations." });
            }
        }

        if (existing) {
            await attendanceDB('employee_performance_reviews')
                .where({ id: existing.id })
                .update(updates);
        } else {
            await attendanceDB('employee_performance_reviews')
                .insert({
                    employee_id,
                    cycle_id,
                    ...updates
                });
        }

        const savedReview = await attendanceDB('employee_performance_reviews')
            .where({ employee_id, cycle_id })
            .first();

        res.json({ success: true, data: savedReview });
    } catch (error) {
        console.error("Error saving performance review:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
