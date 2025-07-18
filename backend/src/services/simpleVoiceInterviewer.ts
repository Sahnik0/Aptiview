import OpenAI from 'openai';
import { EventEmitter } from 'events';

export interface VoiceInterviewConfig {
  jobTitle: string;
  jobDescription: string;
  customQuestions?: string[];
  candidateName?: string;
}

export class SimpleVoiceInterviewer extends EventEmitter {
  private openai: OpenAI;
  private config: VoiceInterviewConfig;
  private transcript: Array<{ role: 'assistant' | 'user', content: string, timestamp: Date }> = [];
  private conversationContext: string = '';
  private currentQuestionIndex = 0;
  private questions: string[] = [];

  constructor(config: VoiceInterviewConfig) {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.config = config;
    this.setupConversationContext();
    this.setupQuestions();
  }

  private setupConversationContext() {
    this.conversationContext = `You are a professional, conversational AI interviewer conducting a job interview for the position of ${this.config.jobTitle}. 

Job Description: ${this.config.jobDescription}

IMPORTANT INSTRUCTIONS:
- Be natural, conversational, and human-like in your responses
- When you can't understand what the candidate said, politely ask them to repeat or clarify
- Use follow-up questions based on their responses, not just predetermined questions
- Show interest in their answers with responses like "That's interesting, tell me more about..."
- If the candidate gives a short answer, ask for elaboration
- Be encouraging and supportive while maintaining professionalism
- Handle unclear or incomplete responses gracefully
- Adapt your questions based on the flow of conversation
- Make the candidate feel comfortable and engaged

${this.config.customQuestions ? `Custom questions to include: ${this.config.customQuestions.join(', ')}` : ''}

You are interviewing ${this.config.candidateName || 'the candidate'}. Create a natural conversation flow rather than a rigid Q&A session.`;
  }

  private setupQuestions() {
    this.questions = [
      `Hello ${this.config.candidateName || 'there'}! Welcome to your interview for the ${this.config.jobTitle} position. I'm your AI interviewer today. Could you please start by telling me a bit about yourself and your background?`,
      `That's great! Can you tell me about your relevant experience for this ${this.config.jobTitle} role?`,
      `What interests you most about this position and our company?`,
      `Can you describe a challenging project you've worked on and how you overcame any obstacles?`,
      `How do you handle working in a team environment?`,
      `Where do you see yourself in the next few years in your career?`,
      `Do you have any questions about the role or the company?`,
      `Thank you for your time today. That concludes our interview. You should hear back from us soon regarding the next steps.`
    ];

    // Add custom questions if provided
    if (this.config.customQuestions && this.config.customQuestions.length > 0) {
      this.questions.splice(-2, 0, ...this.config.customQuestions);
    }
  }

  async startInterview(): Promise<void> {
    this.emit('connected');
    
    // Start with the first question
    const firstQuestion = this.questions[0];
    
    // Generate speech for the first question
    const audioResponse = await this.generateSpeech(firstQuestion);
    
    const assistantMessage = {
      role: 'assistant' as const,
      content: firstQuestion,
      timestamp: new Date()
    };
    
    this.transcript.push(assistantMessage);
    this.emit('assistant-message', assistantMessage);
    this.emit('audio-response', audioResponse);
    
    this.currentQuestionIndex++;
  }

