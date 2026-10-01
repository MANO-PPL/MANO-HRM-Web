import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { answerWebsiteQuestion, answerInternalQuestion } from './websiteRagService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Every question is sent to the LLM together with the history, so both are
// bounded. The website widget sends at most the last 6 messages.
const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_TEXT_LENGTH = 2000;

const readQuestion = (body) => {
    const input = String(body?.question || body?.message || '').trim();
    if (!input) throw new AppError('question is required in request body', 400);
    if (input.length > MAX_QUESTION_LENGTH) {
        throw new AppError(`Please keep your question under ${MAX_QUESTION_LENGTH} characters`, 400);
    }
    return input;
};

const readHistory = (history) => (Array.isArray(history) ? history : [])
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({ role: msg.role, text: String(msg.text ?? msg.content ?? '').slice(0, MAX_HISTORY_TEXT_LENGTH) }));

export const askWebsiteChatbot = catchAsync(async (req, res, next) => {
    const input = readQuestion(req.body);
    const history = readHistory(req.body?.history);

    let result;
    try {
        result = await answerWebsiteQuestion(input, history);
    } catch (error) {
        const rawMessage = String(error?.message || '').toLowerCase();
        const infraFailure = rawMessage.includes('chromadb')
            || rawMessage.includes('connect')
            || rawMessage.includes('timeout')
            || rawMessage.includes('fetch')
            || rawMessage.includes('could not be found')
            || rawMessage.includes('not found');

        if (infraFailure) {
            return res.status(200).json({
                ok: true,
                data: {
                    question: input,
                    answer: 'I am temporarily unable to access website knowledge. Please try again in a moment.',
                    sources: [],
                },
            });
        }

        return next(error);
    }

    res.status(200).json({
        ok: true,
        data: {
            question: input,
            answer: result.answer,
            sources: result.sources,
        },
    });
});

export const askInternalChatbot = catchAsync(async (req, res, next) => {
    const input = readQuestion(req.body);
    const pathName = req.body?.path;
    const role = req.user?.user_type || 'employee';

    let result;
    try {
        result = await answerInternalQuestion(input, role, pathName);
    } catch (error) {
        return next(error);
    }

    res.status(200).json({
        ok: true,
        data: {
            question: input,
            answer: result.answer,
        },
    });
});

export const getAppGuide = catchAsync(async (req, res, next) => {
    let guides = [];
    try {
        const fileContent = await fs.readFile(path.resolve(__dirname, './internalAppGuide.json'), 'utf-8');
        guides = JSON.parse(fileContent);
    } catch (error) {
        console.error('Failed to load internalAppGuide.json:', error);
        return next(new AppError('Failed to load application guide', 500));
    }

    res.status(200).json({
        ok: true,
        data: guides,
    });
});
