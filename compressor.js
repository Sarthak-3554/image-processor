const heic2any = require("heic2any");

class ImageProcessor {
    constructor() {
        document.getElementById('process-images').addEventListener('click', this.handleFileUpload.bind(this));
    }

    handleFileUpload() {
        const quality = parseFloat(document.getElementById('quality').value);
        const maxDimension = parseInt(document.getElementById('max-dimension').value);
        const processType = document.querySelector('input[name="process-type"]:checked').value;
        const files = document.getElementById('upload').files;
        const status = document.getElementById('status');
        const imagePreviewContainer = document.getElementById('image-preview-container');

        if (files.length === 0) {
            status.innerText = 'Please select at least one image file.';
            return;
        }

        status.innerText = 'Processing images...';
        imagePreviewContainer.innerHTML = '';
        let processedCount = 0;

        Array.from(files).forEach(async (file) => {
            let fileType = file.type;
            if (!fileType) {
                const extension = file.name.split('.').pop().toLowerCase();
                if (extension === 'heic' || extension === 'heif') {
                    fileType = `image/${extension}`;
                }
            }

            if (!fileType.startsWith('image/') || !this.isSupportedFormat(file)) {
                status.innerText = 'Error: Unsupported file format. Please upload a supported image file.';
                return;
            }

            if (file.size > 50 * 1024 * 1024) {
                status.innerText = 'Error: File too large. Please upload an image smaller than 50MB.';
                return;
            }

            if (fileType === 'image/heic' || fileType === 'image/jcif') {
                try {
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                    });

                    const img = new Image();
                    img.src = URL.createObjectURL(convertedBlob);
                    img.onload = () => {
                        this.processImage(img, quality, maxDimension, processType === 'enhance', (processedBlob) => {
                            if (processedBlob) {
                                this.displayImagePreview(file.name, img, processedBlob);
                            } else {
                                status.innerText = 'Error: Failed to process image.';
                            }
                            processedCount++;
                            if (processedCount === files.length) {
                                status.innerText = 'Processing complete.';
                            }
                        });
                    };
                } catch (error) {
                    status.innerText = 'Error: Failed to convert HEIC/JCIF image.';
                }
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        this.handleManualCrop(img);
                        this.processImage(img, quality, maxDimension, processType === 'enhance', (processedBlob) => {
                            if (processedBlob) {
                                this.displayImagePreview(file.name, img, processedBlob);
                            } else {
                                status.innerText = 'Error: Failed to process image.';
                            }
                            processedCount++;
                            if (processedCount === files.length) {
                                status.innerText = 'Processing complete.';
                            }
                        });
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    handleManualCrop(imageElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        let startX, startY, dragging = false;

        canvas.addEventListener('mousedown', (event) => {
            startX = event.offsetX;
            startY = event.offsetY;
            dragging = true;
        });

        canvas.addEventListener('mousemove', (event) => {
            if (dragging) {
                const width = event.offsetX - startX;
                const height = event.offsetY - startY;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

                ctx.strokeStyle = 'red';
                ctx.strokeRect(startX, startY, width, height);
            }
        });

        canvas.addEventListener('mouseup', (event) => {
            if (dragging) {
                dragging = false;

                const width = event.offsetX - startX;
                const height = event.offsetY - startY;

                const croppedWidth = Math.abs(width);
                const croppedHeight = Math.abs(height);

                const croppedImageData = ctx.getImageData(startX, startY, croppedWidth, croppedHeight);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                canvas.width = croppedWidth;
                canvas.height = croppedHeight;

                ctx.putImageData(croppedImageData, 0, 0);

                this.displayCroppedImage(canvas.toDataURL());
            }
        });

        document.getElementById('image-preview-container').appendChild(canvas);
    }

    displayImagePreview(fileName, originalImage, processedBlob) {
        const modalContent = document.getElementById('modal-image-content');
        const previewDiv = document.createElement('div');
        previewDiv.classList.add('image-preview');

        const originalImg = document.createElement('img');
        originalImg.src = originalImage.src;
        previewDiv.appendChild(originalImg);

        const processedImg = document.createElement('img');
        processedImg.src = URL.createObjectURL(processedBlob);
        previewDiv.appendChild(processedImg);

        const metadataDiv = document.createElement('div');
        metadataDiv.classList.add('image-metadata');
        metadataDiv.innerHTML = `
            <p>File Name: ${fileName}</p>
            <p>Original Size: ${processedBlob.originalSize} bytes</p>
            <p>Processed Size: ${processedBlob.processedSize} bytes</p>
            <p>Width: ${processedBlob.width} px</p>
            <p>Height: ${processedBlob.height} px</p>
        `;
        previewDiv.appendChild(metadataDiv);

        const downloadLink = document.createElement('a');
        downloadLink.href = processedImg.src;
        downloadLink.download = `processed_${fileName}`;
        downloadLink.innerText = 'Download Processed Image';
        previewDiv.appendChild(downloadLink);

        modalContent.appendChild(previewDiv);
        this.openModal();
    }

    openModal() {
        const imageContainer = document.getElementById('image-container');
        imageContainer.style.display = 'block';
    }

    closeModal() {
        const imageContainer = document.getElementById('image-container');
        imageContainer.style.display = 'none';
    }

    isSupportedFormat(file) {
        const supportedFormats = [
            'image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml',
            'image/heic', 'image/heif', 'image/jfif', 'image/bmp', 'image/webp'
        ];

        if (file.type) {
            return supportedFormats.includes(file.type);
        } else {
            const extension = file.name.split('.').pop().toLowerCase();
            const mimeFromExtension = `image/${extension}`;
            return supportedFormats.includes(mimeFromExtension);
        }
    }

    processImage(image, quality, maxDimension, enhance, callback) {
        let width = image.width;
        let height = image.height;

        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height *= maxDimension / width;
                width = maxDimension;
            } else {
                width *= maxDimension / height;
                height = maxDimension;
            }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        if (enhance) {
            this.enhanceImageQuality(ctx, width, height);
        }

        canvas.toBlob(blob => {
            blob.originalSize = image.src.length;
            blob.processedSize = blob.size;
            blob.width = width;
            blob.height = height;
            callback(blob);
        }, 'image/jpeg', quality);
    }

    enhanceImageQuality(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const { brightness, contrast } = this.analyzeImage(data);
        const brightnessAdjustment = brightness < 100 ? 10 : -70;

        this.adjustBrightness(data, brightnessAdjustment);
        this.adjustContrast(data, contrast);
        this.adjustSaturation(data, 1.1);
        this.applyTextureEnhancement(ctx, width, height);

        ctx.putImageData(imageData, 0, 0);

        this.applyConvolutionFilter(ctx, width, height, [
            -1, -1, -1,
            -1, 9, 0,
            -1, -1, -1
        ]);
    }

    analyzeImage(data) {
        let totalBrightness = 0;
        let totalContrast = 0;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            totalBrightness += brightness;
            totalContrast += Math.abs(data[i] - brightness) + Math.abs(data[i + 1] - brightness) + Math.abs(data[i + 2] - brightness);
        }

        return {
            brightness: totalBrightness / pixelCount,
            contrast: totalContrast / pixelCount
        };
    }

