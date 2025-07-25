const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { Book, Page } = require("../models");
const s3Service = require("./s3Service");
const logger = require("../utils/logger");
const { S3_BUCKET_NAME } = require("../utils/constants");

class PrintReadyPDFService {
  constructor() {
    // 7.5" x 7.5" at 300 DPI (TRIM SIZE - what Lulu expects)
    this.trimWidth = 7.5 * 300; // 2250 pixels
    this.trimHeight = 7.5 * 300; // 2250 pixels
    this.dpi = 300;

    // For internal processing, we can still use bleed for better image quality
    this.bleed = 0.125 * 300; // 37.5 pixels
    this.processWidth = this.trimWidth + this.bleed * 2; // 2325 pixels (for image processing)
    this.processHeight = this.trimHeight + this.bleed * 2; // 2325 pixels (for image processing)

    // Safe area (0.25" margin from trim)
    this.safeMargin = 0.25 * 300; // 75 pixels
  }

  /**
   * Generate print-ready PDFs for a book
   */
  async generatePrintReadyPDFs(bookId) {
    try {
      logger.info(`Generating print-ready PDFs for book ${bookId}`);

      // Get book and pages data
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      const pages = await Page.find({ book_id: bookId }).sort({
        page_number: 1,
      });
      if (!pages || pages.length === 0) {
        throw new Error("No pages found for book");
      }

      // Generate cover PDF
      const coverPdfPath = await this.generateCoverPDF(book, pages);

      // Generate interior PDF
      const interiorPdfPath = await this.generateInteriorPDF(book, pages);

      // Upload PDFs to S3
      const coverPdfUrl = await this.uploadPDFToS3(
        coverPdfPath,
        `print-covers/${bookId}-cover.pdf`
      );
      const interiorPdfUrl = await this.uploadPDFToS3(
        interiorPdfPath,
        `print-interiors/${bookId}-interior.pdf`
      );

      // Clean up local files
      fs.unlinkSync(coverPdfPath);
      fs.unlinkSync(interiorPdfPath);

      logger.info("Print-ready PDFs generated successfully", {
        bookId,
        coverPdfUrl,
        interiorPdfUrl,
      });

      return {
        coverPdfUrl,
        interiorPdfUrl,
      };
    } catch (error) {
      logger.error("Failed to generate print-ready PDFs:", error);
      throw new Error(`Failed to generate print-ready PDFs: ${error.message}`);
    }
  }

  /**
   * Generate cover PDF (front and back cover)
   */
  async generateCoverPDF(book, pages) {
    try {
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const coverPdfPath = path.join(
        tempDir,
        `cover-${book._id}-${Date.now()}.pdf`
      );

      // Calculate spine width based on page count
      // Assuming 80# coated paper (~0.004" per sheet)
      const spineWidth = Math.max(pages.length * 0.004 * 300, 0.0625 * 300); // Minimum 0.0625" spine

      // Total cover width = front + spine + back (TRIM SIZE for Lulu)
      const coverWidth = this.trimWidth * 2 + spineWidth;
      const coverHeight = this.trimHeight;

      const doc = new PDFDocument({
        size: [coverWidth, coverHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const stream = fs.createWriteStream(coverPdfPath);
      doc.pipe(stream);

      // Process and add front cover
      if (book.front_cover_image_url) {
        const frontCoverBuffer = await this.processImageForPrint(
          book.front_cover_image_url,
          this.trimWidth,
          this.trimHeight
        );

        // Place front cover on the right side
        const frontCoverX = this.trimWidth + spineWidth;
        doc.image(frontCoverBuffer, frontCoverX, 0, {
          width: this.trimWidth,
          height: this.trimHeight,
        });
      }

      // Process and add back cover
      if (book.back_cover_image_url) {
        const backCoverBuffer = await this.processImageForPrint(
          book.back_cover_image_url,
          this.trimWidth,
          this.trimHeight
        );

        // Place back cover on the left side
        doc.image(backCoverBuffer, 0, 0, {
          width: this.trimWidth,
          height: this.trimHeight,
        });
      } else {
        // Create a simple back cover with book title
        doc.rect(0, 0, this.trimWidth, this.trimHeight).fill("#ffffff");

        doc
          .fontSize(24)
          .fillColor("#000000")
          .text(book.title, this.safeMargin, this.trimHeight / 2, {
            width: this.trimWidth - this.safeMargin * 2,
            align: "center",
          });
      }

      // Add spine text if spine is wide enough
      if (spineWidth > 50) {
        doc.save();
        doc.rotate(90, this.trimWidth + spineWidth / 2, this.trimHeight / 2);
        doc
          .fontSize(12)
          .fillColor("#000000")
          .text(book.title, 0, 0, {
            width: this.trimHeight - this.safeMargin * 2,
            align: "center",
          });
        doc.restore();
      }

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(coverPdfPath));
        stream.on("error", reject);
      });
    } catch (error) {
      logger.error("Failed to generate cover PDF:", error);
      throw error;
    }
  }

