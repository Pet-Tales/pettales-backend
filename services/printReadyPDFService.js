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

  // Register Patrick Hand font for a PDF document
  registerPatrickHandFont(doc) {
    try {
      const fontPath = path.join(
        __dirname,
        "..",
        "assets",
        "fonts",
        "PatrickHand-Regular.ttf"
      );
      if (fs.existsSync(fontPath)) {
        doc.registerFont("PatrickHand", fontPath);
        logger.info(
          "Patrick Hand font registered successfully for print-ready PDF"
        );
      } else {
        logger.warn(
          `Patrick Hand font not found at: ${fontPath}, falling back to Helvetica`
        );
      }
    } catch (error) {
      logger.error("Error registering Patrick Hand font:", error.message);
    }
  }

  // Get the appropriate font name (Patrick Hand if available, otherwise Helvetica)
  getFont(style = "regular") {
    const fontPath = path.join(
      __dirname,
      "..",
      "assets",
      "fonts",
      "PatrickHand-Regular.ttf"
    );
    if (fs.existsSync(fontPath)) {
      return "PatrickHand"; // Patrick Hand doesn't have separate bold/italic variants
    }

    // Fallback to Helvetica variants
    switch (style) {
      case "bold":
        return "Helvetica-Bold";
      case "italic":
        return "Helvetica-Oblique";
      default:
        return "Helvetica";
    }
  }

  /**
   * Generate print-ready PDFs for a book
   */
  async generatePrintReadyPDFs(bookId, userId, orderId) {
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

      // Generate S3 keys with new path pattern
      const timestamp = Date.now();
      const coverS3Key = `${userId}/orders/${orderId}/${bookId}_${timestamp}-cover.pdf`;
      const interiorS3Key = `${userId}/orders/${orderId}/${bookId}_${timestamp}-interior.pdf`;

      // Upload PDFs to S3
      const coverPdfUrl = await this.uploadPDFToS3(coverPdfPath, coverS3Key);
      const interiorPdfUrl = await this.uploadPDFToS3(interiorPdfPath, interiorS3Key);

      // Clean up local files
      fs.unlinkSync(coverPdfPath);
      fs.unlinkSync(interiorPdfPath);

      logger.info("Print-ready PDFs generated successfully", {
        bookId,
        userId,
        orderId,
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

      // Register Patrick Hand font
      this.registerPatrickHandFont(doc);

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

        // Add moral text overlay on back cover if available
        if (book.moral_of_back_cover && book.moral_of_back_cover.trim()) {
          const textAreaX = backCoverX + this.safeMargin;
          const textAreaY = backCoverY + this.trimHeight / 2 - 50;
          const textAreaWidth = this.trimWidth - this.safeMargin * 2;

          doc
            .fontSize(16)
            .font(this.getFont())
            .fillColor("#ffffff")
            .text(book.moral_of_back_cover, textAreaX, textAreaY, {
              width: textAreaWidth,
              align: "center",
              lineGap: 8,
            });
        }
      } else {
        // Create a simple back cover with book title and moral (fill entire left half)
        const backCoverX = 0;
        const backCoverY = 0;
        doc
          .rect(backCoverX, backCoverY, coverPdfWidth / 2, coverPdfHeight)
          .fill("#ffffff");

        // Add book title
        doc
          .fontSize(24)
          .font(this.getFont("bold"))
          .fillColor("#000000")
          .text(
            book.title,
            backCoverX + this.safeMargin,
            backCoverY + this.trimHeight / 3,
            {
              width: this.trimWidth - this.safeMargin * 2,
              align: "center",
            }
          );

        // Add moral text if available
        if (book.moral_of_back_cover && book.moral_of_back_cover.trim()) {
          doc
            .fontSize(16)
            .font(this.getFont())
            .fillColor("#333333")
            .text(
              book.moral_of_back_cover,
              backCoverX + this.safeMargin,
              backCoverY + (this.trimHeight * 2) / 3,
              {
                width: this.trimWidth - this.safeMargin * 2,
                align: "center",
                lineGap: 8,
              }
            );
        }
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

      // Register Patrick Hand font
      this.registerPatrickHandFont(doc);

      const stream = fs.createWriteStream(interiorPdfPath);
      doc.pipe(stream);

      let isFirstPage = true;

      // Always add dedication page as the first page (blank if no dedication)
      logger.info("Print PDF: Adding dedication page", {
        bookId: book._id,
        hasDedication: !!book.dedication,
        dedicationValue: book.dedication,
        dedicationLength: book.dedication ? book.dedication.length : 0,
        dedicationTrimmed: book.dedication ? book.dedication.trim() : null,
        dedicationTrimmedLength: book.dedication && book.dedication.trim() ? book.dedication.trim().length : 0,
      });

      // Fill entire page with white background
      doc
        .rect(0, 0, this.interiorPdfWidth, this.interiorPdfHeight)
        .fill("#ffffff");

      // Add dedication text if it exists, otherwise leave page blank
      if (book.dedication && book.dedication.trim()) {
        logger.info("Print PDF: Adding dedication text to page", {
          dedicationText: book.dedication.trim(),
        });

        const textMargin = 50;
        const textAreaX = textMargin;
        const textAreaY = this.interiorPdfHeight / 2 - 50;
        const textAreaWidth = this.interiorPdfWidth - textMargin * 2;

        doc
          .fontSize(18)
          .font(this.getFont("italic"))
          .fillColor("#333333")
          .text(book.dedication, textAreaX, textAreaY, {
            width: textAreaWidth,
            align: "center",
            lineGap: 8,
          });

        logger.info("Print PDF: Dedication text added successfully");
      } else {
        logger.info("Print PDF: Dedication page left blank (no dedication text)", {
          dedicationIsNull: book.dedication === null,
          dedicationIsUndefined: book.dedication === undefined,
          dedicationIsEmpty: book.dedication === "",
          dedicationAfterTrim: book.dedication ? book.dedication.trim() : "N/A",
        });
      }

      isFirstPage = false;

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
            .font(this.getFont())
            .fillColor("#333333")
            .text(pageGroup.text.text_content, textAreaX, textAreaY, {
              width: textAreaWidth,
              align: "center",
              lineGap: 10,
            });
        }
      }

      // Add logo page at the end
      doc.addPage();
      this.addLogoPage(doc);

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
   * Add logo page with copyright information
   */
  addLogoPage(doc) {
    // Fill entire page with white background
    doc
      .rect(0, 0, this.interiorPdfWidth, this.interiorPdfHeight)
      .fill("#ffffff");

    const logoPath = path.join(__dirname, "..", "assets", "logo.png");

    try {
      // Check if logo file exists
      if (fs.existsSync(logoPath)) {
        // Calculate logo dimensions and position
        const logoMaxWidth = 350; // Maximum logo width
        const logoMaxHeight = 250; // Maximum logo height

        // Calculate total height of logo + gap + text to center the group vertically
        const textHeight = 80; // Approximate height for 4 lines of text with line gaps
        const gapBetweenLogoAndText = 40;
        const totalContentHeight =
          logoMaxHeight + gapBetweenLogoAndText + textHeight;

        // Center the entire group vertically
        const groupStartY = (this.interiorPdfHeight - totalContentHeight) / 2;
        const logoY = groupStartY;

        // Position logo horizontally centered
        const logoX = (this.interiorPdfWidth - logoMaxWidth) / 2;

        // Add the logo
        doc.image(logoPath, logoX, logoY, {
          fit: [logoMaxWidth, logoMaxHeight],
          align: "center",
        });

        // Add copyright text below the logo
        const textStartY = logoY + logoMaxHeight + gapBetweenLogoAndText;
        const copyrightText = `Published by Pet Tales
© 2025
Written with love by our AI friend, M-AI
Printed with pawsitivity in the UK`;

        doc
          .fontSize(14)
          .font(this.getFont())
          .fillColor("#0f5636")
          .text(copyrightText, 50, textStartY, {
            width: this.interiorPdfWidth - 100,
            align: "center",
            lineGap: 8,
          });
      } else {
        logger.warn(`Logo not found at: ${logoPath}, adding text only`);

        // Fallback: Add only copyright text if logo is missing
        const copyrightText = `Published by Pet Tales
© 2025
Written with love by our AI friend, M-AI
Printed with pawsitivity in the UK`;

        doc
          .fontSize(14)
          .font(this.getFont())
          .fillColor("#0f5636")
          .text(copyrightText, 50, this.interiorPdfHeight / 2 - 40, {
            width: this.interiorPdfWidth - 100,
            align: "center",
            lineGap: 8,
          });
      }
    } catch (error) {
      logger.error(`Error adding logo page:`, error.message);

      // Fallback: Add only copyright text if there's an error with the logo
      const copyrightText = `Published by Pet Tales
© 2025
Written with love by our AI friend, M-AI
Printed with pawsitivity in the UK`;

      doc
        .fontSize(14)
        .font(this.getFont())
        .fillColor("#0f5636")
        .text(copyrightText, 50, this.interiorPdfHeight / 2 - 40, {
          width: this.interiorPdfWidth - 100,
          align: "center",
          lineGap: 8,
        });
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
