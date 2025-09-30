// Temporary route for testing SendGrid email service
import { Express } from "express";
import { sendActivationEmail } from "./email-service";
import { generateActivationUrl } from "./secure-token-utils";
import { storage } from "./storage";

export function setupTestEmailRoute(app: Express) {
  // Temporary route to test email sending and resend activation email
  app.post("/api/test/resend-activation", async (req, res) => {
    try {
      const { email, organizationSlug } = req.body;
      
      if (!email || !organizationSlug) {
        return res.status(400).json({ 
          message: "Email and organizationSlug are required" 
        });
      }

      // Get organization
      const organization = await storage.getCompanyBySlug(organizationSlug);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Find user by email and organization
      const user = await storage.getUserByUsernameAndCompany(email.split('@')[0], organization.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has activation token
      if (!user.activationToken) {
        return res.status(400).json({ 
          message: "User does not have an activation token" 
        });
      }

      // Generate activation URL
      const activationUrl = generateActivationUrl(
        organizationSlug, 
        user.activationToken,
        process.env.BASE_URL || 'https://bestprice.app'
      );

      console.log('Sending activation email:', {
        to: email,
        organizationName: organization.name,
        firstName: user.firstName || 'User',
        activationUrl
      });

      // Send activation email
      const emailSent = await sendActivationEmail(
        email,
        organization.name,
        user.firstName || 'User',
        organization.plan || 'Professional',
        activationUrl
      );

      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Activation email sent successfully",
          activationUrl,
          userInfo: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            organization: organization.name
          }
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send activation email" 
        });
      }

    } catch (error: any) {
      console.error('Resend activation email error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error", 
        error: error.message 
      });
    }
  });

  // Test route to check SendGrid configuration
  app.get("/api/test/sendgrid-config", async (req, res) => {
    try {
      const adminSettings = await storage.getAdminSettings();
      
      res.json({
        hasApiKey: !!adminSettings?.sendgridApiKey,
        apiKeyLength: adminSettings?.sendgridApiKey?.length || 0,
        apiKeyPrefix: adminSettings?.sendgridApiKey?.substring(0, 10) || '',
        systemEmail: adminSettings?.systemEmail,
        supportEmail: adminSettings?.supportEmail
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to check configuration", 
        error: error.message 
      });
    }
  });
}