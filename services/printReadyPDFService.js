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
    // 7.5" x 7.5" at 72 DPI (TRIM SIZE)
    this.trimWidth = 7.5 * 72; // 540 pixels
    this.trimHeight = 7.5 * 72; // 540 pixels
    this.dpi = 72;

    // Bleed margin (0.125" on all sides)
    this.bleed = 0.125 * 72; // 9 pixels

    // Interior PDF dimensions with bleed: 7.75" x 7.75"
    this.interiorPdfWidth = this.trimWidth + this.bleed * 2; // 558 pixels (7.75")
    this.interiorPdfHeight = this.trimHeight + this.bleed * 2; // 558 pixels (7.75")

    // Cover PDF dimensions with bleed: 15.25" x 7.75"
    // Cover includes front + back + bleed on all sides
    this.coverPdfHeight = this.trimHeight + this.bleed * 2; // 558 pixels (7.75")

    // Safe area (0.25" margin from trim)
    this.safeMargin = 0.25 * 72; // 18 pixels
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

      // For saddle stitch binding, no spine width needed
      // Total cover width with bleed = front + back + bleed on left and right
      // 15.25" = 7.5" (front) + 7.5" (back) + 0.125" (left bleed) + 0.125" (right bleed)
      const coverPdfWidth = this.trimWidth * 2 + this.bleed * 2; // 1098 pixels (15.25" at 72 DPI)
      const coverPdfHeight = this.coverPdfHeight; // 558 pixels (7.75" at 72 DPI)

      const doc = new PDFDocument({
        size: [coverPdfWidth, coverPdfHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const stream = fs.createWriteStream(coverPdfPath);
      doc.pipe(stream);

      // Fill entire PDF with white background (including bleed areas)
      doc.rect(0, 0, coverPdfWidth, coverPdfHeight).fill("#ffffff");

      // Process and add front cover (positioned with bleed offset)
      if (book.front_cover_image_url) {
        const frontCoverBuffer = await this.processImageForPrint(
          book.front_cover_image_url,
          this.trimWidth,
          this.trimHeight
        );

        // Place front cover on the right side (accounting for left bleed + back cover)
        const frontCoverX = this.bleed + this.trimWidth;
        const frontCoverY = this.bleed;
        doc.image(frontCoverBuffer, frontCoverX, frontCoverY, {
          width: this.trimWidth,
          height: this.trimHeight,
        });
      }

      // Process and add back cover (positioned with bleed offset)
      if (book.back_cover_image_url) {
        const backCoverBuffer = await this.processImageForPrint(
          book.back_cover_image_url,
          this.trimWidth,
          this.trimHeight
        );

        // Place back cover on the left side (accounting for left bleed)
        const backCoverX = this.bleed;
        const backCoverY = this.bleed;
        doc.image(backCoverBuffer, backCoverX, backCoverY, {
          width: this.trimWidth,
          height: this.trimHeight,
        });
      } else {
        // Create a simple back cover with book title (positioned with bleed offset)
        const backCoverX = this.bleed;
        const backCoverY = this.bleed;
        doc
          .rect(backCoverX, backCoverY, this.trimWidth, this.trimHeight)
          .fill("#ffffff");

        doc
          .fontSize(24)
          .fillColor("#000000")
          .text(
            book.title,
            backCoverX + this.safeMargin,
            backCoverY + this.trimHeight / 2,
            {
              width: this.trimWidth - this.safeMargin * 2,
              align: "center",
            }
          );
      }

      // No spine text needed for saddle stitch binding

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
        size: [this.interiorPdfWidth, this.interiorPdfHeight],
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

        // Fill entire page with white background (including bleed areas)
        doc
          .rect(0, 0, this.interiorPdfWidth, this.interiorPdfHeight)
          .fill("#ffffff");

        // Add page illustration (positioned with bleed offset)
        if (page.illustration_url) {
          const illustrationBuffer = await this.processImageForPrint(
            page.illustration_url,
            this.trimWidth,
            this.trimHeight
          );

          // Position content within trim area (accounting for bleed)
          const contentX = this.bleed;
          const contentY = this.bleed;
          doc.image(illustrationBuffer, contentX, contentY, {
            width: this.trimWidth,
            height: this.trimHeight,
          });
        }

        // Add text overlay if needed (positioned within trim area)
        if (page.text && page.text.trim()) {
          // Create semi-transparent text area (positioned with bleed offset)
          const textAreaHeight = 150;
          const textAreaX = this.bleed + this.safeMargin;
          const textAreaY =
            this.bleed + this.trimHeight - textAreaHeight - this.safeMargin;

          doc
            .rect(
              textAreaX,
              textAreaY,
              this.trimWidth - this.safeMargin * 2,
              textAreaHeight
            )
            .fillOpacity(0.8)
            .fill("#ffffff")
            .fillOpacity(1);

          // Add text (positioned with bleed offset)
          doc
            .fontSize(16)
            .fillColor("#000000")
            .text(page.text, textAreaX + 20, textAreaY + 20, {
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
          density: 72, // 72 DPI
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
