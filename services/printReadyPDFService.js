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

    // Interior PDF dimensions (keep original size): 7.75" x 7.75"
    this.interiorPdfWidth = this.trimWidth + this.bleed * 2; // 558 pixels (7.75")
    this.interiorPdfHeight = this.trimHeight + this.bleed * 2; // 558 pixels (7.75")

    // Cover PDF dimensions (keep original size): 15.25" x 7.75"
    // Cover includes front + back + bleed areas
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
        book_page_number: 1,
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
      // Total cover width (keep original size) = front + back + bleed areas
      // 15.25" = 7.5" (front) + 7.5" (back) + 0.125" (left bleed) + 0.125" (right bleed)
      const coverPdfWidth = this.trimWidth * 2 + this.bleed * 2; // 1098 pixels (15.25" at 72 DPI)
      const coverPdfHeight = this.coverPdfHeight; // 558 pixels (7.75" at 72 DPI)

      const doc = new PDFDocument({
        size: [coverPdfWidth, coverPdfHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const stream = fs.createWriteStream(coverPdfPath);
      doc.pipe(stream);

      // Fill entire PDF with white background
      doc.rect(0, 0, coverPdfWidth, coverPdfHeight).fill("#ffffff");

      // Process and add front cover (fill right half of PDF)
      if (book.front_cover_image_url) {
        const frontCoverBuffer = await this.processImageForPrint(
          book.front_cover_image_url,
          coverPdfWidth / 2,
          coverPdfHeight
        );

        // Place front cover on the right side (fill entire right half)
        const frontCoverX = coverPdfWidth / 2;
        const frontCoverY = 0;
        doc.image(frontCoverBuffer, frontCoverX, frontCoverY, {
          width: coverPdfWidth / 2,
          height: coverPdfHeight,
        });
      }

      // Process and add back cover (fill left half of PDF)
      if (book.back_cover_image_url) {
        const backCoverBuffer = await this.processImageForPrint(
          book.back_cover_image_url,
          coverPdfWidth / 2,
          coverPdfHeight
        );

        // Place back cover on the left side (fill entire left half)
        const backCoverX = 0;
        const backCoverY = 0;
        doc.image(backCoverBuffer, backCoverX, backCoverY, {
          width: coverPdfWidth / 2,
          height: coverPdfHeight,
        });
      } else {
        // Create a simple back cover with book title (fill entire left half)
        const backCoverX = 0;
        const backCoverY = 0;
        doc
          .rect(backCoverX, backCoverY, coverPdfWidth / 2, coverPdfHeight)
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

      // Group pages by story_page_number to combine text and illustration pages
      const pageGroups = {};
      pages.forEach((page) => {
        const storyPageNum = page.story_page_number;
        if (!pageGroups[storyPageNum]) {
          pageGroups[storyPageNum] = {};
        }

        if (page.page_type === "illustration") {
          pageGroups[storyPageNum].illustration = page;
        } else if (page.page_type === "text") {
          pageGroups[storyPageNum].text = page;
        }
      });

      logger.info("Print PDF: Page grouping completed", {
        totalPages: pages.length,
        storyPages: Object.keys(pageGroups).length,
        pageGroups: Object.keys(pageGroups).map((storyPageNum) => ({
          storyPageNum,
          hasIllustration: !!pageGroups[storyPageNum].illustration,
          hasText: !!pageGroups[storyPageNum].text,
          textContent:
            pageGroups[storyPageNum].text?.text_content?.substring(0, 50) +
            "...",
        })),
      });

      // Sort story page numbers and create separate illustration and text pages
      const sortedStoryPages = Object.keys(pageGroups).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );

      let isFirstPage = true;

      for (let i = 0; i < sortedStoryPages.length; i++) {
        const storyPageNum = sortedStoryPages[i];
        const pageGroup = pageGroups[storyPageNum];

        // Add illustration page (if exists)
        if (pageGroup.illustration && pageGroup.illustration.illustration_url) {
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Fill entire page with white background
          doc
            .rect(0, 0, this.interiorPdfWidth, this.interiorPdfHeight)
            .fill("#ffffff");

          const illustrationBuffer = await this.processImageForPrint(
            pageGroup.illustration.illustration_url,
            this.interiorPdfWidth,
            this.interiorPdfHeight
          );

          // Position illustration to fill entire PDF page
          doc.image(illustrationBuffer, 0, 0, {
            width: this.interiorPdfWidth,
            height: this.interiorPdfHeight,
          });
        }

        // Add text page (if exists)
        if (
          pageGroup.text &&
          pageGroup.text.text_content &&
          pageGroup.text.text_content.trim()
        ) {
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Fill entire page with white background
          doc
            .rect(0, 0, this.interiorPdfWidth, this.interiorPdfHeight)
            .fill("#ffffff");

          // Add text with margins (similar to preview PDF)
          const textMargin = 50;
          const textAreaX = textMargin;
          const textAreaY = 150;
          const textAreaWidth = this.interiorPdfWidth - textMargin * 2;

          doc
            .fontSize(16)
            .fillColor("#333333")
            .text(pageGroup.text.text_content, textAreaX, textAreaY, {
              width: textAreaWidth,
              align: "center",
              lineGap: 10,
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
