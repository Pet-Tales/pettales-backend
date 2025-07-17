const fs = require("fs");
const path = require("path");
const os = require("os");
const Replicate = require("replicate");
const s3Service = require("./s3Service");
const { Book, Page } = require("../models");
const logger = require("../utils/logger");
const {
  ILLUST_ANIME,
  ILLUST_DISNEY,
  ILLUST_VECTOR_ART,
  ILLUST_CLASSIC_WATERCOLOR,
} = require("../utils/constants");

/**
 * Get the appropriate temp directory based on the operating system
 * @returns {string} - Temp directory path
 */
const getTempDir = () => {
  return os.platform() === "win32" ? "./temp" : "/tmp";
};

class IllustrationService {
  constructor() {
    this.replicate = new Replicate();
    this.tempFilesToCleanup = [];
  }

  /**
   * Generate illustration using Replicate and save to local file
   * @param {string} prompt - Text prompt for illustration
   * @param {Array} inputImages - Array of character reference image URLs
   * @param {number} seed - Random seed for generation
   * @param {string} localImagePath - Local file path to save image
   * @returns {Promise<string>} - Local image path
   */
  async generateIllustration(prompt, inputImages, seed, localImagePath) {
    const input = {
      prompt,
      aspect_ratio: "4:3",
      seed,
      input_images: inputImages,
      output_format: "jpg",
    };

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          `Generating illustration (attempt ${attempt}/${maxRetries}) with prompt: ${prompt.substring(
            0,
            100
          )}...`
        );

        const output = await this.replicate.run(
          "flux-kontext-apps/multi-image-list",
          {
            input,
          }
        );

        // Save the output directly to local file
        await fs.promises.writeFile(localImagePath, output);
        logger.info(
          `Image saved to local file: ${localImagePath} on attempt ${attempt}`
        );

