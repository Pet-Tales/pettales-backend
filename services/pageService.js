const mongoose = require("mongoose");
const { Book, Page } = require("../models");
const logger = require("../utils/logger");

class PageService {
  /**
   * Get all pages for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID (optional for public books)
   * @returns {Promise<Array>} - Array of pages
   */
  async getBookPages(bookId, userId = null) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      // First check if user has access to the book
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      // Check access permissions
      const isOwner = userId && book.user_id.toString() === userId;
      const isPublic = book.is_public;

      if (!isOwner && !isPublic) {
        throw new Error("Access denied");
      }

      // Get pages sorted by book_page_number
      const pages = await Page.find({ book_id: bookId }).sort({
        book_page_number: 1,
      });

      return pages;
    } catch (error) {
      logger.error(`Failed to get pages for book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific page by ID
   * @param {string} pageId - Page ID
   * @param {string} userId - User ID (optional for public books)
   * @returns {Promise<Object>} - Page with book info
   */
  async getPageById(pageId, userId = null) {
    try {
      if (!mongoose.Types.ObjectId.isValid(pageId)) {
        throw new Error("Invalid page ID format");
      }

      const page = await Page.findById(pageId).populate("book_id");
      if (!page) {
        throw new Error("Page not found");
      }

      const book = page.book_id;
      if (!book) {
        throw new Error("Associated book not found");
      }

      // Check access permissions
      const isOwner = userId && book.user_id.toString() === userId;
      const isPublic = book.is_public;

      if (!isOwner && !isPublic) {
        throw new Error("Access denied");
      }

      return {
        ...page,
        isOwner,
      };
    } catch (error) {
      logger.error(`Failed to get page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Update a page (text content or illustration selection)
   * @param {string} pageId - Page ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated page
   */
  async updatePage(pageId, userId, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(pageId)) {
        throw new Error("Invalid page ID format");
      }

      // Get page with book info
      const page = await Page.findById(pageId).populate("book_id");
      if (!page) {
        throw new Error("Page not found");
      }

      const book = page.book_id;
      if (!book) {
        throw new Error("Associated book not found");
      }

      // Check ownership
      if (book.user_id.toString() !== userId) {
        throw new Error("Access denied");
      }

      // Only allow editing completed books
      if (book.generation_status !== "completed") {
        throw new Error("Only completed books can be edited");
      }

      // Validate update data based on page type
      const allowedUpdates = {};

      if (page.page_type === "text") {
        // For text pages, only allow text_content updates
        if (updateData.text_content !== undefined) {
          if (typeof updateData.text_content !== "string") {
            throw new Error("Text content must be a string");
          }
          if (updateData.text_content.trim().length === 0) {
            throw new Error("Text content cannot be empty");
          }
          allowedUpdates.text_content = updateData.text_content.trim();
        }
      } else if (page.page_type === "illustration") {
        // For illustration pages, allow illustration_url updates (selecting alternatives)
        if (updateData.illustration_url !== undefined) {
          if (typeof updateData.illustration_url !== "string") {
            throw new Error("Illustration URL must be a string");
          }

          // Validate that the new URL is in the alternatives list or is the current URL
          const validUrls = [
            page.illustration_url,
            ...(page.alternative_illustrations || []),
          ].filter(Boolean);

          if (!validUrls.includes(updateData.illustration_url)) {
            throw new Error(
              "Invalid illustration URL - must be from available alternatives"
            );
          }

          allowedUpdates.illustration_url = updateData.illustration_url;
        }
      }

      // If no valid updates, return error
      if (Object.keys(allowedUpdates).length === 0) {
        throw new Error("No valid updates provided");
      }

      // Update the page
      const updatedPage = await Page.findByIdAndUpdate(pageId, allowedUpdates, {
        new: true,
        runValidators: true,
      }).populate("book_id");

      // Set PDF regeneration flag on the associated book since page content changed
      if (book.generation_status === "completed") {
        await Book.findByIdAndUpdate(book._id, {
          pdf_needs_regeneration: true,
        });
        logger.info(
          `PDF regeneration flag set for book ${book._id} due to page content changes`
        );
      }

      logger.info(`Page updated successfully: ${pageId}`);
      return updatedPage;
    } catch (error) {
      logger.error(`Failed to update page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Get pages grouped by story page number
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID (optional for public books)
   * @returns {Promise<Array>} - Array of grouped pages
   */
  async getGroupedBookPages(bookId, userId = null) {
    try {
      const pages = await this.getBookPages(bookId, userId);

      // Group pages by story_page_number
      const groupedPages = {};

      pages.forEach((page) => {
        const storyPageNum = page.story_page_number;
        if (!groupedPages[storyPageNum]) {
          groupedPages[storyPageNum] = {
            story_page_number: storyPageNum,
            text_page: null,
            illustration_page: null,
          };
        }

        // Apply toJSON transformation to ensure proper field name conversion
        const pageJson = page.toJSON ? page.toJSON() : page;

        if (page.page_type === "text") {
          groupedPages[storyPageNum].text_page = pageJson;
        } else if (page.page_type === "illustration") {
          groupedPages[storyPageNum].illustration_page = pageJson;
        }
      });

      // Convert to array and sort by story page number
      const result = Object.values(groupedPages)
        .sort((a, b) => a.story_page_number - b.story_page_number)
        .map((group) => ({
          storyPageNumber: group.story_page_number,
          text_page: group.text_page,
          illustration_page: group.illustration_page,
        }));

      return result;
    } catch (error) {
      logger.error(`Failed to get grouped pages for book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple pages in a batch
   * @param {Array} pageUpdates - Array of page updates [{pageId, updateData}]
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of updated pages
   */
  async updateMultiplePages(pageUpdates, userId) {
    try {
      const updatedPages = [];

      // Process updates sequentially to maintain data integrity
      for (const { pageId, updateData } of pageUpdates) {
        try {
          const updatedPage = await this.updatePage(pageId, userId, updateData);
          updatedPages.push(updatedPage);
        } catch (error) {
          logger.error(`Failed to update page ${pageId} in batch:`, error);
          // Continue with other updates, but collect the error
          updatedPages.push({
            pageId,
            error: error.message,
            success: false,
          });
        }
      }

      return updatedPages;
    } catch (error) {
      logger.error("Failed to update multiple pages:", error);
      throw error;
    }
  }
}

module.exports = PageService;
