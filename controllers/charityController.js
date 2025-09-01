const { validationResult } = require("express-validator");
const { Charity } = require("../models");

const listEnabled = async (req, res) => {
  try {
    const charities = await Charity.find({ is_enabled: true })
      .sort({ sort_order: 1, name: 1 })
      .lean();
    res.json({ success: true, data: charities.map((c) => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      websiteUrl: c.website_url,
      logoUrl: c.logo_url,
    })) });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load charities" });
  }
};

const listAll = async (_req, res) => {
  try {
    const charities = await Charity.find().sort({ sort_order: 1, name: 1 });
    res.json({ success: true, data: charities });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load charities" });
  }
};

const create = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, slug, description, website_url, logo_url, is_enabled, sort_order, language_tags } = req.body;
    const charity = new Charity({ name, slug, description, website_url, logo_url, is_enabled, sort_order, language_tags });
    await charity.save();
    res.status(201).json({ success: true, data: charity });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const charity = await Charity.findByIdAndUpdate(id, updates, { new: true });
    if (!charity) {
      return res.status(404).json({ success: false, message: "Charity not found" });
    }
    res.json({ success: true, data: charity });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const charity = await Charity.findByIdAndDelete(id);
    if (!charity) {
      return res.status(404).json({ success: false, message: "Charity not found" });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const toggleEnable = async (req, res) => {
  try {
    const { id } = req.params;
    const charity = await Charity.findById(id);
    if (!charity) return res.status(404).json({ success: false, message: "Not found" });
    charity.is_enabled = !charity.is_enabled;
    await charity.save();
    res.json({ success: true, data: charity });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { listEnabled, listAll, create, update, remove, toggleEnable };

