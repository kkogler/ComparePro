import sgMail from '@sendgrid/mail';
import fetch from 'node-fetch';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  type?: string; // mime type
}

export interface EmailContent {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface AdminSettings {
  sendgridApiKey?: string | null;
  smtp2goApiKey?: string | null;
  systemEmail?: string | null;
  supportEmail?: string | null;
}

// Send email using SMTP2GO
export async function sendEmailViaSMTP2GO(content: EmailContent, adminSettings: AdminSettings): Promise<boolean> {
  if (!adminSettings?.smtp2goApiKey) {
    console.log('No SMTP2GO API key configured');
    return false;
  }

  try {
    const payload: any = {
      api_key: adminSettings.smtp2goApiKey,
      to: [content.to],
      sender: content.from || adminSettings.systemEmail || 'noreply@pricecompare.com',
      subject: content.subject,
      html_body: content.html,
    };

    // Add attachments if present (SMTP2GO format)
    if (content.attachments && content.attachments.length > 0) {
      payload.attachments = content.attachments.map(att => ({
        filename: att.filename,
        fileblob: att.content, // base64 encoded
        mimetype: att.type || 'application/octet-stream'
      }));
    }

    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (response.ok && result.data?.succeeded >= 1) {
      console.log('Email sent successfully via SMTP2GO to:', content.to);
      return true;
    } else {
      console.error('Failed to send email via SMTP2GO:', JSON.stringify(result, null, 2));
      console.error('SMTP2GO Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errors: result.data?.errors || result.errors,
        failed: result.data?.failed,
        sender: payload.sender,
        recipient: content.to,
        hasAttachments: !!content.attachments
      });
      return false;
    }
  } catch (error: any) {
    console.error('Failed to send email via SMTP2GO:', error);
    return false;
  }
}

// Send email using SendGrid
export async function sendEmailViaSendGrid(content: EmailContent, adminSettings: AdminSettings): Promise<boolean> {
  if (!adminSettings?.sendgridApiKey) {
    console.log('No SendGrid API key configured');
    return false;
  }

  try {
    sgMail.setApiKey(adminSettings.sendgridApiKey);
    
    const msg = {
      to: content.to,
      from: content.from || adminSettings.systemEmail || 'noreply@pricecompare.com',
      replyTo: content.replyTo || adminSettings.supportEmail || 'support@pricecompare.com',
      subject: content.subject,
      html: content.html,
    };

    await sgMail.send(msg);
    console.log('Email sent successfully via SendGrid to:', content.to);
    return true;
  } catch (error: any) {
    console.error('Failed to send email via SendGrid:', error);
    console.error('SendGrid Error Details:', JSON.stringify(error.response?.body, null, 2));
    return false;
  }
}

// Send email using available providers (tries SMTP2GO first, falls back to SendGrid)
export async function sendEmail(content: EmailContent, adminSettings: AdminSettings): Promise<boolean> {
  // Try SMTP2GO first if configured
  if (adminSettings?.smtp2goApiKey) {
    console.log('Attempting to send email via SMTP2GO...');
    const smtp2goResult = await sendEmailViaSMTP2GO(content, adminSettings);
    if (smtp2goResult) {
      return true;
    }
    console.log('SMTP2GO failed, trying SendGrid as fallback...');
  }

  // Fall back to SendGrid if SMTP2GO is not configured or failed
  if (adminSettings?.sendgridApiKey) {
    console.log('Attempting to send email via SendGrid...');
    const sendGridResult = await sendEmailViaSendGrid(content, adminSettings);
    if (sendGridResult) {
      return true;
    }
  }

  // Neither provider is configured or both failed
  console.log('No email providers configured or all providers failed. Email would be sent:', {
    to: content.to,
    subject: content.subject,
    preview: content.html.substring(0, 100) + '...'
  });
  return false;
}

// Send secure activation email to new users (replaces insecure sendWelcomeEmail)
export async function sendActivationEmail(
  to: string, 
  organizationName: string, 
  firstName: string,
  planName: string, 
  activationUrl: string
): Promise<boolean> {
  // Import storage to get admin settings
  const { storage } = await import('./storage');
  const adminSettings = await storage.getAdminSettings();
  
  if (!adminSettings?.sendgridApiKey && !adminSettings?.smtp2goApiKey) {
    console.log('No email providers configured, activation email would be sent to:', to);
    console.log('Organization:', organizationName);
    console.log('Activation URL:', activationUrl);
    return false;
  }

  const fromEmail = adminSettings.systemEmail || 'noreply@bestprice.app';
  const brandName = adminSettings.brandName || 'PriceCompare Pro';
  
  const content: EmailContent = {
    to,
    from: fromEmail,
    replyTo: adminSettings.supportEmail || 'support@pricecomparehub.com',
    subject: `Activate Your ${brandName} Account - ${organizationName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to ${brandName}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Please activate your ${planName} account</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937;">Hi${firstName ? ` ${firstName}` : ''},</h2>
          
          <p style="color: #374151; line-height: 1.6;">
            Your ${brandName} account for <strong>${organizationName}</strong> has been created and is ready for activation. 
            To complete your account setup and create a secure password, please click the activation button below.
          </p>
          
          <div style="background-color: #fef7cd; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-weight: bold;">🔐 Security Notice</p>
            <p style="color: #92400e; margin: 10px 0 0 0; font-size: 14px;">
              This activation link is valid for <strong>30 minutes</strong> and can only be used once. 
              You'll create your own secure password during activation.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationUrl}" 
               style="background-color: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🚀 Activate My Account
            </a>
          </div>
          
          <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #0c4a6e;">What's Next?</h4>
            <ul style="color: #0c4a6e; margin-bottom: 0;">
              <li>Click the activation button above</li>
              <li>Verify your email address</li>
              <li>Create a secure password</li>
              <li>Start exploring your firearms inventory platform</li>
            </ul>
          </div>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6b7280;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
              <span style="font-family: monospace; word-break: break-all; color: #374151;">${activationUrl}</span>
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this account or have questions, please contact our support team.
          </p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            © ${new Date().getFullYear()} ${brandName}. All rights reserved.
          </p>
        </div>
      </div>
    `
  };

  // Use the dual provider email system
  return await sendEmail(content, adminSettings);
}

