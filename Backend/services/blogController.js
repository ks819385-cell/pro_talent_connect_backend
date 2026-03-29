const Blog = require("../Models/Blog");
const { logAction } = require("../Middleware/auditLogger");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

// @desc    Create a new blog/article
// @route   POST /api/blogs
// @access  Private / Admin & Super Admin
const createBlog = catchAsync(async (req, res) => {
    const {
      title,
      slug,
      content,
      excerpt,
      cover_image,
      image,
      category,
      readTime,
      tags,
      status,
    } = req.body;

    // Check required fields
    if (!title || !content) {
      throw new AppError("Please provide title and content", 400);
    }

    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Check for duplicate slug
    const existingBlog = await Blog.findOne({ slug: finalSlug, isDeleted: false });
    if (existingBlog) {
      // Add timestamp to make slug unique
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const blog = await Blog.create({
      title,
      slug: finalSlug,
      content,
      excerpt,
      cover_image: cover_image || image || "",
      image: image || cover_image || "",
      category: category || "General",
      readTime: readTime || 5,
      tags,
      status: status || "DRAFT",
      author_id: req.user._id,
    });

    // Populate author details
    await blog.populate("author_id", "name email role");

    // Log blog creation
    await logAction({
      user: req.user,
      action: "CREATE",
      resourceType: "Blog",
      resourceId: blog._id.toString(),
      description: `Blog created: ${blog.title} (${blog.status})`,
      req,
      changes: { title, slug: finalSlug, status: blog.status },
      status: "SUCCESS"
    });

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog,
    });
});

// @desc    Get all blogs including drafts (with filters & pagination)
// @route   GET /api/blogs/all
// @access  Private / Admin & Super Admin
const getAllBlogs = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { isDeleted: false };

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by tags
    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(",") };
    }

    // Filter by author
    if (req.query.author_id) {
      filter.author_id = req.query.author_id;
    }

    // Search by title
    if (req.query.title) {
      filter.title = { $regex: req.query.title, $options: "i" };
    }

    const totalResults = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limit);
    const blogs = await Blog.find(filter)
      .populate("author_id", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: blogs.length,
      totalResults,
      totalPages,
      currentPage: page,
      blogs,
    });
});

// @desc    Get single blog by ID or slug
// @route   GET /api/blogs/:identifier
// @access  Public
const getBlogById = catchAsync(async (req, res) => {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let blog = await Blog.findOne({
      _id: identifier,
      isDeleted: false,
    }).populate("author_id", "name email role");

    if (!blog) {
      blog = await Blog.findOne({
        slug: identifier,
        isDeleted: false,
      }).populate("author_id", "name email role");
    }

    if (!blog) {
      throw new AppError("Blog not found", 404);
    }

    res.status(200).json({
      success: true,
      blog,
    });
});

// @desc    Update a blog/article
// @route   PUT /api/blogs/:id
// @access  Private / Admin & Super Admin
const updateBlog = catchAsync(async (req, res) => {
    const blog = await Blog.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!blog) {
      throw new AppError("Blog not found", 404);
    }

    // Update only provided fields
    const updatableFields = [
      "title",
      "content",
      "excerpt",
      "cover_image",
      "image",
      "category",
      "readTime",
      "tags",
      "status",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        blog[field] = req.body[field];
      }
    });

    // Update slug if title changed
    if (req.body.title && req.body.title !== blog.title) {
      const newSlug = req.body.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      
      // Check if new slug is unique
      const existingBlog = await Blog.findOne({ 
        slug: newSlug, 
        isDeleted: false,
        _id: { $ne: blog._id }
      });
      
      if (existingBlog) {
        blog.slug = `${newSlug}-${Date.now()}`;
      } else {
        blog.slug = newSlug;
      }
    }

    const updatedBlog = await blog.save();
    await updatedBlog.populate("author_id", "name email role");

    // Log blog update
    await logAction({
      user: req.user,
      action: "UPDATE",
      resourceType: "Blog",
      resourceId: blog._id.toString(),
      description: `Blog updated: ${updatedBlog.title}`,
      req,
      changes: req.body,
      status: "SUCCESS"
    });

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog,
    });
});

// @desc    Delete a blog/article
// @route   DELETE /api/blogs/:id
// @access  Private / Super Admin only
const deleteBlog = catchAsync(async (req, res) => {
    const blog = await Blog.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!blog) {
      throw new AppError("Blog not found", 404);
    }

    // Soft delete
    blog.isDeleted = true;
    await blog.save();

    // Log blog deletion
    await logAction({
      user: req.user,
      action: "DELETE",
      resourceType: "Blog",
      resourceId: blog._id.toString(),
      description: `Blog deleted: ${blog.title}`,
      req,
      changes: { isDeleted: true },
      status: "SUCCESS"
    });

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
});

// @desc    Get published blogs only
// @route   GET /api/blogs
// @access  Public
const getPublishedBlogs = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { 
      isDeleted: false,
      status: "PUBLISHED"
    };

    // Filter by tags
    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(",") };
    }

    const totalResults = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limit);
    const blogs = await Blog.find(filter)
      .populate("author_id", "name email")
      .sort({ published_at: -1 })
      .skip(skip)
      .limit(limit)
      .select("-isDeleted");

    res.status(200).json({
      success: true,
      count: blogs.length,
      totalResults,
      totalPages,
      currentPage: page,
      blogs,
    });
});

// @desc    Toggle blog status to PUBLISHED
// @route   PATCH /api/blogs/:id/publish
// @access  Private / Admin & Super Admin
const togglePublish = catchAsync(async (req, res) => {
    const blog = await Blog.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!blog) {
      throw new AppError("Blog not found", 404);
    }

    // Toggle to PUBLISHED status
    blog.status = "PUBLISHED";
    const updatedBlog = await blog.save();
    await updatedBlog.populate("author_id", "name email role");

    // Log blog publish action
    await logAction({
      user: req.user,
      action: "UPDATE",
      resourceType: "Blog",
      resourceId: blog._id.toString(),
      description: `Blog published: ${blog.title}`,
      req,
      changes: { status: "PUBLISHED" },
      status: "SUCCESS"
    });

    res.status(200).json({
      success: true,
      message: "Blog published successfully",
      blog: updatedBlog,
    });
});

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getPublishedBlogs,
  togglePublish,
};
