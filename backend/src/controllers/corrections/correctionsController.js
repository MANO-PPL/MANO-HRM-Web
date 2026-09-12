import * as correctionsService from '../../services/corrections/correctionsService.js';
import catchAsync from '../../utils/catchAsync.js';
import path from 'path';
import { uploadFile } from '../../services/s3/s3Service.js';
import crypto from 'crypto';
import { notifyCorrectionApplied, notifyCorrectionStatusUpdated } from '../../services/collaboration/chatAlertService.js';

/**
 * POST /attendance/correction-request
 * Submit a correction request for attendance
 */
export const submitCorrectionRequest = catchAsync(async (req, res) => {
    const {
        correction_type,
        request_date,
        reason,
        original_data,
        proposed_data,
        existing_request_id
    } = req.body;

    const user_id = req.user.id || req.user.user_id;
    const org_id = req.user.org_id;

    if (!correction_type || !request_date || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Parse JSON data if submitted via FormData multipart
    let parsedProposedData = proposed_data;
    if (typeof proposed_data === 'string') {
        try {
            parsedProposedData = JSON.parse(proposed_data);
        } catch (_) {
            parsedProposedData = null;
        }
    }

    let parsedOriginalData = original_data;
    if (typeof original_data === 'string') {
        try {
            parsedOriginalData = JSON.parse(original_data);
        } catch (_) {
            parsedOriginalData = null;
        }
    }

    if (correction_type === 'punch') {
        if (!parsedProposedData || !Array.isArray(parsedProposedData)) {
            parsedProposedData = [];
        }
    } else if (correction_type === 'summary') {
        if (!parsedProposedData || typeof parsedProposedData !== 'object') {
            return res.status(400).json({ error: "proposed_data object is required for summary corrections" });
        }
    }

    // Handle optional attachment upload to S3
    let attachmentMeta = null;
    if (req.file) {
        try {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const fileKey = `corrections/${org_id}/${user_id}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
            await uploadFile({
                fileBuffer: req.file.buffer,
                key: fileKey,
                contentType: req.file.mimetype || 'application/octet-stream'
            });
            attachmentMeta = {
                file_key: fileKey,
                file_name: req.file.originalname,
                file_type: req.file.mimetype,
                file_size: req.file.size
            };
        } catch (uploadErr) {
            console.error("Correction attachment upload failed:", uploadErr);
        }
    }

    const result = await correctionsService.createCorrectionRequest({
        org_id,
        user_id,
        user_type: req.user?.user_type,
        correction_type,
        request_date,
        original_data: parsedOriginalData,
        proposed_data: parsedProposedData,
        reason,
        attachmentMeta,
        existing_request_id: existing_request_id ? Number(existing_request_id) : null
    });

    const acr_id = typeof result === 'object' ? result.id : result;
    const is_updated = typeof result === 'object' ? result.is_updated : false;

    // Trigger correction request DM alert cards to all Admins and HRs
    const io = req.app.get('io');
    notifyCorrectionApplied({ org_id, sender_id: user_id, acr_id, io }).catch(console.error);

    res.status(is_updated ? 200 : 201).json({
        message: is_updated ? "Correction request updated successfully" : "Correction request submitted",
        acr_id,
        is_updated
    });
});

/**
 * GET /attendance/correction-requests
 * Fetch correction requests with filters
 */
export const getCorrectionRequests = catchAsync(async (req, res) => {
    const { status, date, month, year, page = 1, limit = 10, my_requests } = req.query;
    const org_id = req.user.org_id;
    const user_id = req.user.id || req.user.user_id;
    const user_type = (my_requests === 'true' || my_requests === true) ? 'employee' : req.user.user_type;

    const result = await correctionsService.fetchCorrectionRequests({
        org_id,
        user_id,
        user_type,
        status,
        date,
        month,
        year,
        page,
        limit
    });

    res.json(result);
});

/**
 * GET /attendance/correction-request/:acr_id
 * Fetch single correction request details
 */
export const getCorrectionRequestById = catchAsync(async (req, res) => {
    const { acr_id } = req.params;
    const org_id = req.user.org_id;
    const user_id = req.user.id || req.user.user_id;
    const role = req.user.user_type;

    const correction = await correctionsService.fetchCorrectionRequestById({
        acr_id,
        org_id,
        user_id,
        role
    });

    if (!correction) {
        return res.status(404).json({ error: "Request not found" });
    }

    res.json(correction);
});

/**
 * PATCH /attendance/correct-request/:acr_id
 * Admin endpoint to approve/reject correction request
 */
export const reviewCorrectionRequest = catchAsync(async (req, res) => {
    const { acr_id } = req.params;
    const { status, review_comments, sessions } = req.body;

    const org_id = req.user.org_id;
    const reviewer_id = req.user.id || req.user.user_id;
    const role = req.user.user_type;

    if (role !== "admin" && role !== "hr") {
        return res.status(403).json({ error: "Access denied" });
    }

    const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";

    if (!["approved", "rejected"].includes(normalizedStatus)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        await correctionsService.reviewCorrectionRequest({
            acr_id,
            org_id,
            reviewer_id,
            status: normalizedStatus,
            review_comments,
            adminOverrideSessions: sessions
        });

        // Trigger premium correction status update card in employee's DM chat
        const io = req.app.get('io');
        notifyCorrectionStatusUpdated({ org_id, reviewer_id, acr_id, io }).catch(console.error);

        res.json({ message: `Request ${normalizedStatus} successfully` });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        throw err;
    }
});