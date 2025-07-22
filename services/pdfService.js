const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const os = require("os");
const mongoose = require("mongoose");
const Book = require("../models/Book");
const Page = require("../models/Page");
const s3Service = require("./s3Service");
const logger = require("../utils/logger");

/**
 * Get the appropriate temp directory based on the operating system
 * @returns {string} - Temp directory path
 */
const getTempDir = () => {
  return os.platform() === "win32" ? "./temp" : "/tmp";
};

class ChildrenBookPDF {
  constructor() {
    this.doc = new PDFDocument({
      size: [540, 540],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    this.pageWidth = this.doc.page.width;
    this.pageHeight = this.doc.page.height;
    this.storyPageNumber = 1; // For story page numbering (starts from first story page)

    // Register Patrick Hand font
    this.registerPatrickHandFont();
  }

  // Register Patrick Hand font
  registerPatrickHandFont() {
    try {
      const fontPath = path.join(
        __dirname,
        "..",
        "assets",
        "fonts",
        "PatrickHand-Regular.ttf"
      );
      if (fs.existsSync(fontPath)) {
        this.doc.registerFont("PatrickHand", fontPath);
        logger.info("Patrick Hand font registered successfully");
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

  // Create the children's book from JSON data
  async createBook(bookData, outputPath) {
    // Create the file stream
    const fileStream = fs.createWriteStream(outputPath);

    // Pipe the PDF to a file
    this.doc.pipe(fileStream);

    // Page 1: Front cover
    this.addFrontCoverPage(bookData.title, bookData.frontCoverImages[0]);

    // Page 2: Blank page
    this.addBlankPage();

    // Page 3: Dedication page
    this.addDedicationPage(bookData.dedication);

    // Story pages: Alternating illustration and text pages
    for (let i = 0; i < bookData.pages.length; i++) {
      const pageData = bookData.pages[i];

      // Add illustration page (with story page number)
      if (pageData.images && pageData.images.length > 0) {
        this.addIllustrationPage(pageData.images[0], true); // true = add page number
      }

      // Add text page (with story page number)
      if (pageData.text && pageData.text.trim() !== "") {
        this.addTextPage(pageData.text, true); // true = add page number
      }
    }

    // Last page: Back cover
    this.addBackCoverPage(
      bookData.moralOfBackCover,
      bookData.backCoverImages[0]
    );

    // Finalize the PDF
    this.doc.end();

    return new Promise((resolve, reject) => {
      // Wait for both the PDF document to finish AND the file stream to finish
      let pdfEnded = false;
      let fileStreamFinished = false;

      const checkCompletion = () => {
        if (pdfEnded && fileStreamFinished) {
          logger.info(`Children's book PDF created: ${outputPath}`);
          resolve(outputPath);
        }
      };

      this.doc.on("end", () => {
        pdfEnded = true;
        checkCompletion();
      });

      fileStream.on("finish", () => {
        fileStreamFinished = true;
        checkCompletion();
      });

      this.doc.on("error", reject);
      fileStream.on("error", reject);
    });
  }

  // Add full-page illustration (1:1 aspect ratio)
  addIllustrationPage(imagePath, addPageNumber = false) {
    try {
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        logger.warn(`Image not found: ${imagePath}, creating placeholder`);
        this.addImagePlaceholder();
        if (addPageNumber) {
          this.addStoryPageNumber();
        }
        this.doc.addPage();
        return;
      }

      // Get image info
      const imageInfo = this.doc.openImage(imagePath);

      // Calculate dimensions to fill page while maintaining 1:1 aspect ratio
      const targetAspectRatio = 1 / 1;
      const pageAspectRatio = this.pageWidth / this.pageHeight;

      let imageWidth, imageHeight, x, y;

      if (pageAspectRatio > targetAspectRatio) {
        // Page is wider than 1:1, fit to height
        imageHeight = this.pageHeight;
        imageWidth = imageHeight * targetAspectRatio;
        x = (this.pageWidth - imageWidth) / 2;
        y = 0;
      } else {
        // Page is taller than 1:1, fit to width
        imageWidth = this.pageWidth;
        imageHeight = imageWidth / targetAspectRatio;
        x = 0;
        y = (this.pageHeight - imageHeight) / 2;
      }

      // Add the image
      this.doc.image(imagePath, x, y, {
        width: imageWidth,
        height: imageHeight,
      });
    } catch (error) {
      logger.error(`Error adding image ${imagePath}:`, error.message);
      this.addImagePlaceholder();
    }

    // Add page number if requested
    if (addPageNumber) {
      this.addStoryPageNumber();
    }
    this.doc.addPage();
  }

  // Add placeholder when image is not available
  addImagePlaceholder() {
    // Calculate 1:1 rectangle centered on page
    const targetAspectRatio = 1 / 1;
    const pageAspectRatio = this.pageWidth / this.pageHeight;

    let rectWidth, rectHeight, x, y;

    if (pageAspectRatio > targetAspectRatio) {
      rectHeight = this.pageHeight;
      rectWidth = rectHeight * targetAspectRatio;
      x = (this.pageWidth - rectWidth) / 2;
      y = 0;
    } else {
      rectWidth = this.pageWidth;
      rectHeight = rectWidth / targetAspectRatio;
      x = 0;
      y = (this.pageHeight - rectHeight) / 2;
    }

    // Draw placeholder rectangle
    this.doc
      .rect(x, y, rectWidth, rectHeight)
      .fillColor("#f0f0f0")
      .fill()
      .rect(x, y, rectWidth, rectHeight)
      .stroke("#ccc");

    // Add placeholder text
    this.doc
      .fontSize(24)
      .font(this.getFont())
      .fillColor("#999")
      .text("Image Not Found", x, y + rectHeight / 2 - 12, {
        width: rectWidth,
        align: "center",
      });
  }

  // Add text page with center alignment
  addTextPage(text, addPageNumber = false) {
    // Add main text with center alignment
    this.doc
      .fontSize(16)
      .font(this.getFont())
      .fillColor("#333")
      .text(text, 50, 150, {
        width: this.pageWidth - 100,
        align: "center",
        lineGap: 10,
      });

    // Add page number if requested
    if (addPageNumber) {
      this.addStoryPageNumber();
    }
    this.doc.addPage();
  }

  // Add front cover page
  addFrontCoverPage(title, imagePath) {
    try {
      // Add background image (front cover image already includes the title)
      if (fs.existsSync(imagePath)) {
        this.doc.image(imagePath, 0, 0, {
          width: this.pageWidth,
          height: this.pageHeight,
        });
      } else {
        // Fallback: simple text on white background when image is not available
        this.doc
          .rect(0, 0, this.pageWidth, this.pageHeight)
          .fillColor("#f0f0f0")
          .fill();

        this.doc
          .fontSize(24)
          .font(this.getFont("bold"))
          .fillColor("#333")
          .text(title, 50, this.pageHeight / 2, {
            width: this.pageWidth - 100,
            align: "center",
          });
      }
    } catch (error) {
      logger.error(`Error adding front cover:`, error.message);
      // Fallback: simple text on white background
      this.doc
        .fontSize(24)
        .font(this.getFont("bold"))
        .fillColor("#333")
        .text(title, 50, this.pageHeight / 2, {
          width: this.pageWidth - 100,
          align: "center",
        });
    }

    this.doc.addPage();
  }

  // Add copyright page with logo and text
  addBlankPage() {
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
        const groupStartY = (this.pageHeight - totalContentHeight) / 2;
        const logoY = groupStartY;

        // Position logo horizontally centered
        const logoX = (this.pageWidth - logoMaxWidth) / 2;

        // Add the logo
        this.doc.image(logoPath, logoX, logoY, {
          fit: [logoMaxWidth, logoMaxHeight],
          align: "center",
        });

        // Add copyright text below the logo
        const textStartY = logoY + logoMaxHeight + gapBetweenLogoAndText;
        const copyrightText = `Published by Pet Tales
© 2025
Written with love by our AI friend, M-AI
Printed with pawsitivity in the UK`;

        this.doc
          .fontSize(14)
          .font(this.getFont())
          .fillColor("#0f5636")
          .text(copyrightText, 50, textStartY, {
            width: this.pageWidth - 100,
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

        this.doc
          .fontSize(14)
          .font(this.getFont())
          .fillColor("#0f5636")
          .text(copyrightText, 50, this.pageHeight / 2 - 40, {
            width: this.pageWidth - 100,
            align: "center",
            lineGap: 8,
          });
      }
    } catch (error) {
      logger.error(`Error adding copyright page:`, error.message);

      // Fallback: Add only copyright text if there's an error with the logo
      const copyrightText = `Published by Pet Tales
© 2025
Written with love by our AI friend, M-AI
Printed with pawsitivity in the UK`;

      this.doc
        .fontSize(14)
        .font(this.getFont())
        .fillColor("#0f5636")
        .text(copyrightText, 50, this.pageHeight / 2 - 40, {
          width: this.pageWidth - 100,
          align: "center",
          lineGap: 8,
        });
    }

    this.doc.addPage();
  }

  // Add dedication page
  addDedicationPage(dedication) {
    if (dedication && dedication.trim()) {
      this.doc
        .fontSize(18)
        .font(this.getFont("italic"))
        .fillColor("#333")
        .text(dedication, 50, this.pageHeight / 2 - 50, {
          width: this.pageWidth - 100,
          align: "center",
          lineGap: 8,
        });
    }
    this.doc.addPage();
  }

  // Add back cover page
  addBackCoverPage(moral, imagePath) {
    try {
      // Add background image
      if (fs.existsSync(imagePath)) {
        this.doc.image(imagePath, 0, 0, {
          width: this.pageWidth,
          height: this.pageHeight,
        });
      } else {
        // Fallback background color
        this.doc
          .rect(0, 0, this.pageWidth, this.pageHeight)
          .fillColor("#f0f0f0")
          .fill();
      }

      // Add moral text with transparent background
      if (moral && moral.trim()) {
        const moralY = this.pageHeight / 2 - 30;

        // Add moral text directly without background - white text, larger size, more padding
        this.doc
          .fontSize(20)
          .font(this.getFont())
          .fillColor("#ffffff")
          .text(moral, 80, moralY, {
            width: this.pageWidth - 160,
            align: "center",
            lineGap: 10,
          });
      }
    } catch (error) {
      logger.error(`Error adding back cover:`, error.message);
      // Fallback: simple text on white background
      if (moral && moral.trim()) {
        this.doc
          .fontSize(20)
          .font(this.getFont())
          .fillColor("#333")
          .text(moral, 80, this.pageHeight / 2, {
            width: this.pageWidth - 160,
            align: "center",
          });
      }
    }
    // Note: No addPage() call here as this is the last page
  }

  // Add story page number at bottom center
  addStoryPageNumber() {
    this.doc
      .fontSize(12)
      .font(this.getFont())
      .fillColor("#666")
      .text(`- ${this.storyPageNumber} -`, 0, this.pageHeight - 30, {
        width: this.pageWidth,
        align: "center",
      });

    this.storyPageNumber++;
  }
}

class PDFRegenerationService {
  constructor() {
    this.tempFilesToCleanup = [];
  }

  /**
   * Regenerate PDF for a book with current content
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} - New PDF URL
   */
  async regeneratePDF(bookId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      // Get book and verify ownership
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      if (book.user_id.toString() !== userId) {
        throw new Error("Access denied");
      }

      if (book.generation_status !== "completed") {
        throw new Error("Book generation not completed");
      }

      logger.info(`Regenerating PDF for book ${bookId} by user ${userId}`);

      // Get current book content
      const bookData = await this.getCurrentBookContent(bookId);

      // Download images to temporary files
      await this.downloadImagesToTemp(bookData);

      // Generate PDF
      const tempDir = getTempDir();
      const pdfPath = path.join(tempDir, `book_${bookId}_${Date.now()}.pdf`);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const pdfGenerator = new ChildrenBookPDF();
      await pdfGenerator.createBook(bookData, pdfPath);
      this.tempFilesToCleanup.push(pdfPath);

      // Delete legacy PDF if it exists
      if (book.pdf_url) {
        try {
          const oldPdfS3Key = s3Service.extractS3KeyFromCloudFrontUrl(
            book.pdf_url
          );
          await s3Service.deleteFile(oldPdfS3Key);
          logger.info(`Deleted legacy PDF: ${oldPdfS3Key}`);
        } catch (error) {
          logger.warn(`Failed to delete legacy PDF: ${error.message}`);
          // Continue with regeneration even if legacy cleanup fails
        }
      }

      // Upload new PDF to S3
      const pdfS3Key = s3Service.generateBookPdfS3Key(userId, bookId);
      const newPdfUrl = await s3Service.uploadLocalFile(
        pdfPath,
        pdfS3Key,
        "application/pdf"
      );

      // Update book with new PDF URL and reset regeneration flag
      await Book.findByIdAndUpdate(bookId, {
        pdf_url: newPdfUrl,
        pdf_needs_regeneration: false,
      });

      // Cleanup temporary files
      await this.cleanupTempFiles();

      logger.info(`PDF regenerated successfully for book ${bookId}`);
      return newPdfUrl;
    } catch (error) {
      logger.error(`PDF regeneration failed for book ${bookId}:`, error);
      await this.cleanupTempFiles();
      throw error;
    }
  }

  /**
   * Get current book content from database
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} - Book data formatted for PDF generation
   */
  async getCurrentBookContent(bookId) {
    // Get book data
    const book = await Book.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Get pages data
    const pages = await Page.find({ book_id: bookId }).sort({
      story_page_number: 1,
    });

    // Group pages by story page number
    const groupedPages = {};
    pages.forEach((page) => {
      const storyPageNum = page.story_page_number;
      if (!groupedPages[storyPageNum]) {
        groupedPages[storyPageNum] = {};
      }

      if (page.page_type === "text") {
        groupedPages[storyPageNum].text = page.text_content;
      } else if (page.page_type === "illustration") {
        groupedPages[storyPageNum].images = [page.illustration_url];
      }
    });

    // Convert grouped pages to array format expected by PDF generator
    const pagesArray = [];
    const sortedPageNumbers = Object.keys(groupedPages).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    for (const pageNum of sortedPageNumbers) {
      const pageData = groupedPages[pageNum];
      pagesArray.push({
        text: pageData.text || "",
        images: pageData.images || [],
      });
    }

    // Format data for PDF generation
    return {
      title: book.title,
      dedication: book.dedication,
      moralOfBackCover: book.moral_of_back_cover,
      frontCoverImages: [book.front_cover_image_url],
      backCoverImages: [book.back_cover_image_url],
      pages: pagesArray,
    };
  }

  /**
   * Download images from URLs to temporary files
   * @param {Object} bookData - Book data with image URLs
   */
  async downloadImagesToTemp(bookData) {
    const https = require("https");
    const http = require("http");

    // Download front cover
    if (bookData.frontCoverImages[0]) {
      const frontCoverPath = await this.downloadImageToTemp(
        bookData.frontCoverImages[0],
        "front_cover"
      );
      bookData.frontCoverImages[0] = frontCoverPath;
    }

    // Download back cover
    if (bookData.backCoverImages[0]) {
      const backCoverPath = await this.downloadImageToTemp(
        bookData.backCoverImages[0],
        "back_cover"
      );
      bookData.backCoverImages[0] = backCoverPath;
    }

    // Download page images
    for (let i = 0; i < bookData.pages.length; i++) {
      const page = bookData.pages[i];
      if (page.images && page.images[0]) {
        const imagePath = await this.downloadImageToTemp(
          page.images[0],
          `page_${i}`
        );
        page.images[0] = imagePath;
      }
    }
  }

  /**
   * Download a single image to temporary file
   * @param {string} imageUrl - Image URL
   * @param {string} prefix - File prefix
   * @returns {Promise<string>} - Local file path
   */
  async downloadImageToTemp(imageUrl, prefix) {
    return new Promise((resolve, reject) => {
      const tempDir = getTempDir();
      const tempFileName = `${prefix}_${Date.now()}.jpg`;
      const tempFilePath = path.join(tempDir, tempFileName);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const file = fs.createWriteStream(tempFilePath);
      this.tempFilesToCleanup.push(tempFilePath);

      const protocol = imageUrl.startsWith("https:")
        ? require("https")
        : require("http");

      protocol
        .get(imageUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download image: ${response.statusCode}`)
            );
            return;
          }

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve(tempFilePath);
          });

          file.on("error", (err) => {
            fs.unlink(tempFilePath, () => {}); // Delete the file on error
            reject(err);
          });
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles() {
    for (const filePath of this.tempFilesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up temp file: ${filePath}`);
        }
      } catch (error) {
        logger.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
      }
    }
    this.tempFilesToCleanup = [];
  }

  /**
   * Check if book content has changed since PDF was generated
   * @param {string} bookId - Book ID
   * @returns {Promise<boolean>} - True if content has changed
   */
  async hasContentChanged(bookId) {
    try {
      const book = await Book.findById(bookId);
      if (!book || !book.pdf_url) {
        return true; // No PDF exists, so regeneration is needed
      }

      // Use the flag-based system for accurate change detection
      return book.pdf_needs_regeneration || false;
    } catch (error) {
      logger.error(`Error checking content changes for book ${bookId}:`, error);
      return true; // Assume changes if we can't determine
    }
  }

  /**
   * Get detailed change information for debugging
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} - Change details
   */
  async getChangeDetails(bookId) {
    try {
      const book = await Book.findById(bookId);
      if (!book) {
        return { error: "Book not found" };
      }

      const latestPageUpdate = await Page.findOne({ book_id: bookId })
        .sort({ updated_at: -1 })
        .select("updated_at page_type");

      return {
        bookId,
        hasPdf: !!book.pdf_url,
        bookUpdatedAt: book.updated_at,
        latestPageUpdate: latestPageUpdate
          ? {
              updatedAt: latestPageUpdate.updated_at,
              pageType: latestPageUpdate.page_type,
            }
          : null,
        hasContentChanged: await this.hasContentChanged(bookId),
      };
    } catch (error) {
      logger.error(`Error getting change details for book ${bookId}:`, error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
const pdfRegenerationService = new PDFRegenerationService();

module.exports = {
  ChildrenBookPDF,
  PDFRegenerationService,
  pdfRegenerationService,
};
