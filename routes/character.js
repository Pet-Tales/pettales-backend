const express = require("express");
const { body, param, query } = require("express-validator");
const { characterController } = require("../controllers");
const { requireAuth } = require("../middleware");

const router = express.Router();

// Validation rules
const characterNameValidation = body("character_name")
  .isLength({ min: 2 })
  .withMessage("Character name must be at least 2 characters long")
  .trim();

const characterTypeValidation = body("character_type")
  .isIn(["human", "pet"])
  .withMessage("Character type must be either 'human' or 'pet'");

const humanCharacterValidation = [
  body("age")
    .if(body("character_type").equals("human"))
    .isInt({ min: 0 })
    .withMessage("Age must be a positive number for human characters"),
  body("ethnicity")
    .if(body("character_type").equals("human"))
    .notEmpty()
    .withMessage("Ethnicity is required for human characters")
    .trim(),
  body("hair_color").optional().trim(),
  body("eye_color").optional().trim(),
];

const petCharacterValidation = [
  body("pet_type")
    .if(body("character_type").equals("pet"))
    .notEmpty()
    .withMessage("Pet type is required for pet characters")
    .trim(),
  body("breed")
    .if(body("character_type").equals("pet"))
    .notEmpty()
    .withMessage("Breed is required for pet characters")
    .trim(),
  body("fur").optional().trim(),
  body("ears").optional().trim(),
  body("tail").optional().trim(),
];

const genderValidation = body("gender")
  .notEmpty()
  .withMessage("Gender is required")
  .custom((value, { req }) => {
    const characterType = req.body.character_type;
    if (characterType === "human") {
      if (!["boy", "girl"].includes(value)) {
        throw new Error(
          "Gender must be either 'boy' or 'girl' for human characters"
        );
      }
    } else if (characterType === "pet") {
      if (!["male", "female"].includes(value)) {
        throw new Error(
          "Gender must be either 'male' or 'female' for pet characters"
        );
      }
    }
    return true;
  });

const personalityValidation = body("personality").optional().trim();

const createCharacterValidation = [
  characterNameValidation,
  characterTypeValidation,
  ...humanCharacterValidation,
  ...petCharacterValidation,
  genderValidation,
  personalityValidation,
];

const updateCharacterValidation = [
  body("character_name")
    .optional()
    .isLength({ min: 2 })
    .withMessage("Character name must be at least 2 characters long")
    .trim(),
  body("character_type")
    .optional()
    .isIn(["human", "pet"])
    .withMessage("Character type must be either 'human' or 'pet'"),
  ...humanCharacterValidation,
  ...petCharacterValidation,
  genderValidation,
  personalityValidation,
];

const mongoIdValidation = param("id")
  .isMongoId()
  .withMessage("Invalid character ID");

const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("type")
    .optional()
    .isIn(["human", "pet"])
    .withMessage("Type filter must be either 'human' or 'pet'"),
];

const imageUploadValidation = [
  body("contentType")
    .matches(/^image\/(jpeg|jpg|png)$/)
    .withMessage("Content type must be image/jpeg or image/png"),
];

const imageUrlValidation = [
  body("imageUrl").isURL().withMessage("Image URL must be a valid URL"),
];

// Routes

// Get user's characters with pagination
router.get(
  "/",
  requireAuth,
  paginationValidation,
  characterController.getCharacters
);

// Get specific character by ID
router.get(
  "/:id",
  requireAuth,
  mongoIdValidation,
  characterController.getCharacterById
);

// Create new character
router.post(
  "/",
  requireAuth,
  createCharacterValidation,
  characterController.createCharacter
);

// Update character
router.put(
  "/:id",
  requireAuth,
  mongoIdValidation,
  updateCharacterValidation,
  characterController.updateCharacter
);

// Delete character (with book usage check)
router.delete(
  "/:id",
  requireAuth,
  mongoIdValidation,
  characterController.deleteCharacter
);

// Force delete character (even if used in books)
router.delete(
  "/:id/force",
  requireAuth,
  mongoIdValidation,
  characterController.forceDeleteCharacter
);

// Generate presigned URL for character reference image upload
router.post(
  "/:id/image/upload-url",
  requireAuth,
  mongoIdValidation,
  imageUploadValidation,
  characterController.generateImageUploadUrl
);

// Update character's reference image URL after successful upload
router.put(
  "/:id/image",
  requireAuth,
  mongoIdValidation,
  imageUrlValidation,
  characterController.updateCharacterImage
);

// Delete character's reference image
router.delete(
  "/:id/image",
  requireAuth,
  mongoIdValidation,
  characterController.deleteCharacterImage
);

module.exports = router;
