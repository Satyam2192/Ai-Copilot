import Question from '../models/Question.js';

export async function listQuestions(req, res) {
  const { topic } = req.query;
  const qs = await Question.find({ category: topic });
  res.json(qs);
}