// Send password reset email with secure token
export async function sendPasswordResetEmail(
  to: string, 
  organizationName: string, 
  firstName: string,
  resetUrl: string
): Promise<boolean> {
  // Import storage to get admin settings
  const { storage } = await import('./storage');
  const adminSettings = await storage.getAdminSettings();
  
  if (!adminSettings?.sendgridApiKey && !adminSettings?.smtp2goApiKey) {
    console.log('No email providers configured, password reset email would be sent to:', to);
    console.log('Reset URL:', resetUrl);
    return false;
  }

  const fromEmail = adminSettings.systemEmail || 'noreply@bestprice.app';
  const brandName = adminSettings.brandName || 'PriceCompare Pro';
  
  const content: EmailContent = {
    to,
    from: fromEmail,
    replyTo: adminSettings.supportEmail || 'support@pricecomparehub.com',
    subject: `Password Reset Request - ${brandName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">${brandName}</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #1f2937;">Hi${firstName ? ` ${firstName}` : ''},</h2>
          
          <p style="color: #374151; line-height: 1.6;">
            We received a request to reset your password for your ${brandName} account with <strong>${organizationName}</strong>. 
            If you made this request, click the button below to reset your password.
          </p>
          
          <div style="background-color: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #dc2626; margin: 0; font-weight: bold;">⚠️ Security Notice</p>
            <p style="color: #dc2626; margin: 10px 0 0 0; font-size: 14px;">
              This reset link is valid for <strong>15 minutes</strong> and can only be used once. 
              If you didn't request this reset, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🔑 Reset My Password
            </a>
          </div>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6b7280;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
              <span style="font-family: monospace; word-break: break-all; color: #374151;">${resetUrl}</span>
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this password reset, please contact our support team immediately.
          </p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            © ${new Date().getFullYear()} ${brandName}. All rights reserved.
          </p>
        </div>
      </div>
    `
  };

  // Use the dual provider email system
  return await sendEmail(content, adminSettings);
}

// Send invite email with temporary password (bypasses activation flow)
export async function sendInviteEmail(
  to: string,
  organizationName: string,
  username: string,
  temporaryPassword: string,
  loginUrl: string
): Promise<boolean> {
  const { storage } = await import('./storage');
  const adminSettings = await storage.getAdminSettings();

  if (!adminSettings?.sendgridApiKey && !adminSettings?.smtp2goApiKey) {
    console.error('❌ EMAIL CONFIGURATION: No email providers configured!');
    console.error('📊 Available settings:', {
      hasSendGrid: !!adminSettings?.sendgridApiKey,
      hasSMTP2GO: !!adminSettings?.smtp2goApiKey,
      systemEmail: adminSettings?.systemEmail,
      supportEmail: adminSettings?.supportEmail
    });
    console.log('📧 Email would be sent to:', {
      to: to,
      organization: organizationName,
      username: username,
      temporaryPassword: temporaryPassword,
      loginUrl: loginUrl
    });
    return false; // Fail fast but with detailed logging
  }

  const fromEmail = adminSettings.systemEmail || 'noreply@pricecomparehub.com';
  const brandName = adminSettings.brandName || 'PriceCompare Pro';

  const content: EmailContent = {
    to,
    from: fromEmail,
    replyTo: adminSettings.supportEmail || 'support@pricecomparehub.com',
    subject: `Your ${brandName} Account - ${organizationName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to ${brandName}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your account is ready</p>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; line-height: 1.6;">
            We've created your ${brandName} account for <strong>${organizationName}</strong>.
          </p>
          <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0c4a6e;"><strong>Login Details</strong></p>
            <p style="margin: 8px 0 0 0; color: #0c4a6e; font-family: monospace;">
              Username: ${username}<br/>
              Temporary password: ${temporaryPassword}
            </p>
          </div>
          <div style="background-color: #fff7ed; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 16px 0;">
            <p style="margin: 0; color: #92400e;">
              For your security, please log in and change your password immediately.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🔐 Log In Now
            </a>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6b7280;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
              <span style="font-family: monospace; word-break: break-all; color: #374151;">${loginUrl}</span>
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this account or have questions, please contact our support team.
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            © ${new Date().getFullYear()} ${brandName}. All rights reserved.
          </p>
        </div>
      </div>
    `
  };

  return await sendEmail(content, adminSettings);
}