  async processUserResponse(userText: string, timeLeft?: number): Promise<void> {
    // Add user message to transcript
    const userMessage = {
      role: 'user' as const,
      content: userText,
      timestamp: new Date()
    };
    this.transcript.push(userMessage);
    this.emit('user-message', userMessage);

    // Check if the transcription seems unclear or incomplete
    const isUnclear = this.isResponseUnclear(userText);
    
    let nextResponse: string;
    
    if (isUnclear) {
      // Handle unclear responses naturally
      nextResponse = await this.handleUnclearResponse(userText);
    } else if (this.currentQuestionIndex < this.questions.length) {
      // For initial questions, ask them but then generate follow-ups
      if (this.currentQuestionIndex === 1) {
        // First question already asked, generate natural follow-up
        nextResponse = await this.generateContextualResponse(userText, timeLeft);
      } else {
        // Ask the next predetermined question
        nextResponse = this.questions[this.currentQuestionIndex];
        this.currentQuestionIndex++;
      }
    } else {
      // Generate contextual responses and follow-ups
      nextResponse = await this.generateContextualResponse(userText, timeLeft);
    }

    // Generate speech for the response
    const audioResponse = await this.generateSpeech(nextResponse);
    
    const assistantMessage = {
      role: 'assistant' as const,
      content: nextResponse,
      timestamp: new Date()
    };
    
    this.transcript.push(assistantMessage);
    this.emit('assistant-message', assistantMessage);
    this.emit('audio-response', audioResponse);

    // Check if interview should naturally end
    if (this.shouldEndInterview(nextResponse)) {
      setTimeout(() => {
        this.emit('interview-complete');
      }, 3000);
    }
  }

  private isResponseUnclear(userText: string): boolean {
    // Check for signs of unclear transcription or technical issues
    const unclearIndicators = [
      userText.length < 3,
      /^[a-z\s]{1,10}$/i.test(userText), // Very short, basic words
      /^(um|uh|er|hmm|well|so|i|the|and|a|an)$/i.test(userText.trim()), // Single filler words
      userText.includes('...') || userText.includes('???'),
      /^[^a-zA-Z]*$/.test(userText), // No actual letters
      userText.includes('[unclear') || userText.includes('[speech') || userText.includes('[audio'), // Technical error markers
      userText.trim() === '' || userText.trim() === '[unclear speech]' || userText.trim() === '[speech too short]'
    ];
    
    return unclearIndicators.some(indicator => indicator);
  }

  private async handleUnclearResponse(userText: string): Promise<string> {
    const clarificationResponses = [
      "I'm sorry, I didn't catch that clearly. Could you please repeat that?",
      "I had trouble understanding what you said. Could you rephrase that for me?",
      "Sorry, there might have been some audio issues. Could you say that again?",
      "I didn't hear you clearly. Could you please speak a bit louder and repeat your answer?",
      "I'm having trouble understanding. Could you please repeat that more clearly?"
    ];
    
    // Pick a random clarification response
    const randomResponse = clarificationResponses[Math.floor(Math.random() * clarificationResponses.length)];
    return randomResponse;
  }

  private shouldEndInterview(response: string): boolean {
    const endIndicators = [
      response.toLowerCase().includes('thank you for your time'),
      response.toLowerCase().includes('that concludes'),
      response.toLowerCase().includes('we\'re all done'),
      response.toLowerCase().includes('end of the interview'),
      this.transcript.length > 20 && response.toLowerCase().includes('final question')
    ];
    
    return endIndicators.some(indicator => indicator);
  }

  private async generateContextualResponse(userText: string, timeLeft?: number): Promise<string> {
    const conversationHistory = this.transcript
      .slice(-6) // Only use last 6 messages for context
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    let timeInstruction = '';
    if (typeof timeLeft === 'number') {
      if (timeLeft <= 60) {
        timeInstruction = '\n\nIMPORTANT: There is only 1 minute left in the interview. Please ask a final or wrap-up question.';
      } else if (timeLeft <= 180) {
        timeInstruction = '\n\nNOTE: Only a few minutes remain. Prioritize the most important questions.';
      } else {
        timeInstruction = `\n\nTime remaining in interview: ${Math.floor(timeLeft / 60)} minutes.`;
      }
    }

    const prompt = `${this.conversationContext}
${timeInstruction}

RECENT CONVERSATION:
${conversationHistory}

The candidate just said: "${userText}"

Please respond as a human interviewer would:
- If their answer was good, acknowledge it and ask a relevant follow-up question
- If their answer was brief, ask them to elaborate or give an example
- If time is almost up, ask a wrap-up or closing question
- Be aware of the remaining time and adapt your questioning accordingly
- Use phrases like "That's interesting...", "Tell me more about...", "Can you give me an example...", "How did you handle...", etc.

If this seems like a natural place to wrap up the interview (after covering major topics), provide a polite conclusion.

Keep your response conversational and under 50 words.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Higher temperature for more natural responses
        max_tokens: 100
      });

      return response.choices[0]?.message?.content || "That's interesting. Tell me more about that.";
    } catch (error) {
      console.error('Error generating response:', error);
      return "That's great. Can you tell me more about that experience?";
    }
  }

  private async generateSpeech(text: string): Promise<Buffer> {
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd', // Use high-definition model for better quality
        voice: 'nova', // Professional female voice, good for interviews
        input: text,
        speed: 0.9, // Slightly slower for better comprehension
        response_format: 'mp3' // MP3 for better compatibility
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType?: string): Promise<string> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Determine file extension based on mime type
      let extension = 'webm'; // default
      if (mimeType) {
        if (mimeType.includes('mp4')) extension = 'mp4';
        else if (mimeType.includes('wav')) extension = 'wav';
        else if (mimeType.includes('mpeg')) extension = 'mp3';
        else if (mimeType.includes('webm')) extension = 'webm';
        else if (mimeType.includes('ogg')) extension = 'ogg';
        else if (mimeType.includes('opus')) extension = 'opus';
      }
      
      const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}.${extension}`);
      
