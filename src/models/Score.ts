import mongoose from 'mongoose';

export interface IScore extends mongoose.Document {
    name: string;
    score: number;
    createdAt: Date;
}

const ScoreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name for this score.'],
        maxlength: [10, 'Name cannot be more than 10 characters'],
    },
    score: {
        type: Number,
        required: [true, 'Please provide the score.'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.models.Score || mongoose.model<IScore>('Score', ScoreSchema);
