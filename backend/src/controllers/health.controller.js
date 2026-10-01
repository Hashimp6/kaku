exports.getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auto Connect API is running',
  });
};
