import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'icons', 'feature_graphic.png');
const outputPath = path.join(__dirname, 'icons', 'feature_graphic_1024x500.png');

async function resize() {
    try {
        await sharp(inputPath)
            .resize(1024, 500, {
                fit: 'cover',
                position: 'center'
            })
            .png({ quality: 100 })
            .toFile(outputPath);

        console.log('✅ Feature graphic resized to 1024x500 and saved to:', outputPath);

        // Get info about the output file
        const info = await sharp(outputPath).metadata();
        console.log(`📐 Output dimensions: ${info.width}x${info.height}`);
    } catch (err) {
        console.error('❌ Error resizing image:', err);
    }
}

resize();
