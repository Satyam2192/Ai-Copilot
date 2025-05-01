import mongoose from 'mongoose';
const QuestionSchema = new mongoose.Schema({ text: String, category: String, difficulty: String, exampleAnswer: String });
export default mongoose.model('Question', QuestionSchema);
