import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import catchAsync from '../../utils/catchAsync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getInternalGuide = catchAsync(async (req, res) => {
    const guidePath = path.resolve(__dirname, '../../services/chatbot/internalAppGuide.json');
    const fileContent = await fs.readFile(guidePath, 'utf-8');
    
    res.json({
        ok: true,
        guide: JSON.parse(fileContent)
    });
});
