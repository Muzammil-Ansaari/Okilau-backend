import Product from "../models/Product.js";

export const getProducts = async (req, res) => {
  try {
    const { category, size, color, sort, search } = req.query;
    let filter = {};

    if (category) filter.category = category.toLowerCase();

    if (size) filter.sizes = { $in: [size] };

    if (color) filter.colors = { $in: [color] };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } }, 
        { category: { $regex: search, $options: "i" } },
      ];
    }

    let sortBy = {};
    if (sort === "price_asc") sortBy.price = 1;
    if (sort === "price_desc") sortBy.price = -1;
    if (sort === "newest") sortBy.createdAt = -1;

    const products = await Product.find(filter).sort(sortBy);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({
        message: "Product not found.",
      });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      image,
      images,
      colors,
      sizes,
      trending,
      hasVariations,
      stock,
    } = req.body;

    const product = await Product.create({
      title,
      description,
      price,
      category,
      image,
      images,
      colors,
      sizes,
      trending,
      hasVariations,
      stock,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: "Product not found." });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
