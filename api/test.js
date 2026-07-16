module.exports = (req, res) => {
  res.status(200).json({ ok: true, path: 'test', method: req.method });
};