        return localImagePath;
      } catch (error) {
        lastError = error;
        logger.error(
          `Illustration generation failed on attempt ${attempt}:`,
          error.message
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 10000; // Exponential backoff: 1s, 2s, 4s
          logger.info(`Retrying illustration generation in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`Illustration generation failed after ${maxRetries} attempts`);
    throw new Error(
      `Failed to generate illustration after ${maxRetries} attempts: ${lastError.message}`
    );
  }

  /**
   * Extract input images from characters
   * @param {Array} characters - Array of character objects
   * @returns {Array} - Array of character reference image URLs
   */
  extractInputImages(characters) {
    return characters
      .map((character) => character.reference_image_url)
      .filter((url) => !!url);
  }

  /**
   * Generate random seed for illustration
   * @returns {number} - Random seed
   */
  generateRandomSeed() {
    return Math.floor(Math.random() * 4294967295);
  }

  /**
   * Generate seed for regeneration based on original book seed
   * @param {number} originalSeed - Original book generation seed
   * @param {number} alternativesLength - Current number of alternatives
   * @returns {number} - New seed for regeneration
   */
  generateRegenerationSeed(originalSeed, alternativesLength) {
    return originalSeed + alternativesLength;
  }

  /**
   * Regenerate front cover illustration
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} - New illustration URL
   */
  async regenerateFrontCover(bookId, userId) {
    try {
      logger.info(`Regenerating front cover for book: ${bookId}`);

      // Fetch book with characters
      const book = await Book.findById(bookId).populate("character_ids");
      if (!book) {
        throw new Error("Book not found");
      }

      // Check ownership
      if (book.user_id.toString() !== userId) {
        throw new Error("Access denied");
      }

      // Extract character reference images
      let inputImages = this.extractInputImages(book.character_ids);

      if (book.illustration_style === "anime") {
        inputImages.push(ILLUST_ANIME);
      } else if (book.illustration_style === "disney") {
        inputImages.push(ILLUST_DISNEY);
      } else if (book.illustration_style === "vector_art") {
        inputImages.push(ILLUST_VECTOR_ART);
      } else if (book.illustration_style === "classic_watercolor") {
        inputImages.push(ILLUST_CLASSIC_WATERCOLOR);
      }

      // Use the original front cover prompt from the database if available
      let prompt = book.front_cover_prompt;

      // Fallback to generic prompt if no stored prompt exists (for older books)
      if (!prompt) {
        prompt = `A beautiful children's book front cover illustration featuring the characters from the story "${book.title}". ${book.description}. Art style: ${book.illustration_style}. Colorful, engaging, and suitable for children.`;
        logger.warn(
          `No stored front cover prompt found for book ${bookId}, using fallback prompt`
        );
      }

      // Generate new illustration using book's original seed + current alternatives length
      let seed;
      if (book.generation_seed) {
        // Use original seed + current alternatives length for consistency
        seed = this.generateRegenerationSeed(
          book.generation_seed,
          book.alternative_front_covers.length
        );
      } else {
        // Backward compatibility: generate random seed for books without stored seed
        seed = this.generateRandomSeed();
        // Store the generated seed for future regenerations
        await Book.findByIdAndUpdate(bookId, { generation_seed: seed });
      }

      const tempFileName = `front_cover_regen_${bookId}_${Date.now()}.jpg`;
      const tempDir = getTempDir();
      const tempFilePath = path.join(tempDir, tempFileName);

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate image and save to local file
      const localImagePath = await this.generateIllustration(
        prompt,
        inputImages,
        seed,
        tempFilePath
      );

      // Upload to S3
      const alternativeNumber = Date.now(); // Use timestamp as unique identifier
      const s3Key = s3Service.generateFrontCoverS3Key(
        userId,
        bookId,
        alternativeNumber,
        "jpg"
      );

      // Upload local file to S3
      const cloudFrontUrl = await s3Service.uploadLocalFile(
        localImagePath,
        s3Key,
        "image/jpeg"
      );

      // Add to alternatives array and set PDF regeneration flag
      await Book.findByIdAndUpdate(bookId, {
        $push: { alternative_front_covers: cloudFrontUrl },
        pdf_needs_regeneration: true,
      });

      // Track temp file for cleanup
      this.tempFilesToCleanup.push(localImagePath);

      logger.info(`Successfully regenerated front cover: ${cloudFrontUrl}`);
      logger.info(
        `PDF regeneration flag set for book ${bookId} due to front cover regeneration`
      );
      return cloudFrontUrl;
    } catch (error) {
      logger.error(
        `Failed to regenerate front cover for book ${bookId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Regenerate back cover illustration
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} - New illustration URL
   */
  async regenerateBackCover(bookId, userId) {
    try {
      logger.info(`Regenerating back cover for book: ${bookId}`);

      // Fetch book with characters
      const book = await Book.findById(bookId).populate("character_ids");
      if (!book) {
        throw new Error("Book not found");
      }

      // Check ownership
      if (book.user_id.toString() !== userId) {
        throw new Error("Access denied");
      }

      // Extract character reference images
      let inputImages = this.extractInputImages(book.character_ids);

      if (book.illustration_style === "anime") {
        inputImages.push(ILLUST_ANIME);
      } else if (book.illustration_style === "disney") {
        inputImages.push(ILLUST_DISNEY);
      } else if (book.illustration_style === "vector_art") {
        inputImages.push(ILLUST_VECTOR_ART);
      } else if (book.illustration_style === "classic_watercolor") {
        inputImages.push(ILLUST_CLASSIC_WATERCOLOR);
      }

      // Use the original back cover prompt from the database if available
      let prompt = book.back_cover_prompt;

      // Fallback to generic prompt if no stored prompt exists (for older books)
      if (!prompt) {
        prompt = `A beautiful children's book back cover illustration. ${
          book.moral_of_back_cover || book.moral
        }. Art style: ${
          book.illustration_style
        }. Colorful, engaging, and suitable for children.`;
        logger.warn(
          `No stored back cover prompt found for book ${bookId}, using fallback prompt`
        );
      }

      // Generate new illustration using book's original seed + current alternatives length
      let seed;
      if (book.generation_seed) {
        // Use original seed + current alternatives length for consistency
        seed = this.generateRegenerationSeed(
          book.generation_seed,
          book.alternative_back_covers.length
        );
      } else {
        // Backward compatibility: generate random seed for books without stored seed
        seed = this.generateRandomSeed();
        // Store the generated seed for future regenerations
        await Book.findByIdAndUpdate(bookId, { generation_seed: seed });
      }

      const tempFileName = `back_cover_regen_${bookId}_${Date.now()}.jpg`;
      const tempDir = getTempDir();
      const tempFilePath = path.join(tempDir, tempFileName);

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate image and save to local file
      const localImagePath = await this.generateIllustration(
        prompt,
        inputImages,
        seed,
        tempFilePath
      );

      // Upload to S3
      const alternativeNumber = Date.now();
      const s3Key = s3Service.generateBackCoverS3Key(
        userId,
        bookId,
        alternativeNumber,
        "jpg"
      );

      // Upload local file to S3
      const cloudFrontUrl = await s3Service.uploadLocalFile(
        localImagePath,
        s3Key,
        "image/jpeg"
      );

      // Add to alternatives array and set PDF regeneration flag
      await Book.findByIdAndUpdate(bookId, {
        $push: { alternative_back_covers: cloudFrontUrl },
        pdf_needs_regeneration: true,
      });

      // Track temp file for cleanup
      this.tempFilesToCleanup.push(localImagePath);

      logger.info(`Successfully regenerated back cover: ${cloudFrontUrl}`);
      logger.info(
        `PDF regeneration flag set for book ${bookId} due to back cover regeneration`
      );
      return cloudFrontUrl;
    } catch (error) {
      logger.error(
        `Failed to regenerate back cover for book ${bookId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Regenerate page illustration
   * @param {string} pageId - Page ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} - New illustration URL
   */
  async regeneratePageIllustration(pageId, userId) {
    try {
      logger.info(`Regenerating page illustration for page: ${pageId}`);

      // Fetch page and book with characters
      const page = await Page.findById(pageId);
      if (!page) {
        throw new Error("Page not found");
      }

      if (page.page_type !== "illustration") {
        throw new Error("Page is not an illustration page");
      }

      const book = await Book.findById(page.book_id).populate("character_ids");
      if (!book) {
        throw new Error("Book not found");
      }

      // Check ownership
      if (book.user_id.toString() !== userId) {
        throw new Error("Access denied");
      }

      // Extract character reference images
      let inputImages = this.extractInputImages(book.character_ids);

      if (book.illustration_style === "anime") {
        inputImages.push(ILLUST_ANIME);
      } else if (book.illustration_style === "disney") {
        inputImages.push(ILLUST_DISNEY);
      } else if (book.illustration_style === "vector_art") {
        inputImages.push(ILLUST_VECTOR_ART);
      } else if (book.illustration_style === "classic_watercolor") {
        inputImages.push(ILLUST_CLASSIC_WATERCOLOR);
      }

      // Use the existing illustration prompt from the page
      const prompt = page.illustration_prompt;

      // Generate new illustration using book's original seed + current alternatives length
      let seed;
      if (book.generation_seed) {
        // Use original seed + current alternatives length for consistency
        seed = this.generateRegenerationSeed(
          book.generation_seed,
          page.alternative_illustrations.length
        );
      } else {
        // Backward compatibility: generate random seed for books without stored seed
        seed = this.generateRandomSeed();
        // Store the generated seed for future regenerations
        await Book.findByIdAndUpdate(book._id, { generation_seed: seed });
      }

      const tempFileName = `page_regen_${pageId}_${Date.now()}.jpg`;
      const tempDir = getTempDir();
      const tempFilePath = path.join(tempDir, tempFileName);

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate image and save to local file
      const localImagePath = await this.generateIllustration(
        prompt,
        inputImages,
        seed,
        tempFilePath
      );

      // Upload to S3
      const alternativeNumber = Date.now();
      const s3Key = s3Service.generateIllustrationS3Key(
        book.user_id.toString(),
        book._id.toString(),
        pageId,
        alternativeNumber,
        "jpg"
      );

      // Upload local file to S3
      const cloudFrontUrl = await s3Service.uploadLocalFile(
        localImagePath,
        s3Key,
        "image/jpeg"
      );

      // Add to alternatives array, set as main illustration, and update seed if not set
      const updateData = {
        $push: { alternative_illustrations: cloudFrontUrl },
        illustration_url: cloudFrontUrl, // Automatically set as main illustration
      };

      // If page doesn't have a seed yet (backward compatibility), set it
      if (!page.illustration_seed) {
        updateData.illustration_seed = seed;
      }

      await Page.findByIdAndUpdate(pageId, updateData);

      // Set PDF regeneration flag on the associated book
      await Book.findByIdAndUpdate(book._id, {
        pdf_needs_regeneration: true,
      });

      // Track temp file for cleanup
      this.tempFilesToCleanup.push(localImagePath);

      logger.info(
        `Successfully regenerated page illustration: ${cloudFrontUrl}`
      );
      logger.info(
        `PDF regeneration flag set for book ${book._id} due to page illustration regeneration`
      );
      return cloudFrontUrl;
    } catch (error) {
      logger.error(
        `Failed to regenerate page illustration for page ${pageId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles() {
    for (const tempFile of this.tempFilesToCleanup) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          logger.info(`Cleaned up temp file: ${tempFile}`);
        }
      } catch (error) {
        logger.warn(`Failed to clean up temp file ${tempFile}:`, error);
      }
    }
    this.tempFilesToCleanup = [];
  }
}

module.exports = new IllustrationService();