      console.log(`Processing audio: ${audioBuffer.length} bytes, format: ${mimeType || 'unknown'}, extension: ${extension}`);
      
      // Validate minimum audio size - increased threshold for longer recordings
      if (audioBuffer.length < 8000) {
        console.warn(`Audio buffer too small: ${audioBuffer.length} bytes - likely too short for transcription`);
        throw new Error('Audio too short for transcription - please speak for at least 3-4 seconds');
      }
      
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Verify file was created and has content
      const fileStats = fs.statSync(tempFilePath);
      console.log(`Temp file created: ${tempFilePath}, size: ${fileStats.size} bytes`);
      
      if (fileStats.size === 0) {
        fs.unlinkSync(tempFilePath);
        throw new Error('Empty audio file generated');
      }
      
      if (fileStats.size < 8000) {
        fs.unlinkSync(tempFilePath);
        throw new Error('Audio file too small - please speak for at least 3-4 seconds');
      }
      
      // Create a readable stream for OpenAI
      const audioStream = fs.createReadStream(tempFilePath);
      
      console.log('Sending audio to OpenAI Whisper...');
      
      // Try multiple transcription attempts with different parameters
      let transcription = '';
      let lastError: Error | null = null;
      
      const transcriptionAttempts = [
        {
          model: 'whisper-1' as const,
          language: 'en' as const,
          response_format: 'verbose_json' as const,
          temperature: 0.0,
          prompt: 'This is a professional job interview conversation. The speaker is answering questions about their work experience, skills, and background. Please transcribe accurately.'
        },
        {
          model: 'whisper-1' as const,
          language: 'en' as const, 
          response_format: 'text' as const,
          temperature: 0.1,
          prompt: 'Job interview conversation. Candidate speaking about their experience.'
        },
        {
          model: 'whisper-1' as const,
          response_format: 'text' as const,
          temperature: 0.2
        }
      ];
      
      for (const attempt of transcriptionAttempts) {
        try {
          console.log(`Attempting transcription with settings:`, attempt);
          
          // Create a new stream for each attempt
          const freshStream = fs.createReadStream(tempFilePath);
          
          const response = await this.openai.audio.transcriptions.create({
            file: freshStream,
            ...attempt
          } as any); // Type assertion to handle the union type complexity
          
          // Handle different response formats
          if (attempt.response_format === 'verbose_json') {
            transcription = (response as any).text || '';
          } else {
            transcription = (response as unknown as string) || '';
          }
          
          console.log(`Transcription attempt result: "${transcription}"`);
          
          // Check if transcription looks valid
          if (transcription && transcription.trim().length > 0) {
            // Filter out obviously wrong transcriptions
            const invalidPatterns = [
              /https?:\/\/[^\s]+/gi, // URLs
              /www\.[^\s]+/gi, // www domains
              /\.com[^\s]*/gi, // .com domains
              /disclaimer/gi, // disclaimer text
              /^[^a-zA-Z]*$/gi, // Non-alphabetic only
              /^.{0,3}$/gi, // Too short (less than 4 chars)
            ];
            
            const isInvalid = invalidPatterns.some(pattern => pattern.test(transcription));
            
            if (!isInvalid) {
              console.log(`Valid transcription found: "${transcription}"`);
              break;
            } else {
              console.log(`Invalid transcription detected, trying next attempt`);
              transcription = '';
            }
          }
          
        } catch (error) {
          console.error(`Transcription attempt failed:`, error);
          lastError = error as Error;
          continue;
        }
      }
      
      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      
      if (!transcription || transcription.trim().length === 0) {
        console.error('All transcription attempts failed');
        throw lastError || new Error('Failed to transcribe audio - please try speaking more clearly');
      }
      
