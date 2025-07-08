const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const logger = require("../utils/logger");
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_LAMBDA_FUNCTION_NAME,
} = require("../utils/constants");

class LambdaService {
  constructor() {
    // Validate AWS credentials
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
      throw new Error("AWS credentials not properly configured");
    }

    if (!AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("AWS Lambda function name not configured");
    }

    this.lambdaClient = new LambdaClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Invoke the book generation Lambda function
   * @param {string} bookId - MongoDB book ID
   * @returns {Promise<Object>} - Lambda invocation result
   */
  async invokeBookGeneration(bookId) {
    try {
      logger.info(`Invoking Lambda function for book generation: ${bookId}`);

      const payload = {
        bookId: bookId,
      };

      const command = new InvokeCommand({
        FunctionName: AWS_LAMBDA_FUNCTION_NAME,
        InvocationType: "Event", // Asynchronous invocation
        Payload: JSON.stringify(payload),
      });

      const response = await this.lambdaClient.send(command);

      logger.info(`Lambda function invoked successfully for book ${bookId}`, {
        statusCode: response.StatusCode,
        executedVersion: response.ExecutedVersion,
      });

      return {
        success: true,
        statusCode: response.StatusCode,
        executedVersion: response.ExecutedVersion,
      };
    } catch (error) {
      logger.error(`Failed to invoke Lambda function for book ${bookId}:`, error);
      throw new Error(`Lambda invocation failed: ${error.message}`);
    }
  }

  /**
   * Invoke Lambda function with retry logic
   * @param {string} bookId - MongoDB book ID
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<Object>} - Lambda invocation result
   */
  async invokeBookGenerationWithRetry(bookId, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          `Lambda invocation attempt ${attempt}/${maxRetries} for book ${bookId}`
        );

        const result = await this.invokeBookGeneration(bookId);
        return result;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          logger.error(
            `All Lambda invocation attempts failed for book ${bookId}:`,
            error
          );
          throw error;
        } else {
          // Calculate exponential backoff delay: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          logger.warn(
            `Lambda invocation attempt ${attempt} failed for book ${bookId}, retrying in ${delay}ms:`,
            error.message
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

module.exports = LambdaService;
