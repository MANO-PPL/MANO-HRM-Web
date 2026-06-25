/**
 * Compress and resize an image client-side before uploading to the server.
 * Handles photo uploads from cameras/smartphones (which can be 5-15MB) and converts them
 * into a lightweight WebP/JPEG blob under ~100-300KB.
 *
 * @param {File} file - The original File object selected by user.
 * @param {Object} options - Compression options.
 * @param {number} [options.maxWidth=1024] - Maximum width in pixels.
 * @param {number} [options.maxHeight=1024] - Maximum height in pixels.
 * @param {number} [options.quality=0.85] - Compression quality (0.1 to 1.0).
 * @param {string} [options.outputType='image/webp'] - Target MIME format.
 * @returns {Promise<File>} Compressed File object.
 */
export async function compressImage(
    file,
    { maxWidth = 1024, maxHeight = 1024, quality = 0.85, outputType = 'image/webp' } = {}
) {
    if (!file || !(file instanceof File) || !file.type.startsWith('image/')) {
        return file;
    }

    // Skip animated GIFs to avoid breaking GIF animation
    if (file.type === 'image/gif') {
        return file;
    }

    // If file is already small (< 150KB) and matches requested type, return as-is
    if (file.size <= 150 * 1024 && file.type === outputType) {
        return file;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file); // Fallback to original file if blob creation fails
                            return;
                        }

                        const ext = outputType === 'image/webp' ? '.webp' : '.jpg';
                        const newName = file.name.replace(/\.[^/.]+$/, "") + ext;

                        const compressedFile = new File([blob], newName, {
                            type: outputType,
                            lastModified: Date.now()
                        });

                        resolve(compressedFile);
                    },
                    outputType,
                    quality
                );
            };

            img.onerror = () => resolve(file);
            img.src = event.target.result;
        };

        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}