      // Post-process transcription to improve quality
      transcription = this.improveTranscription(transcription);
      
      console.log('Final transcription result:', transcription);

      return transcription;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('audio_too_short') || error.message.includes('too short')) {
          throw new Error('Please speak for at least 3-4 seconds before stopping');
        } else if (error.message.includes('invalid_request_error')) {
          throw new Error('Audio format not supported. Please try again.');
        } else if (error.message.includes('Failed to transcribe')) {
          throw error; // Re-throw our custom error
        }
      }
      
      throw error;
    }
  }

  private improveTranscription(transcription: string): string {
    // Basic transcription improvements
    let improved = transcription.trim();
    
    // Fix common transcription issues
    improved = improved.replace(/\s+/g, ' '); // Multiple spaces to single space
    improved = improved.replace(/^[^a-zA-Z0-9]*/, ''); // Remove leading non-alphanumeric
    improved = improved.replace(/[^a-zA-Z0-9\s.,!?'-]*$/, ''); // Remove trailing non-alphanumeric
    
    // Capitalize first letter if not empty
    if (improved.length > 0) {
      improved = improved.charAt(0).toUpperCase() + improved.slice(1);
    }
    
    // Add period if missing and sentence seems complete
    if (improved.length > 10 && !/[.!?]$/.test(improved)) {
      improved += '.';
    }
    
    return improved;
  }

  endInterview(): void {
    this.emit('interview-complete');
  }

  getTranscript(): Array<{ role: 'assistant' | 'user', content: string, timestamp: Date }> {
    return this.transcript;
  }

  async generateFinalSummary(): Promise<{
    summary: string;
    scores: {
      communication: number;
      technical: number;
      problemSolving: number;
      culturalFit: number;
    };
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  }> {
    const fullTranscript = this.transcript
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const prompt = `You are an expert AI interview analyst. Based on the following transcript and job description, generate a comprehensive JSON summary. 

Instructions:
- Carefully analyze the transcript and job description.
- Infer all values (summary, scores, strengths, weaknesses, recommendation) from the content provided.
- Your response MUST be a valid JSON object, with no extra text, no apologies, and no explanations.
- Do NOT include any introductory or closing remarks—just the JSON.
- If you are unsure about any value, make your best inference from the transcript context.

Format your response as:
{
  "summary": "...",
  "scores": {
    "communication": <number 1-10>,
    "technical": <number 1-10>,
    "problemSolving": <number 1-10>,
    "culturalFit": <number 1-10>
  },
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."],
  "recommendation": "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire"
}

TRANSCRIPT:
${fullTranscript}

JOB DESCRIPTION:
${this.config.jobDescription}

REMEMBER: Output ONLY valid JSON. Do NOT add any extra text, apologies, or explanations.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      try {
        return JSON.parse(content);
      } catch (err) {
        console.error('Error parsing AI summary:', err, content);
        return {
          summary: 'Summary could not be generated due to an AI response error.',
          scores: {
            communication: 0,
            technical: 0,
            problemSolving: 0,
            culturalFit: 0
          },
          strengths: [],
          weaknesses: [],
          recommendation: 'No Recommendation'
        };
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }
}