    adjustContrast(data, contrast) {
        const factor = (170 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
            data[i] = this.clamp(factor * (data[i] - 100) + 100);
            data[i + 1] = this.clamp(factor * (data[i + 1] - 100) + 100);
            data[i + 2] = this.clamp(factor * (data[i + 2] - 100) + 100);
        }
    }

    adjustBrightness(data, brightnessAdjustment) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = this.clamp(data[i] + brightnessAdjustment);
            data[i + 1] = this.clamp(data[i + 1] + brightnessAdjustment);
            data[i + 2] = this.clamp(data[i + 2] + brightnessAdjustment);
        }
    }

    adjustSaturation(data, saturation) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.3 * data[i] + 0.1 * data[i + 1] + 0.3 * data[i + 2];
            data[i] = this.clamp(gray + saturation * (data[i] - gray));
            data[i + 1] = this.clamp(gray + saturation * (data[i + 1] - gray));
            data[i + 2] = this.clamp(gray + saturation * (data[i + 2] - gray));
        }
    }

    applyTextureEnhancement(ctx, width, height) {
        const textureKernel = [
            -1, -1, -1,
            -1, 20, -1,
            -1, -1, -1
        ];

        this.applyConvolutionFilter(ctx, width, height, textureKernel);
    }

    clamp(value) {
        return Math.min(255, Math.max(0, value));
    }

    applyConvolutionFilter(ctx, width, height, kernel) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const side = Math.round(Math.sqrt(kernel.length));
        const halfSide = Math.floor(side / 2);
        const output = ctx.createImageData(width, height);
        const outputData = output.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;
                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = y + cy - halfSide;
                        const scx = x + cx - halfSide;
                        if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                            const srcOffset = (scy * width + scx) * 4;
                            const wt = kernel[cy * side + cx];
                            r += data[srcOffset] * wt;
                            g += data[srcOffset + 1] * wt;
                            b += data[srcOffset + 2] * wt;
                        }
                    }
                }
                const dstOffset = (y * width + x) * 4;
                outputData[dstOffset] = this.clamp(r);
                outputData[dstOffset + 1] = this.clamp(g);
                outputData[dstOffset + 2] = this.clamp(b);
                outputData[dstOffset + 3] = 255;
            }
        }

        ctx.putImageData(output, 0, 0);
    }

    displayCroppedImage(imageData) {
        const imageContainer = document.getElementById('cropped-image-container');
        const img = new Image();
        img.src = imageData;
        imageContainer.innerHTML = '';
        imageContainer.appendChild(img);
    }
}

module.exports = ImageProcessor;
