import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendInterviewInvitation = async (
  candidateEmail: string,
  jobTitle: string,
  interviewDate: Date,
  interviewLink: string
) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: candidateEmail,
    subject: `AI Interview Invitation - ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Interview Invitation</h2>
        <p>Dear Candidate,</p>
        <p>You have been invited to an AI-powered interview for the position of <strong>${jobTitle}</strong>.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin-top: 0;">Interview Details:</h3>
          <p><strong>Position:</strong> ${jobTitle}</p>
          <p><strong>Scheduled Date & Time:</strong> ${interviewDate.toLocaleString()}</p>
          <p><strong>Duration:</strong> Approximately 30-45 minutes</p>
        </div>
        
        <p><strong>Important Instructions:</strong></p>
        <ul>
          <li>Please ensure you have a stable internet connection</li>
          <li>The interview will require camera and microphone access</li>
          <li>Join the interview at the scheduled time using the link below</li>
          <li>The interview link will be active only during your scheduled time slot</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${interviewLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Join Interview
          </a>
        </div>
        
        <p>If you have any questions or need to reschedule, please contact the recruiting team.</p>
        
        <p>Best of luck!</p>
        <p>The Aptiview Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Interview invitation sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendInterviewReport = async (
  recruiterEmail: string,
  candidateName: string,
  jobTitle: string,
  summary: string,
  screenshots: string[],
  recordingUrl?: string
) => {
  const attachments = screenshots.map((screenshot, index) => ({
    filename: `screenshot_${index + 1}.png`,
    path: screenshot,
  }));

  if (recordingUrl) {
    attachments.push({
      filename: 'interview_recording.mp4',
      path: recordingUrl,
    });
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: recruiterEmail,
    subject: `Interview Report - ${candidateName} for ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Interview Report</h2>
        <p>The AI interview for <strong>${candidateName}</strong> has been completed.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin-top: 0;">Interview Summary:</h3>
          <p>${summary}</p>
        </div>
        
        <p>Please find the interview screenshots and recording attached to this email.</p>
        <p>You can also view the detailed analysis in your recruiter dashboard.</p>
        
        <p>Best regards,</p>
        <p>The Aptiview Team</p>
      </div>
    `,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Interview report sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending report email:', error);
    throw error;
  }
};
