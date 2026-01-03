import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Score from '@/models/Score';

export async function GET() {
    await dbConnect();
    try {
        const scores = await Score.find({}).sort({ score: -1 }).limit(10);
        return NextResponse.json({ success: true, data: scores });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch scores' }, { status: 400 });
    }
}

export async function POST(request: Request) {
    await dbConnect();
    try {
        const body = await request.json();
        const score = await Score.create(body);
        return NextResponse.json({ success: true, data: score }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to create score' }, { status: 400 });
    }
}