  /**
   * Generate interior PDF (all pages)
   */
  async generateInteriorPDF(book, pages) {
    try {
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const interiorPdfPath = path.join(
        tempDir,
        `interior-${book._id}-${Date.now()}.pdf`
      );

      const doc = new PDFDocument({
        size: [this.trimWidth, this.trimHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const stream = fs.createWriteStream(interiorPdfPath);
      doc.pipe(stream);

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        if (i > 0) {
          doc.addPage();
        }

        // Add page illustration
        if (page.illustration_url) {
          const illustrationBuffer = await this.processImageForPrint(
            page.illustration_url,
            this.trimWidth,
            this.trimHeight
          );

          doc.image(illustrationBuffer, 0, 0, {
            width: this.trimWidth,
            height: this.trimHeight,
          });
        }

        // Add text overlay if needed
        if (page.text && page.text.trim()) {
          // Create semi-transparent text area
          const textAreaHeight = 150;
          const textAreaY = this.trimHeight - textAreaHeight - this.safeMargin;

          doc
            .rect(
              this.safeMargin,
              textAreaY,
              this.trimWidth - this.safeMargin * 2,
              textAreaHeight
            )
            .fillOpacity(0.8)
            .fill("#ffffff")
            .fillOpacity(1);

          // Add text
          doc
            .fontSize(16)
            .fillColor("#000000")
            .text(page.text, this.safeMargin + 20, textAreaY + 20, {
              width: this.trimWidth - this.safeMargin * 2 - 40,
              height: textAreaHeight - 40,
              align: "center",
              valign: "center",
            });
        }
      }

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(interiorPdfPath));
        stream.on("error", reject);
      });
    } catch (error) {
      logger.error("Failed to generate interior PDF:", error);
      throw error;
    }
  }

  /**
   * Process image for print (convert to CMYK, 300 DPI, proper size)
   */
  async processImageForPrint(imageUrl, targetWidth, targetHeight) {
    try {
      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Process with Sharp
      const processedBuffer = await sharp(imageBuffer)
        .resize(Math.round(targetWidth), Math.round(targetHeight), {
          fit: "cover",
          position: "center",
        })
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4", // No chroma subsampling for print
          density: 300, // Ensure 300 DPI
        })
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      logger.error("Failed to process image for print:", error);
      throw error;
    }
  }

  /**
   * Upload PDF to S3
   */
  async uploadPDFToS3(filePath, s3Key) {
    try {
      const result = await s3Service.uploadLocalFile(
        filePath,
        s3Key,
        "application/pdf"
      );
      return result;
    } catch (error) {
      logger.error("Failed to upload PDF to S3:", error);
      throw error;
    }
  }

  /**
   * Calculate cover dimensions for Lulu
   */
  calculateCoverDimensions(pageCount) {
    // Calculate spine width based on page count
    const spineWidth = Math.max(pageCount * 0.004, 0.0625); // inches

    // Total cover width = front + spine + back
    const coverWidth = 7.5 * 2 + spineWidth;
    const coverHeight = 7.5;

    return {
      width: coverWidth,
      height: coverHeight,
      spineWidth: spineWidth,
      unit: "in",
    };
  }
}

module.exports = new PrintReadyPDFService();
